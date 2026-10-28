// Trends for the home screen: how this period compares with the ones before
// it, where the money comes from week by week, and which services are moving.
// Plain records in, numbers out, so every figure can be tested without a
// database.
import type { Identifier } from "ra-core";

import { customerLedger, type LedgerOrder } from "../numbers/customerModel";
import { cleanPurchaseName } from "../shop/purchasesModel";
import type { Appointment, Deal, Order } from "../types";
import { BAY_SLOTS_PER_DAY, NOT_A_PRODUCT, percentChange } from "./metrics";
import { lineRevenueKind } from "./serviceKinds";
import {
  addDays,
  type DateRange,
  inRange,
  mondayOf,
  type Period,
  periodRange,
  previousPeriodRange,
  shopDayKey,
  startOfShopDay,
} from "./shopTime";

const DAY_MS = 86_400_000;

const num = (value: unknown): number => Number(value) || 0;
const net = (o: Pick<Order, "total" | "refunded_amount">): number =>
  Math.max(0, num(o.total) - num(o.refunded_amount));
const isSale = (o: Pick<Order, "cancelled_at" | "is_deposit">): boolean =>
  !o.cancelled_at && !o.is_deposit;

/** A shop day near the middle of the period that starts at this key. */
const noonOf = (key: string): Date =>
  new Date(startOfShopDay(key).getTime() + 12 * 3_600_000);

const firstOfMonth = (key: string): string => `${key.slice(0, 7)}-01`;
const shiftMonths = (key: string, months: number): string => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
};

/**
 * The last `count` periods, oldest first. The last one is the period in
 * progress, cut at `now`, so its bar or point is what has happened so far.
 */
export const periodBuckets = (
  period: Period,
  now: Date,
  count: number,
): DateRange[] => {
  const today = shopDayKey(now);
  const keys = Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    if (period === "today") return addDays(today, -back);
    if (period === "week") return addDays(mondayOf(today), -7 * back);
    return shiftMonths(firstOfMonth(today), -back);
  });
  return keys.map((key, i) => {
    const range = periodRange(period, noonOf(key));
    return i === keys.length - 1
      ? {
          start: range.start,
          end: new Date(Math.min(range.end.getTime(), now.getTime())),
        }
      : range;
  });
};

