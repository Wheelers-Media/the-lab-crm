// Goals for the home screen's rings: a monthly target for revenue, sales
// orders and new customers, scaled to the period on screen, with where the
// shop should be by now to hit it. Plain numbers in and out, so it is tested
// without a screen.
import type { MonthlyTargets } from "../root/ConfigurationContext";
import type { DateRange, Period } from "./shopTime";

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

/** How far through the period we are, 0 to 1. */
export const elapsedShare = (range: DateRange, now: Date): number => {
  const total = range.end.getTime() - range.start.getTime();
  if (total <= 0) return 1;
  return Math.min(
    1,
    Math.max(0, (now.getTime() - range.start.getTime()) / total),
  );
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
