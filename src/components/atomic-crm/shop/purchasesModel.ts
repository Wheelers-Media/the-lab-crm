// A customer's buying history, computed from plain Shopify order records so
// the profile tab can be tested without a database.
//
// Spend follows the same rules as customerSpend(): cancelled orders and
// booking deposits are left out (the deposit is credited to the final invoice,
// so counting it would count the same money twice). Item spend is refunded in
// proportion to the order, so the items add up to the lifetime figure instead
// of overstating what a refunded order cost.
import { NOT_A_PRODUCT, cleanProductName } from "../operations/metrics";
import type { Order, OrderLineItem } from "../types";
import { orderNet } from "./shopFormat";

const isCounted = (order: Order): boolean =>
  !order.cancelled_at &&
  !order.is_deposit &&
  (order.currency ?? "CAD") === "CAD";

const newestFirst = (a: Order, b: Order) =>
  b.ordered_at.localeCompare(a.ordered_at);

export interface PurchaseSummary {
  /** Sales orders behind the spend, deposits and cancellations left out. */
  orderCount: number;
  lifetimeSpend: number;
  averageOrder: number | null;
  lastPurchasedAt: string | null;
  firstPurchasedAt: string | null;
  /** Distinct things bought, not counting fees and shop supplies. */
  distinctItems: number;
  units: number;
}

export interface BoughtBeforeItem {
  /** Clean product name, safe to show as is. */
  name: string;
  quantity: number;
  /** How many separate orders included it. */
  orders: number;
  spent: number;
  lastPurchasedAt: string;
  firstPurchasedAt: string;
}

export interface PurchaseLedger {
  summary: PurchaseSummary;
  /** Most recently bought first. */
  items: BoughtBeforeItem[];
  /** Every order, newest first, including deposits and cancellations. */
  history: Order[];
}

/** The order's net total shared across its lines in proportion to price. */
const lineSpend = (order: Order, line: OrderLineItem): number => {
  const gross = (Number(line.price) || 0) * (Number(line.quantity) || 0);
  const total = Number(order.total) || 0;
  if (gross <= 0 || total <= 0) return 0;
  return gross * (orderNet(order) / total);
};

// "Universal Fit - Suntek - Ceramic Tint" is still a ceramic tint.
const BRAND_PREFIX =
  /^Universal(?: Fit)?\s*[-–]\s*(?:THE LAB|Suntek)\s*[-–]\s*/i;

/** "Universal Fit - THE LAB - Headlight Restoration" -> "Headlight Restoration". */
export const cleanPurchaseName = (raw: string): string =>
  cleanProductName(raw.replace(BRAND_PREFIX, "")).trim();

/** The line's name as a product, or "" for shipping, fees and test amounts. */
const productName = (line: OrderLineItem): string => {
  const name = cleanPurchaseName(line.name ?? "");
  if (!name || NOT_A_PRODUCT.test(name)) return "";
  return name;
};

export const purchaseLedger = (orders: Order[]): PurchaseLedger => {
  const history = [...orders].sort(newestFirst);
  const counted = history.filter(isCounted);

  const lifetimeSpend = counted.reduce((sum, o) => sum + orderNet(o), 0);
  const byName = new Map<string, BoughtBeforeItem>();
  let units = 0;

  for (const order of counted) {
    for (const line of order.line_items ?? []) {
      const name = productName(line);
      if (!name) continue;
      const quantity = Number(line.quantity) || 0;
      const key = name.toLowerCase();
      const row = byName.get(key);
      units += quantity;
      if (!row) {
        byName.set(key, {
          name,
          quantity,
          orders: 1,
          spent: lineSpend(order, line),
          lastPurchasedAt: order.ordered_at,
          firstPurchasedAt: order.ordered_at,
        });
        continue;
      }
      row.quantity += quantity;
      row.orders += 1;
      row.spent += lineSpend(order, line);
      // history is newest first, so the first sighting stays the latest one
      if (order.ordered_at < row.firstPurchasedAt) {
        row.firstPurchasedAt = order.ordered_at;
      }
    }
  }

  const items = [...byName.values()].sort(
    (a, b) =>
      b.lastPurchasedAt.localeCompare(a.lastPurchasedAt) ||
      b.quantity - a.quantity ||
      a.name.localeCompare(b.name),
  );

  // A deposit is still a purchase, even though it is not in the spend figure
  const dated = history
    .filter((o) => !o.cancelled_at)
    .map((o) => o.ordered_at)
    .sort();
  return {
    summary: {
      orderCount: counted.length,
      lifetimeSpend,
      averageOrder: counted.length ? lifetimeSpend / counted.length : null,
      lastPurchasedAt: dated.at(-1) ?? null,
      firstPurchasedAt: dated[0] ?? null,
      distinctItems: items.length,
      units,
    },
    items,
    history,
  };
};
