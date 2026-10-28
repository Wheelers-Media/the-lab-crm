// Numbers for the home dashboard, computed from plain records so they can be
// tested without a database.
import type { Appointment, Deal, Order, ShopifyCheckout } from "../types";
import {
  type DateRange,
  formatShopDay,
  inRange,
  shopDayKey,
  shopHour,
} from "./shopTime";

export const OPEN_STAGES = ["intake", "qualified", "quoted", "booked"];
export const BAY_SLOTS_PER_DAY = 2;
export const BIG_CART_THRESHOLD = 2000;

export interface BayLoad {
  booked: number;
  capacity: number;
  /** Drop-offs beyond what the bay takes, 0 when the day still fits. */
  over: number;
  /** "Bay 1/2", "Bay 2/2 full", "Bay 3/2 over by 1". */
  label: string;
}

/**
 * The bay takes two drop-offs a day. Counting carries on past that so an
 * overbooked day says so instead of looking merely full.
 */
export const bayLoad = (booked: number): BayLoad => {
  const capacity = BAY_SLOTS_PER_DAY;
  const over = Math.max(0, booked - capacity);
  const suffix = over ? ` over by ${over}` : booked >= capacity ? " full" : "";
  return {
    booked,
    capacity,
    over,
    label: `Bay ${booked}/${capacity}${suffix}`,
  };
};

const DAY_MS = 86_400_000;

/**
 * A sale: not cancelled and not a booking deposit. Deposits are credited
 * against the final bill, so counting them as well would count the job twice;
 * Home, Goals and Numbers all use this one definition.
 */
export const isSale = (
  o: Pick<Order, "cancelled_at" | "is_deposit">,
): boolean => !o.cancelled_at && !o.is_deposit;

const countedOrders = (orders: Order[], range: DateRange): Order[] =>
  orders.filter((o) => isSale(o) && inRange(o.ordered_at, range));

const netTotal = (o: Order): number =>
  Math.max(0, Number(o.total) - Number(o.refunded_amount ?? 0));

export const orderRevenue = (orders: Order[], range: DateRange): number =>
  countedOrders(orders, range).reduce((sum, o) => sum + netTotal(o), 0);

/** Booking deposits taken in the range: money held, not yet a sale. */
export const depositsHeld = (orders: Order[], range: DateRange): number =>
  orders
    .filter(
      (o) => !o.cancelled_at && o.is_deposit && inRange(o.ordered_at, range),
    )
    .reduce((sum, o) => sum + netTotal(o), 0);

export interface RevenueLinePoint {
  key: string;
  label: string;
  /** Net revenue from the start of the period to the end of this step. */
  value: number;
  /** The same running total, this far into the period before. */
  previous: number;
}

const HOUR_MS = 3_600_000;
/** The bay opens at 7, so an empty morning is not half a chart of nothing. */
const SHOP_OPEN_HOUR = 7;

