// Patterns behind the Numbers screen: a metric you can switch, when customers
// buy, how big orders are, who is new, how the month is pacing and which
// payments are still open. Plain functions over plain records, like
// salesModel.ts, so every figure can be tested without a database.
import {
  addDays,
  type DateRange,
  formatShopDay,
  inRange,
  SHOP_TIME_ZONE,
  shopDayKey,
} from "../operations/shopTime";
import type { Order } from "../types";
import { customerLedger, type LedgerOrder } from "./customerModel";
import {
  addMonths,
  bucketKeyOf,
  bucketKeys,
  bucketLabel,
  daysBetween,
  firstOfMonth,
  type NumbersPeriod,
  type NumbersRanges,
} from "./periods";
import {
  channelName,
  lineCategory,
  netOf,
  salesOrders,
  unitsOf,
} from "./salesModel";

const num = (value: unknown): number => Number(value) || 0;

// ── The metric on the trend chart ──────────────────────────────────────────

export type SalesMetric = "netSales" | "orders" | "average" | "units";

export const SALES_METRICS: Array<{
  value: SalesMetric;
  label: string;
  money: boolean;
}> = [
  { value: "netSales", label: "Net sales", money: true },
  { value: "orders", label: "Orders", money: false },
  { value: "average", label: "Average order", money: true },
  { value: "units", label: "Units", money: false },
];

export const isSalesMetric = (value: string | null): value is SalesMetric =>
  SALES_METRICS.some((m) => m.value === value);

export interface MetricPoint {
  key: string;
  label: string;
  value: number;
  /** The same bucket of the previous period, by position. */
  previous: number;
  orders: number;
}

interface Totals {
  net: number;
  count: number;
  units: number;
}

const pick = (t: Totals, metric: SalesMetric): number => {
  if (metric === "netSales") return t.net;
  if (metric === "orders") return t.count;
  if (metric === "units") return t.units;
  return t.count ? t.net / t.count : 0;
};

const bucketTotals = (
  orders: Order[],
  range: DateRange,
  bucket: NumbersRanges["bucket"],
): Array<Totals & { key: string }> => {
  const sums = new Map<string, Totals>();
  for (const o of salesOrders(orders, range)) {
    const key = bucketKeyOf(o.ordered_at, bucket);
    const row = sums.get(key) ?? { net: 0, count: 0, units: 0 };
    row.net += netOf(o);
    row.count += 1;
    row.units += unitsOf(o);
    sums.set(key, row);
  }
  return bucketKeys(range, bucket).map((key) => ({
    key,
    ...(sums.get(key) ?? { net: 0, count: 0, units: 0 }),
  }));
};

/** The chosen metric per day, week or month, with the previous period beside it. */
export const metricTrend = (
  orders: Order[],
  ranges: NumbersRanges,
  metric: SalesMetric,
): MetricPoint[] => {
  const current = bucketTotals(orders, ranges.current, ranges.bucket);
  const previous = bucketTotals(orders, ranges.previous, ranges.bucket);
  return current.map((c, i) => ({
    key: c.key,
    label: bucketLabel(c.key, ranges.bucket),
    value: pick(c, metric),
    previous: previous[i] ? pick(previous[i], metric) : 0,
    orders: c.count,
  }));
};

/** The sales orders that fall in one bucket of the chart, newest first. */
export const ordersInBucket = (
  orders: Order[],
  ranges: NumbersRanges,
  key: string,
): Order[] =>
  salesOrders(orders, ranges.current)
    .filter((o) => bucketKeyOf(o.ordered_at, ranges.bucket) === key)
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));

// ── Cross-filter: one kind of work or one channel across the whole screen ──

export interface Segment {
  kind: "category" | "channel";
  value: string;
}

export const parseSegment = (raw: string | null): Segment | null => {
  if (!raw) return null;
  const at = raw.indexOf(":");
  if (at < 1) return null;
  const kind = raw.slice(0, at);
  const value = raw.slice(at + 1);
  if ((kind !== "category" && kind !== "channel") || !value) return null;
  return { kind, value };
};

export const segmentParam = (segment: Segment): string =>
  `${segment.kind}:${segment.value}`;

export const sameSegment = (a: Segment | null, b: Segment | null): boolean =>
  a?.kind === b?.kind && a?.value === b?.value;

export const segmentLabel = (segment: Segment): string =>
  segment.kind === "category"
    ? `Orders with ${segment.value}`
    : `${segment.value} orders`;

/** Whole orders: an order with Tint and Detailing lines is in both segments. */
export const inSegment = (order: Order, segment: Segment | null): boolean => {
  if (!segment) return true;
  if (segment.kind === "channel") return channelName(order) === segment.value;
  return (order.line_items ?? []).some(
    (l) => l.name && lineCategory(l.name) === segment.value,
  );
};

// ── When customers buy ─────────────────────────────────────────────────────

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Hours per column in the weekday grid. */
export const HOUR_BAND = 2;
const BANDS = 24 / HOUR_BAND;

const slotFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Weekday (0 = Monday) and hour of an order on the shop's clock. */
export const slotOf = (iso: string): { weekday: number; hour: number } => {
  const parts = slotFormatter.formatToParts(new Date(iso));
  const name = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { weekday: Math.max(0, WEEKDAY_NAMES.indexOf(name)), hour };
};

export interface HeatCell {
  weekday: number;
  band: number;
  orders: number;
  netSales: number;
}

export interface HeatGrid {
  cells: HeatCell[];
  max: number;
  busiest: HeatCell | null;
  bands: number;
}

export const weekdayHourGrid = (
  orders: Order[],
  range: DateRange,
): HeatGrid => {
  const cells: HeatCell[] = Array.from({ length: 7 * BANDS }, (_, i) => ({
    weekday: Math.floor(i / BANDS),
    band: i % BANDS,
    orders: 0,
    netSales: 0,
  }));
  for (const o of salesOrders(orders, range)) {
    const { weekday, hour } = slotOf(o.ordered_at);
    const cell = cells[weekday * BANDS + Math.floor(hour / HOUR_BAND)];
    cell.orders += 1;
    cell.netSales += netOf(o);
  }
  const max = cells.reduce((m, c) => Math.max(m, c.orders), 0);
  return {
    cells,
    max,
    busiest: max ? (cells.find((c) => c.orders === max) ?? null) : null,
    bands: BANDS,
  };
};

export const ordersInSlot = (
  orders: Order[],
  range: DateRange,
  weekday: number,
  band: number,
): Order[] =>
  salesOrders(orders, range)
    .filter((o) => {
      const slot = slotOf(o.ordered_at);
      return (
        slot.weekday === weekday && Math.floor(slot.hour / HOUR_BAND) === band
      );
    })
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));

const hourName = (hour: number): string => {
  const h = hour % 24;
  const suffix = h < 12 ? "a" : "p";
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
};

/** "10a to 12p" for a column of the grid. */
export const bandLabel = (band: number): string =>
  `${hourName(band * HOUR_BAND)} to ${hourName((band + 1) * HOUR_BAND)}`;

// ── Order size and payment status ──────────────────────────────────────────

export interface BandRow {
  label: string;
  orders: number;
  netSales: number;
  /** Whole percent of the period's orders. */
  share: number;
  list: Order[];
}

const BASKET_BANDS: Array<{ label: string; from: number; to: number }> = [
  { label: "Under $100", from: 0, to: 100 },
  { label: "$100 to $249", from: 100, to: 250 },
  { label: "$250 to $499", from: 250, to: 500 },
  { label: "$500 to $999", from: 500, to: 1000 },
  { label: "$1,000 and up", from: 1000, to: Infinity },
];

/** Orders grouped by their net value, smallest first. */
export const basketBands = (orders: Order[], range: DateRange): BandRow[] => {
  const sales = salesOrders(orders, range);
  return BASKET_BANDS.map(({ label, from, to }) => {
    const list = sales
      .filter((o) => netOf(o) >= from && netOf(o) < to)
      .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));
    return {
      label,
      orders: list.length,
      netSales: list.reduce((s, o) => s + netOf(o), 0),
      share: sales.length ? Math.round((list.length / sales.length) * 100) : 0,
      list,
    };
  });
};

export interface StatusRow {
  name: string;
  orders: number;
  /** What the customers were charged on these orders, tax and shipping included. */
  amount: number;
  /** True for the rows that need someone to act (money not yet in). */
  open: boolean;
  list: Order[];
}

const PAYMENT_NAMES: Array<{ status: string; name: string; open: boolean }> = [
  { status: "pending", name: "Awaiting payment", open: true },
  { status: "partially_paid", name: "Partly paid", open: true },
  { status: "authorized", name: "Authorized, not captured", open: true },
  { status: "paid", name: "Paid", open: false },
  { status: "partially_refunded", name: "Partly refunded", open: false },
  { status: "refunded", name: "Refunded", open: false },
  { status: "voided", name: "Voided", open: false },
];

/** Where each order stands on payment, open ones first. Booking deposits are left out. */
export const paymentStatus = (
  orders: Order[],
  range: DateRange,
): StatusRow[] => {
  const rows = new Map<string, StatusRow>();
  const add = (name: string, open: boolean, o: Order) => {
    const row = rows.get(name) ?? {
      name,
      orders: 0,
      amount: 0,
      open,
      list: [],
    };
    row.orders += 1;
    row.amount += num(o.total);
    row.list.push(o);
    rows.set(name, row);
  };
  for (const o of orders) {
    if (o.is_deposit || !inRange(o.ordered_at, range)) continue;
    if (o.cancelled_at) {
      add("Cancelled", false, o);
      continue;
    }
    const known = PAYMENT_NAMES.find((p) => p.status === o.financial_status);
    if (known) add(known.name, known.open, o);
    else if (o.financial_status)
      add(o.financial_status.replace(/_/g, " "), false, o);
  }
  const order = [...PAYMENT_NAMES.map((p) => p.name), "Cancelled"];
  return [...rows.values()]
    .map((r) => ({
      ...r,
      list: r.list.sort((a, b) => b.ordered_at.localeCompare(a.ordered_at)),
    }))
    .sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    });
};

