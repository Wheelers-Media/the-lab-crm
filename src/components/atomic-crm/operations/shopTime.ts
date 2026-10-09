// Date helpers pinned to the shop's clock (Fort St. John does not change
// clocks), so "today" and "this week" mean the same thing on every device.

export const SHOP_TIME_ZONE = "America/Dawson_Creek";

export type Period = "today" | "week" | "month";

export interface DateRange {
  start: Date;
  end: Date; // exclusive
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const shopParts = (date: Date): Record<string, number> => {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts;
};

/** Minutes the shop clock is ahead of UTC at this instant (negative in Canada). */
const offsetMinutes = (date: Date): number => {
  const p = shopParts(date);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
};

/** "2026-10-09" for the shop's calendar day containing this instant. */
export const shopDayKey = (date: Date | string): string => {
  const p = shopParts(typeof date === "string" ? new Date(date) : date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const keyToUtcMidnight = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** The instant the given shop day starts. */
export const startOfShopDay = (key: string): Date => {
  const guess = keyToUtcMidnight(key);
  return new Date(guess - offsetMinutes(new Date(guess)) * 60000);
};

export const addDays = (key: string, days: number): string => {
  const d = new Date(keyToUtcMidnight(key) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
};

/** Monday of the shop week containing the key. */
export const mondayOf = (key: string): string => {
  const weekday = new Date(keyToUtcMidnight(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, weekday === 0 ? -6 : 1 - weekday);
};

const firstOfMonth = (key: string): string => `${key.slice(0, 7)}-01`;

const addMonths = (key: string, months: number): string => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 10);
};

export const periodRange = (
  period: Period,
  now: Date = new Date(),
): DateRange => {
  const today = shopDayKey(now);
  if (period === "today") {
    return {
      start: startOfShopDay(today),
      end: startOfShopDay(addDays(today, 1)),
    };
  }
  if (period === "week") {
    const monday = mondayOf(today);
    return {
      start: startOfShopDay(monday),
      end: startOfShopDay(addDays(monday, 7)),
    };
  }
  const first = firstOfMonth(today);
  return {
    start: startOfShopDay(first),
    end: startOfShopDay(addMonths(first, 1)),
  };
};

/**
 * The same stretch of the period before, up to the same point in time, so a
 * month that is 9 days old is compared with the first 9 days of last month.
 */
export const previousPeriodRange = (
  period: Period,
  now: Date = new Date(),
): DateRange => {
  const current = periodRange(period, now);
  const startKey = shopDayKey(current.start);
  const prevStartKey =
    period === "today"
      ? addDays(startKey, -1)
      : period === "week"
        ? addDays(startKey, -7)
        : addMonths(startKey, -1);
  const start = startOfShopDay(prevStartKey);
  const elapsed = Math.min(
    now.getTime() - current.start.getTime(),
    current.start.getTime() - start.getTime(),
  );
  return { start, end: new Date(start.getTime() + elapsed) };
};

export const inRange = (
  iso: string | null | undefined,
  range: DateRange,
): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
};

export const formatShopTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

export const formatShopDay = (
  key: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
): string =>
  new Date(keyToUtcMidnight(key) + 12 * 3_600_000).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    ...options,
  });

/** Hour of the day (0-23) on the shop clock. */
export const shopHour = (date: Date = new Date()): number =>
  shopParts(date).hour;

export const greetingFor = (date: Date = new Date()): string => {
  const hour = shopHour(date);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};
