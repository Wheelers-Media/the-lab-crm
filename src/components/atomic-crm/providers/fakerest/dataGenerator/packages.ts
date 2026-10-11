import type { Package } from "../../../types";
import { CATALOGUE } from "./shop";

// Demo catalog built from the demo order lines, plus a few Shopify-only items,
// so customer package history links to catalog entries.
const shortTitle = (name: string) =>
  name
    .replace(/^Universal Fit\s*[-–]\s*(THE LAB|Suntek)\s*[-–]\s*/i, "")
    .trim();

const CATEGORY: Record<string, string> = {
  Tint: "window-tint",
  Detailing: "detailing",
  "Diesel parts": "diesel-parts",
  Lighting: "lighting",
  Mechanical: "install",
  "Gift card": "gift-certificate",
};

const EXTRA: Array<{
  title: string;
  vendor: string;
  category: string;
  price: number;
  price_max?: number;
  kind: Package["kind"];
  inventory: number | null;
}> = [
  {
    title: "Gridiron Prerunner Front Bumper",
    vendor: "Gridiron Bumper Corp.",
    category: "gridiron",
    price: 2949,
    price_max: 3549,
    kind: "package",
    inventory: null,
  },
  {
    title: "The Monthly Signature Membership",
    vendor: "The Lab",
    category: "membership",
    price: 249,
    price_max: 289,
    kind: "package",
    inventory: null,
  },
  {
    title: "EZ LYNK Auto Agent 3",
    vendor: "EZ LYNK",
    category: "tuning",
    price: 1099,
    kind: "product",
    inventory: 2,
  },
  {
    title: "Cummins 6.7L Grid Heater Delete Plate",
    vendor: "Dieselr",
    category: "diesel-parts",
    price: 89,
    kind: "product",
    inventory: 0,
  },
];

// A tinted square with the product's initials, as an inline picture
const BACKDROPS = ["#16324f", "#3b2a1a", "#1f3b2d", "#3b1f33", "#2a2a40"];
const demoImage = (title: string, index: number) => {
  const initials = title
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${BACKDROPS[index % BACKDROPS.length]}"/><text x="200" y="235" font-family="sans-serif" font-size="140" font-weight="700" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const DESCRIPTION: Record<string, string> = {
  "diesel-parts":
    "Built for hard-working diesel trucks.\n\nTechnical Specifications:\n\n• T409 stainless steel\n• Direct bolt-on fit\n• Hardware included\n\nWARNING: Designed and intended strictly for Off-Road and Sanctioned Racing Use Only.",
  tuning:
    "Tune and monitor your truck from your phone.\n\nFeatures:\n\n• Custom tune files\n• Live gauges\n• Data logging",
  lighting:
    "Bright, durable lighting.\n\nTechnical Specifications:\n\n• 5,000 lumens\n• Weatherproof\n• Plug and play",
};

const TAGS: Record<string, string[]> = {
  "diesel-parts": ["duramax", "exhaust", "Shipping: Exhaust"],
  tuning: ["tuning", "Shipping: Standard"],
  lighting: ["lighting", "Shipping: Standard"],
};

export const generatePackages = (): Package[] => {
  const now = new Date().toISOString();
  const fromOrders = CATALOGUE.map((item) => {
    const category = item.name.includes("SxS")
      ? "sxs-tint"
      : (CATEGORY[item.category] ?? "other");
    const isPart = category === "diesel-parts" || category === "tuning";
    return {
      title: shortTitle(item.name),
      shopify_title: item.name,
      vendor: isPart ? "Polar Diesel" : "The Lab",
      category,
      price: item.price,
      price_max: item.price,
      kind: (isPart || category === "lighting"
        ? "product"
        : "package") as Package["kind"],
      inventory: isPart || category === "lighting" ? 4 : null,
    };
  });
  const extra = EXTRA.map((e) => ({
    ...e,
    shopify_title: e.title,
    price_max: e.price_max ?? e.price,
  }));
  return [...fromOrders, ...extra].map((p, id) => ({
    id,
    shopify_product_id: String(9000 + id),
    title: p.title,
    shopify_title: p.shopify_title,
    vendor: p.vendor,
    category: p.category,
    bay:
      p.category === "diesel-parts" || p.category === "tuning"
        ? "parts"
        : "boutique",
    price: p.price,
    price_max: p.price_max,
    variants: [
      {
        id: String(19000 + id),
        title: "Default Title",
        price: p.price,
        inventory: p.inventory,
        ...(p.kind === "product"
          ? {
              sku: `LAB-${1000 + id}`,
              // Some products have a known cost, some do not (like the real store)
              ...(id % 2 === 0 ? { cost: Math.round(p.price * 0.62) } : {}),
              weight_kg: 1 + (id % 5) * 4,
              ...(id % 3 === 0
                ? { compare_at: Math.round(p.price * 1.15) }
                : {}),
            }
          : {}),
      },
    ],
    status: "active",
    shopify_updated_at: now,
    synced_at: now,
    kind: p.kind,
    product_type: null,
    handle: null,
    image_url: p.kind === "product" ? demoImage(p.title, id) : null,
    inventory: p.inventory,
    description: DESCRIPTION[p.category] ?? "",
    images:
      p.kind === "product"
        ? [{ url: demoImage(p.title, id) }, { url: demoImage(p.title, id + 1) }]
        : [],
    tags: TAGS[p.category] ?? [],
  }));
};