// ── New and returning customers ────────────────────────────────────────────

export interface CustomerMixPoint {
  key: string;
  label: string;
  newCustomers: number;
  returning: number;
}

/**
 * Customers who ordered in each bucket, split by whether it was their first
 * order ever (new) or not (returning). In-shop sales with no customer attached
 * are not counted.
 */
export const newVsReturning = (
  ledgerOrders: LedgerOrder[],
  ranges: NumbersRanges,
): CustomerMixPoint[] => {
  const ledger = customerLedger(ledgerOrders);
  const buckets = new Map<
    string,
    { fresh: Set<unknown>; back: Set<unknown> }
  >();
  for (const o of ledgerOrders) {
    if (
      o.cancelled_at ||
      o.is_deposit ||
      o.contact_id == null ||
      !inRange(o.ordered_at, ranges.current)
    )
      continue;
    const key = bucketKeyOf(o.ordered_at, ranges.bucket);
    const first = ledger.get(o.contact_id)?.firstOrderAt;
    const isNew = first != null && bucketKeyOf(first, ranges.bucket) === key;
    const row = buckets.get(key) ?? { fresh: new Set(), back: new Set() };
    (isNew ? row.fresh : row.back).add(o.contact_id);
    buckets.set(key, row);
  }
  return bucketKeys(ranges.current, ranges.bucket).map((key) => {
    const row = buckets.get(key);
    return {
      key,
      label: bucketLabel(key, ranges.bucket),
      newCustomers: row?.fresh.size ?? 0,
      returning: row?.back.size ?? 0,
    };
  });
};

// ── How the month is pacing ────────────────────────────────────────────────

export interface PacePoint {
  key: string;
  label: string;
  /** Running net sales to the end of this day; null for days still to come. */
  current: number | null;
  /** Running net sales of the same day of the previous period. */
  previous: number;
}

export interface Pace {
  points: PacePoint[];
  soFar: number;
  previousToDate: number;
  previousTotal: number;
  /** At today's daily average; null once the period is over. */
  projected: number | null;
  daysElapsed: number;
  daysTotal: number;
}

const quarterStartOf = (today: string): string => {
  const month = Number(today.slice(5, 7));
  return `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
};

/**
 * Cumulative net sales through a running month, quarter or year against the
 * period before, with a straight-line projection. Rolling periods (last 30
 * days, last 12 months) and finished ones have no "pace".
 */
export const salesPace = (
  orders: Order[],
  period: NumbersPeriod,
  now: Date,
): Pace | null => {
  const today = shopDayKey(now);
  let startKey: string;
  let endKey: string;
  let previousStartKey: string;
  if (period === "month") {
    startKey = firstOfMonth(today);
    endKey = addMonths(startKey, 1);
    previousStartKey = addMonths(startKey, -1);
  } else if (period === "quarter") {
    startKey = quarterStartOf(today);
    endKey = addMonths(startKey, 3);
    previousStartKey = addMonths(startKey, -3);
  } else if (period === "ytd") {
    startKey = `${today.slice(0, 4)}-01-01`;
    endKey = `${Number(today.slice(0, 4)) + 1}-01-01`;
    previousStartKey = `${Number(today.slice(0, 4)) - 1}-01-01`;
  } else {
    return null;
  }
  const daysTotal = daysBetween(startKey, endKey);
  const daysElapsed = Math.min(daysTotal, daysBetween(startKey, today) + 1);
  const previousDays = daysBetween(previousStartKey, startKey);

  const daily = (from: string, days: number): number[] => {
    const sums = new Array<number>(days).fill(0);
    for (const o of orders) {
      if (o.cancelled_at || o.is_deposit) continue;
      const i = daysBetween(from, shopDayKey(o.ordered_at));
      if (i >= 0 && i < days) sums[i] += netOf(o);
    }
    return sums;
  };
  const current = daily(startKey, daysTotal);
  const previous = daily(previousStartKey, previousDays);

  let run = 0;
  let previousRun = 0;
  let previousToDate = 0;
  const points: PacePoint[] = [];
  for (let i = 0; i < daysTotal; i += 1) {
    const key = addDays(startKey, i);
    previousRun += previous[i] ?? 0;
    if (i < daysElapsed) {
      run += current[i];
      previousToDate = previousRun;
    }
    points.push({
      key,
      label: formatShopDay(key, { month: "short", day: "numeric" }),
      current: i < daysElapsed ? run : null,
      previous: previousRun,
    });
  }
  return {
    points,
    soFar: run,
    previousToDate,
    previousTotal: previous.reduce((s, n) => s + n, 0),
    projected:
      daysElapsed > 0 && daysElapsed < daysTotal
        ? (run / daysElapsed) * daysTotal
        : null,
    daysElapsed,
    daysTotal,
  };
};
