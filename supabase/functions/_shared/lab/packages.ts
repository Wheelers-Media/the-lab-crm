// THE LAB catalog: every Shopify product, copied into the CRM. Shop services
// and Gridiron bumpers are "packages" (what goes on a job); everything else
// (diesel parts, accessories, merch, the deposit) is a "product".
// Shopify stays the source of truth for names, prices and stock.
import { categorizeLines, clip, parseAmount } from "./parse.ts";

export type PackageVariant = {
  id: string;
  title: string;
  price: number;
  sku?: string;
  inventory?: number | null;
  /** The crossed-out price, when Shopify shows a sale. */
  compare_at?: number;
  weight_kg?: number;
  /** What the shop pays for it; only when Shopify shares it with the CRM. */
  cost?: number;
};

export type PackageImage = { url: string; alt?: string };

export type CatalogKind = "package" | "product";

export type PackageRow = {
  shopify_product_id: string;
  title: string;
  shopify_title: string;
  vendor: string;
  category: string;
  bay: "boutique" | "parts";
  price: number | null;
  price_max: number | null;
  variants: PackageVariant[];
  status: string;
  shopify_updated_at: string | null;
  kind: CatalogKind;
  product_type: string | null;
  handle: string | null;
  image_url: string | null;
  /** Units in stock across variants; null when Shopify does not track it. */
  inventory: number | null;
  /** The product description as plain text. */
  description: string;
  images: PackageImage[];
  tags: string[];
};

type AnyRecord = Record<string, unknown>;
const rec = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};

// The shop's own services and the Gridiron bumpers it sells and fits.
// Diesel parts from other brands belong to the Parts Store.
const PACKAGE_VENDOR = /^(the lab|gridiron)/i;
// Not services even when THE LAB sells them: the booking deposit and merch
const NOT_A_PACKAGE = /secure booking deposit|t-shirt|hoodie|\bhat\b/i;

export const catalogKind = (title: string, vendor: string): CatalogKind =>
  PACKAGE_VENDOR.test(vendor) && !NOT_A_PACKAGE.test(title)
    ? "package"
    : "product";
const STATUSES = new Set(["active", "unlisted", "draft", "archived"]);

