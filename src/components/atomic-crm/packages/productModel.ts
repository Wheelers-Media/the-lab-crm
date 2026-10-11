// Product page and card numbers: stock wording, margin, ready-made links and
// how well a product sells, from plain records so they can be tested.
import type { Package } from "../types";

export const LOW_STOCK = 2;

export type StockTone = "ok" | "low" | "out" | "made-to-order";

/**
 * What stock means. Shopify counts below zero when a product sells without
 * being on the shelf (drop-shipped or made to order): that is not "out of
 * stock", the shop is still selling it.
 */
export const stockInfo = (
  inventory: number | null | undefined,
): { label: string; tone: StockTone } | null => {
  if (inventory == null) return null;
  if (inventory < 0) return { label: "Made to order", tone: "made-to-order" };
  if (inventory === 0) return { label: "Out of stock", tone: "out" };
  return {
    label: `${inventory} in stock`,
    tone: inventory <= LOW_STOCK ? "low" : "ok",
  };
};

/** Profit on a unit and as a whole percent of the price; null without a cost. */
export const marginOf = (variant: {
  price: number;
  cost?: number;
}): { profit: number; percent: number } | null => {
  if (!variant.cost || variant.cost <= 0 || variant.price <= 0) return null;
  const profit = variant.price - variant.cost;
  return { profit, percent: Math.round((profit / variant.price) * 100) };
};

/** The shipping rule and the fitment tags, apart. */
export const splitTags = (
  tags: string[] | undefined,
): { shipping: string | null; others: string[] } => {
  const all = tags ?? [];
  const shipping = all.find((t) => /^shipping\s*:/i.test(t));
  return {
    shipping: shipping ? shipping.replace(/^shipping\s*:\s*/i, "") : null,
    others: all.filter((t) => t !== shipping),
  };
};

/** The product's page on thelabfsj.ca; the shop's services are not sold there. */
export const websiteUrl = (
  pkg: Pick<Package, "kind" | "status" | "shopify_product_id">,
): string | null =>
  pkg.kind === "product" && pkg.status === "active"
    ? `https://thelabfsj.ca/store/product/?id=${encodeURIComponent(`gid://shopify/Product/${pkg.shopify_product_id}`)}`
    : null;

export type SoldLine = {
  ordered_at: string;
  quantity: number;
  price: number;
  contact_id: number | null;
};

const DAY_MS = 86_400_000;

export interface SalesStats {
  units: { d30: number; d90: number; d365: number; all: number };
  revenue: { d30: number; d90: number; d365: number; all: number };
  lastSoldAt: string | null;
  customers: number;
  /** Units per calendar month for the last 12 months, oldest first. */
  monthly: Array<{ key: string; units: number }>;
}

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** How much of a product sold, over the last 30, 90 and 365 days and ever. */
export const salesStats = (
  lines: SoldLine[],
  now: Date = new Date(),
): SalesStats => {
  const stats: SalesStats = {
    units: { d30: 0, d90: 0, d365: 0, all: 0 },
    revenue: { d30: 0, d90: 0, d365: 0, all: 0 },
    lastSoldAt: null,
    customers: new Set(
      lines.map((l) => l.contact_id).filter((id) => id != null),
    ).size,
    monthly: [],
  };
  const months = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    months.set(
      monthKey(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
      ),
      0,
    );
  }
  for (const line of lines) {
    const units = Number(line.quantity) || 0;
    const revenue = units * (Number(line.price) || 0);
    const age = (now.getTime() - new Date(line.ordered_at).getTime()) / DAY_MS;
    stats.units.all += units;
    stats.revenue.all += revenue;
    for (const [key, days] of [
      ["d30", 30],
      ["d90", 90],
      ["d365", 365],
    ] as const) {
      if (age <= days) {
        stats.units[key] += units;
        stats.revenue[key] += revenue;
      }
    }
    if (!stats.lastSoldAt || line.ordered_at > stats.lastSoldAt)
      stats.lastSoldAt = line.ordered_at;
    const key = monthKey(new Date(line.ordered_at));
    if (months.has(key)) months.set(key, (months.get(key) ?? 0) + units);
  }
  stats.monthly = [...months].map(([key, units]) => ({ key, units }));
  return stats;
};
