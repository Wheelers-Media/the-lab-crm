// What traffic_sync asks Shopify's reports for (ShopifyQL over the online
// store's sessions) and how the answer becomes shop_traffic_daily rows. No
// network or database in here, so the parsing can be tested on its own.

/** One row of shop_traffic_daily. */
export interface TrafficDayRow {
  /** The shop's calendar day, "2026-10-05". */
  day: string;
  referrer_source: string;
  referrer_name: string;
  device_type: string;
  sessions: number;
  cart_sessions: number;
  checkout_sessions: number;
  completed_sessions: number;
}

/** Days one query covers; the end day counts. */
export const WINDOW_DAYS = 92;
/** Rows asked for per page of a query. */
export const PAGE_ROWS = 1000;
/** How far back the first sync reaches: the Numbers screen compares 12 months with the 12 before. */
export const BACKFILL_DAYS = 760;

const METRICS =
  "sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout";

/**
 * The ShopifyQL for one window and page. Window 0 ends today, window 1 is the
 * 92 days before it, and so on, so no date has to be worked out on our side
 * (Shopify reads "-92d" on the store's calendar). The sort is total, so paging
 * with OFFSET never repeats or skips a row.
 */
export const trafficQuery = (window: number, offset: number): string => {
  const until = window === 0 ? "today" : `-${window * WINDOW_DAYS}d`;
  const since = `-${window * WINDOW_DAYS + WINDOW_DAYS - 1}d`;
  return [
    "FROM sessions",
    `SHOW ${METRICS}`,
    "GROUP BY day, referrer_source, referrer_name, session_device_type",
    `SINCE ${since} UNTIL ${until}`,
    "ORDER BY day ASC, referrer_source ASC, referrer_name ASC, session_device_type ASC",
    `LIMIT ${PAGE_ROWS} OFFSET ${offset}`,
  ].join(" ");
};

/** How many days back to ask for: everything the first time, else a week before the newest day held. */
export const daysToSync = (newestDay: string | null, now: Date): number => {
  if (!newestDay) return BACKFILL_DAYS;
  const held = Date.parse(`${newestDay}T00:00:00Z`);
  if (Number.isNaN(held)) return BACKFILL_DAYS;
  const gap = Math.max(0, Math.ceil((now.getTime() - held) / 86_400_000));
  return Math.min(BACKFILL_DAYS, gap + 7);
};

export const windowsFor = (days: number): number =>
  Math.max(1, Math.ceil(days / WINDOW_DAYS));

interface TableData {
  columns?: Array<{ name?: string | null }> | null;
  rows?: unknown[] | null;
}

const count = (value: unknown): number =>
  Math.max(0, Math.round(Number(value) || 0));
const label = (value: unknown): string =>
  value == null ? "" : String(value).trim();

/**
 * Shopify's table as rows for the database. Each row arrives as an object
 * keyed by column or as an array in column order; counts arrive as text.
 * Rows that land on the same key are added together, because one upsert
 * cannot touch a row twice.
 */
export const parseTrafficRows = (
  table: TableData | null | undefined,
): TrafficDayRow[] => {
  const names = (table?.columns ?? []).map((c) => c?.name ?? "");
  const merged = new Map<string, TrafficDayRow>();
  for (const raw of table?.rows ?? []) {
    const row: Record<string, unknown> = Array.isArray(raw)
      ? Object.fromEntries(names.map((name, i) => [name, raw[i]]))
      : ((raw ?? {}) as Record<string, unknown>);
    const day = label(row.day).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const next: TrafficDayRow = {
      day,
      referrer_source: label(row.referrer_source),
      referrer_name: label(row.referrer_name),
      device_type: label(row.session_device_type),
      sessions: count(row.sessions),
      cart_sessions: count(row.sessions_with_cart_additions),
      checkout_sessions: count(row.sessions_that_reached_checkout),
      completed_sessions: count(row.sessions_that_completed_checkout),
    };
    const key = [
      next.day,
      next.referrer_source,
      next.referrer_name,
      next.device_type,
    ].join("|");
    const seen = merged.get(key);
    if (seen) {
      seen.sessions += next.sessions;
      seen.cart_sessions += next.cart_sessions;
      seen.checkout_sessions += next.checkout_sessions;
      seen.completed_sessions += next.completed_sessions;
    } else {
      merged.set(key, next);
    }
  }
  return [...merged.values()];
};
