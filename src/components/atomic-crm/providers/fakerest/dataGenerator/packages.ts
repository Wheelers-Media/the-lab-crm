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
      },
    ],
    status: "active",
    shopify_updated_at: now,
    synced_at: now,
    kind: p.kind,
    product_type: null,
    handle: null,
    image_url: null,
    inventory: p.inventory,
  }));
};
