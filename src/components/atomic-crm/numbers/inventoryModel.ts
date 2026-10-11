// Stock health: what is out, what is about to run out, what sits unsold, and
// what the stock on the shelf is worth at retail. Shopify tracks stock per
// variant; negative stock means sold without being on hand (drop-shipped or
// made to order), so it is reported apart rather than as "out of stock".
import type { DateRange } from "../operations/shopTime";
import type { Order, Package } from "../types";
import { catalogMatcher } from "./catalogMatch";
import { salesOrders } from "./salesModel";

export const LOW_STOCK_UNITS = 2;
export const SLOW_DAYS = 90;

export interface StockLine {
  id: Package["id"];
  title: string;
  vendor: string;
  units: number;
  /** Units on the shelf at retail price. */
  retailValue: number;
  soldRecently: number;
}

export interface InventoryHealth {
  products: number;
  tracked: number;
  inStock: number;
  outOfStock: number;
  madeToOrder: number;
  stockValue: number;
  /** Sold in the window and now at zero: the ones to reorder first. */
  outOfStockSellers: StockLine[];
  /** Sold in the window and nearly gone. */
  lowStockSellers: StockLine[];
  /** On the shelf with no sales in the window: money sitting still. */
  slowMovers: StockLine[];
  slowValue: number;
}

const shelfValue = (pkg: Package): number =>
  (pkg.variants ?? []).reduce(
    (s, v) =>
      s + Math.max(0, Number(v.inventory) || 0) * (Number(v.price) || 0),
    0,
  );

export const inventoryHealth = (
  catalog: Package[],
  orders: Order[],
  window: DateRange,
): InventoryHealth => {
  const match = catalogMatcher(catalog);
  const sold = new Map<Package["id"], number>();
  for (const o of salesOrders(orders, window)) {
    for (const line of o.line_items ?? []) {
      const pkg = match(line);
      if (pkg)
        sold.set(
          pkg.id,
          (sold.get(pkg.id) ?? 0) + (Number(line.quantity) || 0),
        );
    }
  }
  const products = catalog.filter(
    (p) => p.kind === "product" && p.status === "active",
  );
  const tracked = products.filter((p) => p.inventory != null);
  const line = (p: Package): StockLine => ({
    id: p.id,
    title: p.title,
    vendor: p.vendor ?? "",
    units: Math.max(0, p.inventory ?? 0),
    retailValue: shelfValue(p),
    soldRecently: sold.get(p.id) ?? 0,
  });
  const bySold = (a: StockLine, b: StockLine) =>
    b.soldRecently - a.soldRecently || a.title.localeCompare(b.title);
  const slow = tracked
    .filter((p) => (p.inventory ?? 0) > 0 && !sold.get(p.id))
    .map(line)
    .sort((a, b) => b.retailValue - a.retailValue);
  return {
    products: products.length,
    tracked: tracked.length,
    inStock: tracked.filter((p) => (p.inventory ?? 0) > 0).length,
    outOfStock: tracked.filter((p) => p.inventory === 0).length,
    madeToOrder: tracked.filter((p) => (p.inventory ?? 0) < 0).length,
    stockValue: tracked.reduce((s, p) => s + shelfValue(p), 0),
    outOfStockSellers: tracked
      .filter((p) => p.inventory === 0 && sold.get(p.id))
      .map(line)
      .sort(bySold),
    lowStockSellers: tracked
      .filter(
        (p) =>
          (p.inventory ?? 0) > 0 &&
          (p.inventory ?? 0) <= LOW_STOCK_UNITS &&
          sold.get(p.id),
      )
      .map(line)
      .sort(bySold),
    slowMovers: slow,
    slowValue: slow.reduce((s, l) => s + l.retailValue, 0),
  };
};

/** The window sales are measured over: the 90 days up to now. */
export const slowWindow = (now: Date): DateRange => ({
  start: new Date(now.getTime() - SLOW_DAYS * 86_400_000),
  end: new Date(now.getTime() + 1),
});