/** "Universal Fit - Suntek - Ceramic Tint - Panoramic Roof" -> "Ceramic Tint - Panoramic Roof" */
export const packageTitle = (title: string): string =>
  title
    .replace(/^Universal Fit\s*[-–]\s*(THE LAB|Suntek)\s*[-–]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

const TAG_TO_CATEGORY: Record<string, string> = {
  Tint: "window-tint",
  Detailing: "detailing",
  Lighting: "lighting",
  Tuning: "tuning",
  "Diesel parts": "diesel-parts",
  Mechanical: "install",
  Accessories: "install",
  "Gift card": "gift-certificate",
};

export const packageCategory = (title: string, vendor: string): string => {
  if (/gridiron/i.test(vendor) || /gridiron/i.test(title)) return "gridiron";
  if (/membership|monthly signature|syndicate/i.test(title))
    return "membership";
  if (/sxs|side[- ]by[- ]side|utv/i.test(title)) return "sxs-tint";
  if (/shop rate|labou?r|tire rotation|emblem/i.test(title)) return "install";
  const [tag] = categorizeLines([title]);
  return (tag && TAG_TO_CATEGORY[tag]) || "other";
};

export const packageBay = (category: string): "boutique" | "parts" =>
  category === "tuning" || category === "diesel-parts" ? "parts" : "boutique";

const imageFrom = (p: AnyRecord): string | null => {
  const first = Array.isArray(p.images) ? rec(p.images[0]).src : undefined;
  const url = clip(rec(p.image).src ?? first, 500);
  return /^https:\/\//.test(url) ? url : null;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  deg: "°",
};

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

/**
 * A Shopify description (HTML) as plain text: paragraphs apart, list items as
 * bullets. Plain text on purpose, so the CRM never has to render store HTML.
 */
export const htmlToText = (html: unknown): string =>
  decodeEntities(
    String(html ?? "")
      .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div|h[1-6]|table)\s*>/gi, "\n\n")
      .replace(/<\s*li\b[^>]*>/gi, "• ")
      .replace(/<\s*\/\s*(li|ul|ol|tr)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    // Bullets sit together; a blank line stays between a paragraph and the next
    .replace(/^(• [^\n]*)\n\n(?=• )/gm, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);

/** The cover picture first, without repeating it when the gallery already has it. */
const withCover = (
  cover: string | null,
  gallery: PackageImage[],
): PackageImage[] =>
  cover && !gallery.some((g) => g.url === cover)
    ? [{ url: cover }, ...gallery]
    : gallery;

const MAX_IMAGES = 8;
const MAX_TAGS = 30;

const imageList = (items: PackageImage[]): PackageImage[] => {
  const seen = new Set<string>();
  const images: PackageImage[] = [];
  for (const item of items) {
    const url = clip(item.url, 500);
    if (!/^https:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    const alt = clip(item.alt, 200);
    images.push(alt ? { url, alt } : { url });
    if (images.length >= MAX_IMAGES) break;
  }
  return images;
};

const tagList = (tags: string[]): string[] =>
  [...new Set(tags.map((t) => clip(t, 60)).filter(Boolean))].slice(0, MAX_TAGS);

const KG_PER: Record<string, number> = {
  kg: 1,
  kilograms: 1,
  g: 0.001,
  grams: 0.001,
  lb: 0.45359237,
  lbs: 0.45359237,
  pounds: 0.45359237,
  oz: 0.0283495,
  ounces: 0.0283495,
};

/** A weight in kilograms, or undefined when Shopify has none (0 means "not set"). */
const weightKg = (value: unknown, unit: unknown): number | undefined => {
  const kg =
    Number(value) * (KG_PER[String(unit ?? "kg").toLowerCase()] ?? NaN);
  return Number.isFinite(kg) && kg > 0
    ? Math.round(kg * 1000) / 1000
    : undefined;
};

const compareAt = (value: unknown, price: number): number | undefined => {
  const compare = parseAmount(value);
  return compare > price ? compare : undefined;
};

type Parts = {
  id: string;
  title: string;
  vendor: string;
  status: string;
  updatedAt: string;
  productType: string;
  handle: string;
  description: string;
  images: PackageImage[];
  tags: string[];
  tracked: boolean;
  variants: PackageVariant[];
};

const rowFrom = (x: Parts): PackageRow | null => {
  if (!x.id || !x.title) return null;
  const prices = x.variants.map((v) => v.price).filter((n) => n > 0);
  const category = packageCategory(x.title, x.vendor);
  const status = x.status.toLowerCase();
  const images = imageList(x.images);
  return {
    shopify_product_id: x.id,
    title: packageTitle(x.title),
    shopify_title: x.title,
    vendor: x.vendor,
    category,
    bay: packageBay(category),
    price: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    variants: x.variants,
    status: STATUSES.has(status) ? status : "active",
    shopify_updated_at: clip(x.updatedAt, 40) || null,
    kind: catalogKind(x.title, x.vendor),
    product_type: clip(x.productType, 120) || null,
    handle: clip(x.handle, 255) || null,
    image_url: images[0]?.url ?? null,
    inventory: x.tracked
      ? x.variants.reduce((sum, v) => sum + (v.inventory ?? 0), 0)
      : null,
    description: htmlToText(x.description),
    images,
    tags: tagList(x.tags),
  };
};

/** A Shopify product (webhook REST shape) as a catalog row; null if unreadable. */
export const packageFromProduct = (payload: unknown): PackageRow | null => {
  const p = rec(payload);
  const rawVariants = (Array.isArray(p.variants) ? p.variants : []).map(rec);
  // REST marks tracked variants with inventory_management "shopify"
  const tracked = rawVariants.some((v) => v.inventory_management === "shopify");
  const variants: PackageVariant[] = rawVariants.map((v) => {
    const price = parseAmount(v.price);
    return {
      id: String(v.id ?? ""),
      title: clip(v.title, 120),
      price,
      sku: clip(v.sku, 80) || undefined,
      inventory: tracked ? Number(v.inventory_quantity) || 0 : null,
      compare_at: compareAt(v.compare_at_price, price),
      weight_kg: weightKg(v.weight, v.weight_unit),
    };
  });
  const images = (Array.isArray(p.images) ? p.images : []).map((raw) => ({
    url: clip(rec(raw).src, 500),
    alt: clip(rec(raw).alt, 200),
  }));
  const cover = imageFrom(p);
  return rowFrom({
    id: p.id == null ? "" : String(p.id),
    title: clip(p.title, 300),
    vendor: clip(p.vendor, 120),
    status: clip(p.status, 20),
    updatedAt: clip(p.updated_at, 40),
    productType: clip(p.product_type, 120),
    handle: clip(p.handle, 255),
    description: String(p.body_html ?? ""),
    images: withCover(cover, images),
    tags: String(p.tags ?? "").split(","),
    tracked,
    variants,
  });
};

const nodesOf = (connection: unknown): AnyRecord[] => {
  const c = rec(connection);
  if (Array.isArray(c.nodes)) return c.nodes.map(rec);
  if (Array.isArray(c.edges)) return c.edges.map((e) => rec(rec(e).node));
  return [];
};

/** "gid://shopify/Product/123" -> "123" */
const numericId = (gid: unknown): string =>
  String(gid ?? "")
    .split("/")
    .pop() ?? "";

/**
 * A Shopify product from the Admin GraphQL API as a catalog row. The inventory
 * item (cost, weight) is only there when the app was allowed to read it; a
 * product without it still maps, just without cost and weight.
 */
export const packageFromGraphql = (node: unknown): PackageRow | null => {
  const p = rec(node);
  const variants: PackageVariant[] = nodesOf(p.variants).map((v) => {
    const price = parseAmount(v.price);
    const item = rec(v.inventoryItem);
    const weight = rec(rec(item.measurement).weight);
    const cost =
      item.unitCost == null
        ? undefined
        : parseAmount(rec(item.unitCost).amount);
    return {
      id: numericId(v.id),
      title: clip(v.title, 120),
      price,
      sku: clip(v.sku, 80) || undefined,
      inventory:
        p.tracksInventory === true ? Number(v.inventoryQuantity) || 0 : null,
      compare_at: compareAt(v.compareAtPrice, price),
      weight_kg: weightKg(weight.value, weight.unit),
      cost: cost !== undefined && Number.isFinite(cost) ? cost : undefined,
    };
  });
  const media = nodesOf(p.media).map((m) => ({
    url: clip(rec(m.image).url, 500),
    alt: clip(rec(m.image).altText, 200),
  }));
  const cover = clip(rec(rec(rec(p.featuredMedia).preview).image).url, 500);
  return rowFrom({
    id: numericId(p.id),
    title: clip(p.title, 300),
    vendor: clip(p.vendor, 120),
    status: clip(p.status, 20),
    updatedAt: clip(p.updatedAt, 40),
    productType: clip(p.productType, 120),
    handle: clip(p.handle, 255),
    description: String(p.descriptionHtml ?? ""),
    images: withCover(cover, media),
    tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t)) : [],
    tracked: p.tracksInventory === true,
    variants,
  });
};