/** Monday to Friday days in the range, the bay's working days. */
const workdays = (range: DateRange): number => {
  let days = 0;
  for (
    let key = shopDayKey(range.start);
    startOfShopDay(key).getTime() < range.end.getTime();
    key = addDays(key, 1)
  ) {
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
};

export interface PeriodFigures {
  revenue: number;
  salesOrders: number;
  averageTicket: number | null;
  newCustomers: number;
  returningCustomers: number;
  leads: number;
  /** Leads created in the period that reached Booked or Converted. */
  bookedLeads: number;
  /** Drop-offs in the bay against its slots, whole percent. */
  bayUse: number | null;
}

export interface TrendInput {
  orders: Order[];
  /** Every order ever, for "first order" (new customer) tests. */
  ledgerOrders: LedgerOrder[];
  deals: Deal[];
  appointments: Appointment[];
}

export const periodFigures = (
  { orders, deals, appointments }: Omit<TrendInput, "ledgerOrders">,
  firstOrderAt: Map<Identifier, string>,
  range: DateRange,
): PeriodFigures => {
  const inPeriod = orders.filter(
    (o) => !o.cancelled_at && inRange(o.ordered_at, range),
  );
  const sales = inPeriod.filter((o) => !o.is_deposit);
  const salesTotal = sales.reduce((s, o) => s + net(o), 0);
  const customers = new Set(
    sales.map((o) => o.contact_id).filter((id) => id != null),
  );
  const isNew = (id: Identifier) => inRange(firstOrderAt.get(id), range);
  const newCustomers = [...customers].filter(isNew).length;
  const leads = deals.filter((d) => inRange(d.created_at, range));
  const slots = workdays(range) * BAY_SLOTS_PER_DAY;
  const dropOffs = appointments.filter(
    (a) =>
      a.resource === "detailing-bay" &&
      (a.status === "booked" || a.status === "completed") &&
      inRange(a.start_at, range),
  ).length;
  return {
    revenue: inPeriod.reduce((s, o) => s + net(o), 0),
    salesOrders: sales.length,
    averageTicket: sales.length ? salesTotal / sales.length : null,
    newCustomers,
    returningCustomers: customers.size - newCustomers,
    leads: leads.length,
    bookedLeads: leads.filter((d) => d.stage === "booked" || d.stage === "won")
      .length,
    bayUse: slots ? Math.round((dropOffs / slots) * 100) : null,
  };
};

export interface Trends {
  /** One set of figures per bucket, oldest first; the last is this period so far. */
  series: PeriodFigures[];
  current: PeriodFigures;
  /** The period before, up to the same point. */
  previous: PeriodFigures;
}

export const trends = (
  input: TrendInput,
  period: Period,
  now: Date,
  count = 8,
): Trends => {
  const ledger = customerLedger(input.ledgerOrders);
  const firstOrderAt = new Map(
    [...ledger.values()].map((row) => [row.contactId, row.firstOrderAt]),
  );
  const buckets = periodBuckets(period, now, count);
  return {
    series: buckets.map((range) => periodFigures(input, firstOrderAt, range)),
    current: periodFigures(input, firstOrderAt, buckets[buckets.length - 1]),
    previous: periodFigures(
      input,
      firstOrderAt,
      previousPeriodRange(period, now),
    ),
  };
};

/** Change against the period before, or null when there is no base to compare. */
export const changeOf = (
  current: number | null,
  previous: number | null,
): number | null =>
  current == null || previous == null ? null : percentChange(current, previous);

// ---------------------------------------------------------------------------
// Where the money comes from

export type MixGroup = "detail" | "tint" | "parts" | "lighting" | "other";

export const MIX_GROUPS: Array<{ key: MixGroup; label: string }> = [
  { key: "detail", label: "Detailing" },
  { key: "tint", label: "Tint" },
  { key: "lighting", label: "Lighting and installs" },
  { key: "parts", label: "Parts and tuning" },
  { key: "other", label: "Other" },
];

const groupOf = (
  line: Order["line_items"][number],
  order: Order,
): MixGroup | null => {
  const name = cleanPurchaseName(line.name ?? "");
  if (!name || NOT_A_PRODUCT.test(name)) return null;
  const kind = lineRevenueKind(line, order);
  if (kind === "detail" || kind === "membership") return "detail";
  if (kind === "tint") return "tint";
  if (kind === "parts" || kind === "tune") return "parts";
  if (kind === "lighting") return "lighting";
  return "other";
};

export interface MixWeek {
  key: string;
  label: string;
  /** True for the week in progress. */
  partial: boolean;
  total: number;
  groups: Record<MixGroup, number>;
}

const emptyGroups = (): Record<MixGroup, number> => ({
  detail: 0,
  tint: 0,
  parts: 0,
  lighting: 0,
  other: 0,
});

/**
 * Sales by kind of work, week by week. Each line takes its share of the
 * order's net total, so refunds come off and fees and shipping are spread
 * over the real work. Booking deposits are left out: the deposit is credited
 * to the final invoice, which is where the work is counted.
 */
export const weeklyMix = (
  orders: Order[],
  now: Date,
  weeks = 12,
): MixWeek[] => {
  const ranges = periodBuckets("week", now, weeks);
  const rows: MixWeek[] = ranges.map((range, i) => {
    const key = shopDayKey(range.start);
    return {
      key,
      label: new Date(`${key}T12:00:00Z`).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }),
      partial: i === ranges.length - 1,
      total: 0,
      groups: emptyGroups(),
    };
  });
  for (const order of orders) {
    if (!isSale(order) || (order.currency ?? "CAD") !== "CAD") continue;
    const index = ranges.findIndex((r) => inRange(order.ordered_at, r));
    if (index < 0) continue;
    const lines = (order.line_items ?? [])
      .map((line) => ({
        group: groupOf(line, order),
        gross: num(line.price) * num(line.quantity),
      }))
      .filter((l) => l.group != null && l.gross > 0);
    const gross = lines.reduce((s, l) => s + l.gross, 0);
    const total = net(order);
    const row = rows[index];
    if (!gross) {
      row.groups.other += total;
    } else {
      for (const line of lines) {
        row.groups[line.group as MixGroup] += (line.gross / gross) * total;
      }
    }
    row.total += total;
  }
  return rows;
};

