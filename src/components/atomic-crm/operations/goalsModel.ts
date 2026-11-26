// Goals for the home screen's rings: a monthly target for revenue, sales
// orders and new customers, scaled to the period on screen, with where the
// shop should be by now to hit it. Plain numbers in and out, so it is tested
// without a screen.
import type { MonthlyTargets } from "../root/ConfigurationContext";
import type { Order } from "../types";
import {
  addDays,
  type DateRange,
  type Period,
  shopDayKey,
  startOfShopDay,
} from "./shopTime";

export type GoalKey = "revenue" | "orders" | "newCustomers";

/** A month is 52/12 weeks; a working day is one of the ~21.7 weekdays in it. */
const WEEKS_PER_MONTH = 52 / 12;
const WORKDAYS_PER_MONTH = (52 * 5) / 12;

/** The monthly target scaled to today, this week or this month. */
export const targetForPeriod = (monthly: number, period: Period): number =>
  period === "month"
    ? monthly
    : period === "week"
      ? monthly / WEEKS_PER_MONTH
      : monthly / WORKDAYS_PER_MONTH;

const DAY_MS = 86_400_000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isWeekend = (key: string) => {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/**
 * How far through the period we are, 0 to 1, counted in weekdays: the shop
 * is closed at weekends, and the week and day goals are weekday goals, so a
 * Monday morning is not "behind" for the Saturday and Sunday before it.
 * A single day is counted by the clock.
 */
export const elapsedShare = (range: DateRange, now: Date): number => {
  const start = range.start.getTime();
  const end = range.end.getTime();
  if (end <= start) return 1;
  const byClock = clamp01((now.getTime() - start) / (end - start));
  if (end - start <= 1.5 * DAY_MS) return byClock;
  let weekdays = 0;
  let done = 0;
  for (
    let key = shopDayKey(range.start);
    startOfShopDay(key).getTime() < end;
    key = addDays(key, 1)
  ) {
    if (isWeekend(key)) continue;
    const dayStart = startOfShopDay(key).getTime();
    const dayEnd = startOfShopDay(addDays(key, 1)).getTime();
    weekdays += 1;
    done += clamp01((now.getTime() - dayStart) / (dayEnd - dayStart));
  }
  return weekdays ? done / weekdays : byClock;
};

/** A round number a little above last month, as a starting suggestion. */
export const suggestTarget = (lastMonth: number, isMoney: boolean): number => {
  if (lastMonth <= 0) return isMoney ? 10_000 : 10;
  const goal = lastMonth * 1.1;
  const step = isMoney ? (goal >= 20_000 ? 1000 : 500) : goal >= 50 ? 5 : 1;
  return Math.ceil(goal / step) * step;
};

export interface GoalProgress {
  key: GoalKey;
  current: number;
  target: number;
  /** 0 to 1+, how much of the target is done. */
  progress: number;
  /** Where the shop should be by now to land on the target. */
  expectedByNow: number;
  /** current minus expected: positive is ahead of pace. */
  vsPace: number;
  status: "done" | "ahead" | "on-pace" | "behind";
  /** True when the target is a suggestion nobody has set yet. */
  suggested: boolean;
}

/** Within this share of the pace, it reads as on pace rather than ahead or behind. */
const PACE_TOLERANCE = 0.05;

export const goalProgress = (
  key: GoalKey,
  current: number,
  monthlyTarget: number,
  period: Period,
  elapsed: number,
  suggested: boolean,
): GoalProgress => {
  const target = targetForPeriod(monthlyTarget, period);
  const expectedByNow = target * elapsed;
  const vsPace = current - expectedByNow;
  const status: GoalProgress["status"] =
    current >= target
      ? "done"
      : Math.abs(vsPace) <= target * PACE_TOLERANCE
        ? "on-pace"
        : vsPace > 0
          ? "ahead"
          : "behind";
  return {
    key,
    current,
    target,
    progress: target > 0 ? current / target : 0,
    expectedByNow,
    vsPace,
    status,
    suggested,
  };
};

/** The saved monthly target, or a suggestion from last month's figure. */
export const monthlyTargets = (
  saved: MonthlyTargets | undefined,
  lastMonth: Record<GoalKey, number>,
): Record<GoalKey, { value: number; suggested: boolean }> => {
  const pick = (key: GoalKey, isMoney: boolean) => {
    const value = saved?.[key];
    return value && value > 0
      ? { value, suggested: false }
      : { value: suggestTarget(lastMonth[key], isMoney), suggested: true };
  };
  return {
    revenue: pick("revenue", true),
    orders: pick("orders", false),
    newCustomers: pick("newCustomers", false),
  };
};

export interface GoalCurves {
  /** Points on the axis: days of the period, or hours when the period is one day. */
  slots: number;
  /** Running total per goal up to now, one point per slot so far. */
  actual: Record<GoalKey, number[]>;
  /** Share of the period's target that should be done by the end of each slot, 0 to 1. */
  pace: number[];
}

/**
 * The shape of the period so far for each goal: what has been taken up to
 * each day (or hour), against where the weekday pace says it should be.
 */
export const goalCurves = (
  orders: Array<
    Pick<
      Order,
      | "ordered_at"
      | "contact_id"
      | "total"
      | "refunded_amount"
      | "is_deposit"
      | "cancelled_at"
    >
  >,
  firstOrderAt: Map<unknown, string>,
  range: DateRange,
  now: Date,
): GoalCurves => {
  const start = range.start.getTime();
  const spanMs = range.end.getTime() - start;
  const hourly = spanMs <= 1.5 * DAY_MS;
  const slotMs = hourly ? 3_600_000 : DAY_MS;
  const slots = Math.max(1, Math.round(spanMs / slotMs));
  const slotOf = (iso: string) =>
    Math.min(
      slots - 1,
      Math.max(0, Math.floor((new Date(iso).getTime() - start) / slotMs)),
    );
  const nowSlot = Math.min(
    slots - 1,
    Math.max(0, Math.floor((now.getTime() - start) / slotMs)),
  );
  const revenue = new Array<number>(slots).fill(0);
  const count = new Array<number>(slots).fill(0);
  const added = new Array<number>(slots).fill(0);
  const seen = new Set<unknown>();
  for (const o of [...orders].sort((a, b) =>
    a.ordered_at.localeCompare(b.ordered_at),
  )) {
    const at = new Date(o.ordered_at).getTime();
    if (
      o.cancelled_at ||
      o.is_deposit ||
      at < start ||
      at >= range.end.getTime()
    )
      continue;
    const i = slotOf(o.ordered_at);
    revenue[i] += Math.max(
      0,
      (Number(o.total) || 0) - (Number(o.refunded_amount) || 0),
    );
    count[i] += 1;
    const first = o.contact_id != null ? firstOrderAt.get(o.contact_id) : null;
    if (
      o.contact_id != null &&
      !seen.has(o.contact_id) &&
      first &&
      new Date(first).getTime() >= start
    ) {
      seen.add(o.contact_id);
      added[i] += 1;
    }
  }
  const running = (list: number[]) => {
    let sum = 0;
    return list.slice(0, nowSlot + 1).map((v) => (sum += v));
  };
  // Pace by weekdays, the way the rings count it: weekends add nothing
  const open: number[] = Array.from({ length: slots }, (_, i) => {
    if (hourly) return 1;
    return isWeekend(shopDayKey(new Date(start + i * slotMs + slotMs / 2)))
      ? 0
      : 1;
  });
  const total = open.reduce((a, b) => a + b, 0) || slots;
  let done = 0;
  const pace = open.map((w) => (done += w) / total);
  return {
    slots,
    actual: {
      revenue: running(revenue),
      orders: running(count),
      newCustomers: running(added),
    },
    pace,
  };
};
