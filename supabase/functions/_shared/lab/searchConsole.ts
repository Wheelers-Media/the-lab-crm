// Google Search Console for the shop's website: which property to read, which
// days to ask for, and turning Google's rows into the CRM's tables. Plain
// functions, so they are tested without Google.

export const SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

/** The shop's website, as Search Console names it. */
export const SHOP_DOMAIN = "thelabfsj.ca";

/** Google keeps 16 months; the first copy takes this much of it. */
export const DAILY_HISTORY_DAYS = 480;
/** Search phrases and pages per day are many more rows: a shorter first copy. */
export const DETAIL_HISTORY_DAYS = 180;
/** Google revises its last few days, so every copy reaches back this far. */
export const REVISE_DAYS = 4;
/** Google's largest page of rows. */
export const PAGE_ROWS = 25_000;

const DAY_MS = 86_400_000;

export type SiteEntry = { siteUrl?: string; permissionLevel?: string };

const bareHost = (url: string) =>
  url
    .replace(/^sc-domain:/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .toLowerCase();

/**
 * The property to read for the shop: a domain property first (it covers
 * http, https and www), then the https and http addresses. A property the
 * service account was added to but cannot read is skipped.
 */
export const pickSite = (
  sites: SiteEntry[],
  domain: string = SHOP_DOMAIN,
): string | null => {
  const readable = sites.filter(
    (s): s is { siteUrl: string; permissionLevel?: string } =>
      typeof s.siteUrl === "string" &&
      s.permissionLevel !== "siteUnverifiedUser" &&
      bareHost(s.siteUrl) === domain.toLowerCase(),
  );
  const rank = (url: string) =>
    url.startsWith("sc-domain:")
      ? 0
      : url.startsWith("https://www.")
        ? 2
        : url.startsWith("https://")
          ? 1
          : 3;
  return (
    [...readable].sort((a, b) => rank(a.siteUrl) - rank(b.siteUrl))[0]
      ?.siteUrl ?? null
  );
};

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The days to ask Google for: from a few days before the newest copied day
 * (Google revises recent days), or the whole history on the first copy, up
 * to yesterday.
 */
export const syncWindow = (
  newestDay: string | null,
  today: Date,
  historyDays: number,
): { startDate: string; endDate: string } => {
  const end = today.getTime() - DAY_MS;
  const start = newestDay
    ? Math.max(
        Date.parse(newestDay) - REVISE_DAYS * DAY_MS,
        end - historyDays * DAY_MS,
      )
    : end - historyDays * DAY_MS;
  return { startDate: dayOf(Math.min(start, end)), endDate: dayOf(end) };
};

/** The body of one searchAnalytics.query request. */
export const queryBody = (
  window: { startDate: string; endDate: string },
  dimensions: Array<"date" | "query" | "page">,
  startRow = 0,
) => ({
  ...window,
  dimensions,
  type: "web",
  // Data Google has not finalized yet still counts, as in its own reports
  dataState: "all",
  rowLimit: PAGE_ROWS,
  startRow,
});

type GoogleRow = {
  keys?: unknown[];
  clicks?: unknown;
  impressions?: unknown;
  position?: unknown;
};

const whole = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
const place = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
const isDay = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export type DailyRow = {
  day: string;
  clicks: number;
  impressions: number;
  position: number;
};

/** Rows of a "date" report. */
export const parseDaily = (rows: unknown): DailyRow[] =>
  (Array.isArray(rows) ? (rows as GoogleRow[]) : [])
    .filter((r) => isDay(r.keys?.[0]))
    .map((r) => ({
      day: r.keys![0] as string,
      clicks: whole(r.clicks),
      impressions: whole(r.impressions),
      position: place(r.position),
    }));

/** Rows of a "date" + "query" or "date" + "page" report, keyed by `field`. */
export const parseDetail = <K extends "query" | "page">(
  rows: unknown,
  field: K,
): Array<DailyRow & Record<K, string>> =>
  (Array.isArray(rows) ? (rows as GoogleRow[]) : [])
    .filter(
      (r) =>
        isDay(r.keys?.[0]) &&
        typeof r.keys?.[1] === "string" &&
        (r.keys[1] as string).trim() !== "",
    )
    .map(
      (r) =>
        ({
          day: r.keys![0] as string,
          [field]: (r.keys![1] as string).trim().slice(0, 500),
          clicks: whole(r.clicks),
          impressions: whole(r.impressions),
          position: place(r.position),
        }) as DailyRow & Record<K, string>,
    );
