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
};

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

/** A Shopify product (webhook REST shape) as a catalog row; null if unreadable. */
export const packageFromProduct = (payload: unknown): PackageRow | null => {
  const p = rec(payload);
  const id = p.id == null ? "" : String(p.id);
  const shopifyTitle = clip(p.title, 300);
  const vendor = clip(p.vendor, 120);
  if (!id || !shopifyTitle) return null;

  const rawVariants = (Array.isArray(p.variants) ? p.variants : []).map(rec);
  // REST marks tracked variants with inventory_management "shopify"
  const tracked = rawVariants.some((v) => v.inventory_management === "shopify");
  const variants: PackageVariant[] = rawVariants.map((v) => ({
    id: String(v.id ?? ""),
    title: clip(v.title, 120),
    price: parseAmount(v.price),
    sku: clip(v.sku, 80) || undefined,
    inventory: tracked ? Number(v.inventory_quantity) || 0 : null,
  }));
  const prices = variants.map((v) => v.price).filter((n) => n > 0);
  const category = packageCategory(shopifyTitle, vendor);
  const status = clip(p.status, 20).toLowerCase();
  return {
    shopify_product_id: id,
    title: packageTitle(shopifyTitle),
    shopify_title: shopifyTitle,
    vendor,
    category,
    bay: packageBay(category),
    price: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    variants,
    status: STATUSES.has(status) ? status : "active",
    shopify_updated_at: clip(p.updated_at, 40) || null,
    kind: catalogKind(shopifyTitle, vendor),
    product_type: clip(p.product_type, 120) || null,
    handle: clip(p.handle, 255) || null,
    image_url: imageFrom(p),
    inventory: tracked
      ? variants.reduce((sum, v) => sum + (v.inventory ?? 0), 0)
      : null,
  };
};
