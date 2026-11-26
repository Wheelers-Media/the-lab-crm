// Where the month (or week) will end if the shop keeps trading at this pace.
// The pace is counted in working days, because the shop is closed at weekends:
// a Monday is not "behind" for the Saturday and Sunday before it. Two paces are
// worked out, the whole period so far and the last seven days, and the
// projection is the whole-period pace with the range running between the two.
// Plain numbers in and out, so every figure can be tested without a screen.
import {
  addDays,
  shopDayKey,
  startOfShopDay,
  type DateRange,
} from "./shopTime";

const DAY_MS = 86_400_000;
const RECENT_DAYS = 7;

const isWeekend = (key: string): boolean => {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

/** Working days (Monday to Friday) between two moments, a part-day counted as a part. */
export const workdaysBetween = (from: Date, to: Date): number => {
  if (to.getTime() <= from.getTime()) return 0;
  let days = 0;
  for (
    let key = shopDayKey(from);
    startOfShopDay(key).getTime() < to.getTime();
    key = addDays(key, 1)
  ) {
    if (isWeekend(key)) continue;
    const dayStart = startOfShopDay(key).getTime();
    const dayEnd = startOfShopDay(addDays(key, 1)).getTime();
    const start = Math.max(dayStart, from.getTime());
    const end = Math.min(dayEnd, to.getTime());
    days += Math.max(0, end - start) / (dayEnd - dayStart);
  }
  return days;
};

export type Confidence = "early" | "fair" | "solid";

export interface Projection {
  current: number;
  /** Where the period ends at the pace of the whole period so far. */
  projected: number;
  /** The lower and higher of the whole-period pace and the last seven days' pace. */
  low: number;
  high: number;
  workdaysDone: number;
  workdaysLeft: number;
  /** "early" under three working days in: a guess, and the screen says so. */
  confidence: Confidence;
  /** The period is over (or has no working days left): nothing left to project. */
  final: boolean;
}

/** Whether a period is still running, so there is something to project. */
export const isInProgress = (range: DateRange, now: Date): boolean =>
  now.getTime() >= range.start.getTime() && now.getTime() < range.end.getTime();

/**
 * Project a running total to the end of the period. `current` is the total so
 * far; `recent` is the total over the last seven days (null when unknown, then
 * the range collapses to the one pace).
 */
export const project = (
  current: number,
  recent: number | null,
  range: DateRange,
  now: Date,
): Projection => {
  const done = workdaysBetween(
    range.start,
    new Date(Math.min(now.getTime(), range.end.getTime())),
  );
  const total = workdaysBetween(range.start, range.end);
  const left = Math.max(0, total - done);
  if (left < 0.01 || done <= 0) {
    return {
      current,
      projected: current,
      low: current,
      high: current,
      workdaysDone: done,
      workdaysLeft: left,
      confidence: "solid",
      final: left < 0.01,
    };
  }
  const windowStart = new Date(
    Math.max(range.start.getTime(), now.getTime() - RECENT_DAYS * DAY_MS),
  );
  const recentDays = workdaysBetween(windowStart, now);
  const avgRate = current / done;
  const recentRate =
    recent != null && recentDays >= 2 ? recent / recentDays : avgRate;
  const byAverage = current + avgRate * left;
  const byRecent = current + recentRate * left;
  return {
    current,
    projected: byAverage,
    low: Math.min(byAverage, byRecent),
    high: Math.max(byAverage, byRecent),
    workdaysDone: done,
    workdaysLeft: left,
    confidence: done < 3 ? "early" : done < 8 ? "fair" : "solid",
    final: false,
  };
};

/** Project a sum of records (orders, jobs, carts) dated inside the period. */
export const projectRecords = <T>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  valueOf: (item: T) => number,
  range: DateRange,
  now: Date,
): Projection => {
  const windowStart = now.getTime() - RECENT_DAYS * DAY_MS;
  let current = 0;
  let recent = 0;
  for (const item of items) {
    const at = dateOf(item);
    if (!at) continue;
    const t = new Date(at).getTime();
    if (
      t < range.start.getTime() ||
      t >= range.end.getTime() ||
      t > now.getTime()
    )
      continue;
    const v = valueOf(item);
    current += v;
    if (t >= windowStart) recent += v;
  }
  return project(current, recent, range, now);
};

export interface Landing {
  /** Projected total as a whole percent of the target. */
  percent: number;
  /** Projected total less the target: positive is a surplus. */
  gap: number;
  /** What each remaining working day must bring to reach the target. */
  perDayNeeded: number;
  /** What the shop is averaging per working day so far. */
  perDayNow: number;
  hits: boolean;
}

/** How the projection compares with a goal, and the daily pace that would reach it. */
export const landing = (p: Projection, target: number): Landing => ({
  percent: target > 0 ? Math.round((p.projected / target) * 100) : 0,
  gap: p.projected - target,
  perDayNeeded:
    p.workdaysLeft > 0 ? Math.max(0, (target - p.current) / p.workdaysLeft) : 0,
  perDayNow: p.workdaysDone > 0 ? p.current / p.workdaysDone : 0,
  hits: p.projected >= target,
});

/** "$14.2k" style short money for a sentence. */
export const shortMoney = (n: number): string =>
  Math.abs(n) >= 10_000
    ? `$${Math.round(n / 1000)}k`
    : Math.abs(n) >= 1000
      ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : `$${Math.round(n)}`;

/** The sentence for a tile: "On pace for $14.2k by month end". */
export const paceSentence = (
  p: Projection,
  format: (n: number) => string,
  endsAt = "month end",
): string | null => {
  if (p.final) return null;
  const text = `${format(p.projected)} by ${endsAt}`;
  return p.confidence === "early"
    ? `Early guess: ${text}`
    : `On pace for ${text}`;
};

/** "$12.8k to $15.1k" when the two paces differ enough to matter, else null. */
export const paceRange = (
  p: Projection,
  format: (n: number) => string,
): string | null => {
  if (p.final || p.confidence === "early") return null;
  const spread = p.high - p.low;
  if (spread < Math.max(1, p.projected * 0.05)) return null;
  return `${format(p.low)} to ${format(p.high)}`;
};
