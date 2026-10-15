// Sales numbers from Shopify orders, for the Numbers screen. Plain functions
// over plain records so every figure can be tested without a database.
//
// "Net sales" is what customers were charged for goods and services, after
// discounts, before tax and shipping (Shopify's own "net sales", before
// returns). "Collected" is the money that came in: the order totals with tax
// and shipping, less refunds. Booking deposits are counted on their own: they
// are credited against the final bill, so they are not sales.
import { categorizeLines } from "../../../../supabase/functions/_shared/lab/parse";
import {
  cleanProductName,
  NOT_A_PRODUCT,
  percentChange,
} from "../operations/metrics";
import { type DateRange, inRange } from "../operations/shopTime";
import type { Order, OrderLineItem, Package } from "../types";
import { catalogMatcher } from "./catalogMatch";
import {
  type Bucket,
  bucketKeyOf,
  bucketKeys,
  bucketLabel,
  type NumbersRanges,
} from "./periods";

export { percentChange };

const num = (value: unknown): number => Number(value) || 0;

/** Sales orders in the range: paid, not cancelled, and not a booking deposit. */
export const salesOrders = (orders: Order[], range: DateRange): Order[] =>
  orders.filter(
    (o) => !o.cancelled_at && !o.is_deposit && inRange(o.ordered_at, range),
  );

export const depositOrders = (orders: Order[], range: DateRange): Order[] =>
  orders.filter(
    (o) => !o.cancelled_at && o.is_deposit && inRange(o.ordered_at, range),
  );

/** What the customer paid for the goods: the order subtotal, else its total. */
export const netOf = (o: Order): number => num(o.subtotal ?? o.total);

/** Units on an order: product lines only, fees and shop supplies left out. */
export const unitsOf = (o: Order): number =>
  (o.line_items ?? [])
    .filter((l) => !NOT_A_PRODUCT.test(cleanProductName(l.name ?? "")))
    .reduce((n, l) => n + num(l.quantity), 0);

const lineValue = (line: OrderLineItem): number =>
  num(line.quantity) * num(line.price);

export interface SalesSummary {
  orders: number;
  netSales: number;
  taxAndShipping: number;
  refunds: number;
  refundedOrders: number;
  /** Orders with a refund, as a whole percent of orders. */
  refundRate: number | null;
  collected: number;
  averageOrder: number | null;
  units: number;
  unitsPerOrder: number | null;
  largestOrder: number;
  deposits: number;
  depositAmount: number;
}

export const salesSummary = (
  orders: Order[],
  range: DateRange,
): SalesSummary => {
  const sales = salesOrders(orders, range);
  const deposits = depositOrders(orders, range);
  const netSales = sales.reduce((s, o) => s + netOf(o), 0);
  const total = sales.reduce((s, o) => s + num(o.total), 0);
  const refunds = sales.reduce((s, o) => s + num(o.refunded_amount), 0);
  const refunded = sales.filter((o) => num(o.refunded_amount) > 0);
  const units = sales.reduce(
    (s, o) =>
      s +
      (o.line_items ?? [])
        .filter((l) => !NOT_A_PRODUCT.test(cleanProductName(l.name ?? "")))
        .reduce((n, l) => n + num(l.quantity), 0),
    0,
  );
  return {
    orders: sales.length,
    netSales,
    taxAndShipping: Math.max(0, total - netSales),
    refunds,
    refundedOrders: refunded.length,
    refundRate: sales.length
      ? Math.round((refunded.length / sales.length) * 100)
      : null,
    collected: Math.max(0, total - refunds),
    averageOrder: sales.length ? netSales / sales.length : null,
    units,
    unitsPerOrder: sales.length ? units / sales.length : null,
    largestOrder: sales.reduce((max, o) => Math.max(max, netOf(o)), 0),
    deposits: deposits.length,
    depositAmount: deposits.reduce((s, o) => s + num(o.total), 0),
  };
};

export interface TrendPoint {
  key: string;
  label: string;
  netSales: number;
  orders: number;
  /** The same bucket of the previous period, by position. */
  previousNetSales: number;
}

/** Net sales per day, week or month, with the previous period alongside. */
export const salesTrend = (
  orders: Order[],
  ranges: NumbersRanges,
): TrendPoint[] => {
  const total = (range: DateRange, bucket: Bucket) => {
    const sums = new Map<string, { net: number; count: number }>();
    for (const o of salesOrders(orders, range)) {
      const key = bucketKeyOf(o.ordered_at, bucket);
      const row = sums.get(key) ?? { net: 0, count: 0 };
      row.net += netOf(o);
      row.count += 1;
      sums.set(key, row);
    }
    return bucketKeys(range, bucket).map((key) => ({
      key,
      ...(sums.get(key) ?? { net: 0, count: 0 }),
    }));
  };
  const current = total(ranges.current, ranges.bucket);
  const previous = total(ranges.previous, ranges.bucket);
  return current.map((c, i) => ({
    key: c.key,
    label: bucketLabel(c.key, ranges.bucket),
    netSales: c.net,
    orders: c.count,
    previousNetSales: previous[i]?.net ?? 0,
  }));
};