/** "9a", "12p", "5p" — short enough for an axis under a phone-width chart. */
const hourLabel = (date: Date): string => {
  const hour = shopHour(date);
  return `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;
};

/**
 * Running net revenue across the period, with the same stretch of the period
 * before beside it, so "ahead of last month" is a line you can see rather than
 * a percentage you have to take on faith. Steps are hours for a single day and
 * shop days otherwise: a cumulative line only reads honestly over equal steps.
 * The last step is cut at `now` on both lines, so the two are compared at the
 * same point in the period rather than a part-day against a whole one.
 */
export const cumulativeRevenue = (
  orders: Order[],
  range: DateRange,
  previous: DateRange,
  now: Date,
  size: "hour" | "day" = "day",
): RevenueLinePoint[] => {
  const step = size === "hour" ? HOUR_MS : DAY_MS;
  const to = Math.min(range.end.getTime(), now.getTime());
  const sales = orders.filter(isSale);
  const between = (from: number, until: number): number =>
    sales.reduce((sum, o) => {
      const t = new Date(o.ordered_at).getTime();
      return t >= from && t < until ? sum + netTotal(o) : sum;
    }, 0);

  let from = range.start.getTime();
  if (size === "hour") {
    // Start at opening, or at the first sale if anything sold before opening.
    const first = sales
      .map((o) => new Date(o.ordered_at).getTime())
      .filter((t) => t >= from && t < to)
      .sort((a, b) => a - b)[0];
    const openHour =
      first == null
        ? SHOP_OPEN_HOUR
        : Math.min(SHOP_OPEN_HOUR, Math.floor((first - from) / HOUR_MS));
    from += Math.max(0, openHour) * HOUR_MS;
  }
  if (to <= from) return [];

  const points: RevenueLinePoint[] = [];
  let running = 0;
  let runningBefore = 0;
  for (let start = from; start < to; start += step) {
    const end = Math.min(start + step, to);
    const before = previous.start.getTime() + (start - from);
    running += between(start, end);
    runningBefore += between(before, before + (end - start));
    const key =
      size === "hour"
        ? new Date(start).toISOString()
        : shopDayKey(new Date(start));
    points.push({
      key,
      label:
        size === "hour"
          ? hourLabel(new Date(start))
          : formatShopDay(key, { day: "numeric" }),
      value: running,
      previous: runningBefore,
    });
  }
  return points;
};

/** Change between two values as a whole percentage, or null when there is no base. */
export const percentChange = (
  current: number,
  previous: number,
): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

export interface LeadStats {
  total: number;
  website: number;
  booked: number; // reached Booked or Converted
  conversion: number | null; // booked / total, whole percent
}

export const leadStats = (deals: Deal[], range: DateRange): LeadStats => {
  const leads = deals.filter((d) => inRange(d.created_at, range));
  const booked = leads.filter(
    (d) => d.stage === "booked" || d.stage === "won",
  ).length;
  return {
    total: leads.length,
    website: leads.filter((d) => d.lead_source === "website").length,
    booked,
    conversion: leads.length ? Math.round((booked / leads.length) * 100) : null,
  };
};

export const openPipeline = (
  deals: Deal[],
): { amount: number; count: number } => {
  const open = deals.filter(
    (d) => OPEN_STAGES.includes(d.stage) && !d.archived_at,
  );
  return {
    amount: open.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    count: open.length,
  };
};

export const activeAppointments = (
  appointments: Appointment[],
): Appointment[] =>
  appointments.filter((a) => a.status === "booked" || a.status === "completed");

export interface DayLoad {
  key: string;
  bay: number;
  eric: number;
}

export const dayLoads = (
  appointments: Appointment[],
  keys: string[],
): DayLoad[] =>
  keys.map((key) => {
    const day = activeAppointments(appointments).filter(
      (a) => shopDayKey(a.start_at) === key,
    );
    return {
      key,
      bay: day.filter((a) => a.resource === "detailing-bay").length,
      eric: day.filter((a) => a.resource === "eric").length,
    };
  });

export interface CartStats {
  started: number;
  completed: number;
  abandoned: number;
  abandonedValue: number;
  completionRate: number | null; // completed / started, whole percent
}

/** Checkouts last touched in the period; open ones under an hour old are still in progress and left out. */
export const cartStats = (
  checkouts: ShopifyCheckout[],
  range: DateRange,
  now: Date = new Date(),
): CartStats => {
  const settled = checkouts.filter(
    (c) =>
      inRange(c.checkout_updated_at, range) &&
      (c.completed_at ||
        now.getTime() - new Date(c.checkout_updated_at).getTime() > 3_600_000),
  );
  const open = settled.filter((c) => !c.completed_at);
  const completed = settled.length - open.length;
  return {
    started: settled.length,
    completed,
    abandoned: open.length,
    abandonedValue: open.reduce((s, c) => s + Number(c.total), 0),
    completionRate: settled.length
      ? Math.round((completed / settled.length) * 100)
      : null,
  };
};

// Fees and adjustments that are not products
export const NOT_A_PRODUCT =
  /^(shop supplies.*|mechanical shop supplies|shipping.*|duty fees.*|tip|custom sale|test amount)$/i;

export const cleanProductName = (name: string): string =>
  name
    // "Universal Fit - THE LAB - X", "Universal Fit - Suntek - X", "Universal – X"
    .replace(/^Universal(?: Fit)?\s*[-–]\s*(?:THE LAB\s*[-–]\s*)?/i, "")
    .trim();
