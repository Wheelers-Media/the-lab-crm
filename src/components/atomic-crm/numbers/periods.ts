// The periods on the Numbers screen and the stretch before each one, on the
// shop's calendar, so every number can be compared with the same stretch of
// the period before.
import {
  addDays,
  type DateRange,
  formatShopDay,
  mondayOf,
  shopDayKey,
  startOfShopDay,
} from "../operations/shopTime";

export type NumbersPeriod =
  | "month"
  | "last-month"
  | "30d"
  | "quarter"
  | "ytd"
  | "12m";

/** How the trend chart groups time. */
export type Bucket = "day" | "week" | "month";

export const NUMBERS_PERIODS: Array<{
  value: NumbersPeriod;
  label: string;
  vs: string;
}> = [
  { value: "month", label: "This month", vs: "vs last month" },
  { value: "last-month", label: "Last month", vs: "vs the month before" },
  { value: "30d", label: "Last 30 days", vs: "vs the 30 days before" },
  { value: "quarter", label: "This quarter", vs: "vs last quarter" },
  { value: "ytd", label: "Year to date", vs: "vs last year" },
  { value: "12m", label: "Last 12 months", vs: "vs the 12 months before" },
];

export interface NumbersRanges {
  current: DateRange;
  previous: DateRange;
  bucket: Bucket;
}

const utcMidnight = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const daysBetween = (fromKey: string, toKey: string): number =>
  Math.round((utcMidnight(toKey) - utcMidnight(fromKey)) / 86_400_000);

export const firstOfMonth = (key: string): string => `${key.slice(0, 7)}-01`;

export const addMonths = (key: string, months: number): string => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
};

const range = (startKey: string, endKey: string): DateRange => ({
  start: startOfShopDay(startKey),
  end: startOfShopDay(endKey),
});

/**
 * The period to report on and the stretch to compare it with. A period that
 * is still running is compared with the same number of days before it.
 */
export const numbersRanges = (
  period: NumbersPeriod,
  now: Date = new Date(),
): NumbersRanges => {
  const today = shopDayKey(now);
  const tomorrow = addDays(today, 1);

  if (period === "month") {
    const monthStart = firstOfMonth(today);
    const previousStart = addMonths(monthStart, -1);
    const previousEnd = addDays(
      previousStart,
      daysBetween(monthStart, tomorrow),
    );
    return {
      current: range(monthStart, tomorrow),
      previous: range(
        previousStart,
        previousEnd > monthStart ? monthStart : previousEnd,
      ),
      bucket: "day",
    };
  }
  if (period === "last-month") {
    const thisMonth = firstOfMonth(today);
    const lastMonth = addMonths(thisMonth, -1);
    return {
      current: range(lastMonth, thisMonth),
      previous: range(addMonths(thisMonth, -2), lastMonth),
      bucket: "day",
    };
  }
  if (period === "30d") {
    const start = addDays(today, -29);
    return {
      current: range(start, tomorrow),
      previous: range(addDays(start, -30), start),
      bucket: "day",
    };
  }
  if (period === "quarter") {
    const month = Number(today.slice(5, 7));
    const quarterStart = `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
    const previousStart = addMonths(quarterStart, -3);
    const elapsed = daysBetween(quarterStart, tomorrow);
    const previousEnd = addDays(previousStart, elapsed);
    return {
      current: range(quarterStart, tomorrow),
      previous: range(
        previousStart,
        previousEnd > quarterStart ? quarterStart : previousEnd,
      ),
      bucket: "week",
    };
  }
  if (period === "ytd") {
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const previousStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
    const previousEnd = addDays(
      previousStart,
      daysBetween(yearStart, tomorrow),
    );
    return {
      current: range(yearStart, tomorrow),
      previous: range(
        previousStart,
        previousEnd > yearStart ? yearStart : previousEnd,
      ),
      bucket: "month",
    };
  }
  const start = addMonths(firstOfMonth(today), -11);
  return {
    current: range(start, tomorrow),
    previous: range(addMonths(start, -12), start),
    bucket: "month",
  };
};

/** The bucket a moment falls in: a shop day, the Monday of its week, or "2026-10". */
export const bucketKeyOf = (when: Date | string, bucket: Bucket): string => {
  const day = shopDayKey(when);
  if (bucket === "day") return day;
  if (bucket === "week") return mondayOf(day);
  return day.slice(0, 7);
};

/** Every bucket from the start of the range to its end, in order, none skipped. */
export const bucketKeys = (r: DateRange, bucket: Bucket): string[] => {
  const keys: string[] = [];
  const endKey = shopDayKey(new Date(r.end.getTime() - 1));
  for (let day = shopDayKey(r.start); day <= endKey; day = addDays(day, 1)) {
    const key =
      bucket === "day"
        ? day
        : bucket === "week"
          ? mondayOf(day)
          : day.slice(0, 7);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
};

export const bucketLabel = (key: string, bucket: Bucket): string => {
  if (bucket === "month")
    return formatShopDay(`${key}-01`, { month: "short", year: "2-digit" });
  return formatShopDay(key, { month: "short", day: "numeric" });
};