export const FEES = "Fees & shop supplies";

export const lineCategory = (name: string): string => {
  if (NOT_A_PRODUCT.test(cleanProductName(name))) return FEES;
  return categorizeLines([name])[0] ?? "Other";
};

/**
 * Each line's share of its order's net sales, so that any grouping of lines
 * adds up to the net sales figure (discounts are spread over the lines).
 */
const linesWithNet = (
  o: Order,
): Array<{ line: OrderLineItem; net: number }> => {
  const lines = (o.line_items ?? []).filter((l) => l.name);
  const sum = lines.reduce((s, l) => s + lineValue(l), 0);
  const scale = sum > 0 ? netOf(o) / sum : 0;
  return lines.map((line) => ({ line, net: lineValue(line) * scale }));
};

export interface GroupRow {
  name: string;
  netSales: number;
  orders: number;
  units: number;
}

const group = (
  orders: Order[],
  range: DateRange,
  keyOf: (line: OrderLineItem) => string,
): GroupRow[] => {
  const rows = new Map<string, GroupRow>();
  for (const o of salesOrders(orders, range)) {
    const inThisOrder = new Set<string>();
    for (const { line, net } of linesWithNet(o)) {
      const name = keyOf(line);
      const row = rows.get(name) ?? { name, netSales: 0, orders: 0, units: 0 };
      row.netSales += net;
      if (!NOT_A_PRODUCT.test(cleanProductName(line.name)))
        row.units += num(line.quantity);
      if (!inThisOrder.has(name)) {
        inThisOrder.add(name);
        row.orders += 1;
      }
      rows.set(name, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.netSales - a.netSales || a.name.localeCompare(b.name),
  );
};

/** Net sales by kind of work or product (Detailing, Tint, Tuning, Diesel parts...). */
export const salesByCategory = (
  orders: Order[],
  range: DateRange,
): GroupRow[] => group(orders, range, (line) => lineCategory(line.name));

export interface ProductRow extends GroupRow {
  brand: string;
}

/** Net sales by product, with the brand from the catalog when it can be found. */
export const salesByProduct = (
  orders: Order[],
  range: DateRange,
  catalog: Package[],
): ProductRow[] => {
  const match = catalogMatcher(catalog);
  const brandOf = new Map<string, string>();
  const rows = group(orders, range, (line) => {
    const name = cleanProductName(line.name) || line.name;
    if (!brandOf.has(name))
      brandOf.set(name, match(line)?.vendor?.trim() || "");
    return name;
  });
  return rows
    .filter((r) => !NOT_A_PRODUCT.test(r.name))
    .map((r) => ({ ...r, brand: brandOf.get(r.name) ?? "" }));
};

/** Net sales by brand (vendor); products with no known brand are grouped together. */
export const salesByBrand = (products: ProductRow[]): GroupRow[] => {
  const brands = new Map<string, GroupRow>();
  for (const p of products) {
    const name = p.brand || "Brand not set";
    const row = brands.get(name) ?? { name, netSales: 0, orders: 0, units: 0 };
    row.netSales += p.netSales;
    row.units += p.units;
    // An order with two products of one brand is counted twice: a ceiling, not a count
    row.orders += p.orders;
    brands.set(name, row);
  }
  return [...brands.values()].sort((a, b) => b.netSales - a.netSales);
};

const CHANNEL_NAMES: Record<string, string> = {
  web: "Online store",
  pos: "In shop (POS)",
  shopify_draft_order: "Draft orders and pay links",
};

/** Where an order was placed, in the words used on the Numbers screen. */
export const channelName = (o: Order): string =>
  CHANNEL_NAMES[o.source ?? ""] ?? (o.source ? o.source : "Other");

/** Net sales by where the order was placed. */
export const salesByChannel = (
  orders: Order[],
  range: DateRange,
): GroupRow[] => {
  const rows = new Map<string, GroupRow>();
  for (const o of salesOrders(orders, range)) {
    const name = channelName(o);
    const row = rows.get(name) ?? { name, netSales: 0, orders: 0, units: 0 };
    row.netSales += netOf(o);
    row.orders += 1;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.netSales - a.netSales);
};

/** Adds the previous period's net sales for the same name, and the change. */
export const withPrevious = <T extends GroupRow>(
  current: T[],
  previous: GroupRow[],
): Array<T & { previousNetSales: number; change: number | null }> => {
  const before = new Map(previous.map((r) => [r.name, r.netSales]));
  return current.map((row) => {
    const previousNetSales = before.get(row.name) ?? 0;
    return {
      ...row,
      previousNetSales,
      change: percentChange(row.netSales, previousNetSales),
    };
  });
};