export interface MixShare {
  key: MixGroup;
  label: string;
  amount: number;
  /** Whole percent of the total. */
  share: number;
}

/** Each group's total over the weeks shown, biggest first, empty ones left out. */
export const mixTotals = (weeks: MixWeek[]): MixShare[] => {
  const all = weeks.reduce((s, w) => s + w.total, 0);
  return MIX_GROUPS.map(({ key, label }) => {
    const amount = weeks.reduce((s, w) => s + w.groups[key], 0);
    return {
      key,
      label,
      amount,
      share: all ? Math.round((amount / all) * 100) : 0,
    };
  })
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount);
};

// ---------------------------------------------------------------------------
// What is moving

export interface Mover {
  name: string;
  revenue: number;
  previous: number;
  units: number;
  /** Whole percent, or null when it did not sell at all before. */
  change: number | null;
}

const productRevenue = (orders: Order[], range: DateRange) => {
  const byName = new Map<
    string,
    { name: string; revenue: number; units: number }
  >();
  for (const order of orders) {
    if (!isSale(order) || !inRange(order.ordered_at, range)) continue;
    const lines = order.line_items ?? [];
    const gross = lines.reduce((s, l) => s + num(l.price) * num(l.quantity), 0);
    if (!gross) continue;
    const scale = net(order) / gross;
    for (const line of lines) {
      const name = cleanPurchaseName(line.name ?? "");
      if (!name || NOT_A_PRODUCT.test(name)) continue;
      const key = name.toLowerCase();
      const row = byName.get(key) ?? { name, revenue: 0, units: 0 };
      row.revenue += num(line.price) * num(line.quantity) * scale;
      row.units += num(line.quantity);
      byName.set(key, row);
    }
  }
  return byName;
};

/**
 * The services and products whose sales changed most against the same point
 * in the period before, by dollars rather than percent, so a $70 add-on that
 * doubled does not outrank a ceramic tint that grew by $2,000.
 */
export const movers = (
  orders: Order[],
  range: DateRange,
  previous: DateRange,
  limit = 6,
): Mover[] => {
  const now = productRevenue(orders, range);
  const before = productRevenue(orders, previous);
  const names = new Set([...now.keys(), ...before.keys()]);
  return [...names]
    .map((key) => {
      const current = now.get(key);
      const past = before.get(key);
      const revenue = current?.revenue ?? 0;
      const prior = past?.revenue ?? 0;
      return {
        name: current?.name ?? past!.name,
        revenue,
        previous: prior,
        units: current?.units ?? 0,
        change: percentChange(revenue, prior),
      };
    })
    .filter((m) => Math.round(m.revenue - m.previous) !== 0)
    .sort(
      (a, b) =>
        Math.abs(b.revenue - b.previous) - Math.abs(a.revenue - a.previous) ||
        b.revenue - a.revenue,
    )
    .slice(0, limit);
};

/** How far back the trends reach, so the data can be fetched once. */
export const trendsStart = (period: Period, now: Date): Date => {
  const buckets = periodBuckets(period, now, 8);
  const mix = periodBuckets("week", now, 12);
  const previous = previousPeriodRange(period, now);
  return new Date(
    Math.min(
      buckets[0].start.getTime(),
      mix[0].start.getTime(),
      previous.start.getTime(),
      now.getTime() - 7 * DAY_MS,
    ),
  );
};
