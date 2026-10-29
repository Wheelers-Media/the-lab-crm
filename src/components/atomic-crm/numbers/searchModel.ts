// Google search on the Numbers screen: how often the shop's website shows up
// in Google, how often people click, for which searches and pages. Plain
// functions over the daily rows the search_console_sync function copies from
// Search Console, so every figure can be tested without a database.
import { type DateRange, mondayOf } from "../operations/shopTime";
import {
  type Bucket,
  bucketKeys,
  bucketLabel,
  type NumbersRanges,
} from "./periods";
import { percentChange } from "./salesModel";
import { dayWindow } from "./trafficModel";

export interface SearchDayRow {
  id: number;
  day: string;
  clicks: number;
  impressions: number;
  /** Average position in Google's results that day; 1 is the top. */
  position: number;
  synced_at?: string;
}

export interface SearchQueryRow extends SearchDayRow {
  query: string;
}

export interface SearchPageRow extends SearchDayRow {
  page: string;
}

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Clicks per impression, as a percentage. */
  ctr: number;
  /** Average position, weighted by impressions; 0 when never shown. */
  position: number;
}

export type SearchMetric = "clicks" | "impressions" | "ctr" | "position";

export const SEARCH_METRICS: Array<{
  value: SearchMetric;
  label: string;
  hint: string;
}> = [
  {
    value: "clicks",
    label: "Clicks",
    hint: "People who clicked through to the website from Google",
  },
  {
    value: "impressions",
    label: "Times shown",
    hint: "How often the website appeared in someone's Google results",
  },
  { value: "ctr", label: "Click rate", hint: "Clicks out of times shown" },
  {
    value: "position",
    label: "Average spot",
    hint: "Where the website showed in the results; 1 is the top",
  },
];

const num = (v: unknown) => Number(v) || 0;

const inRange = <T extends { day: string }>(
  rows: T[],
  range: DateRange,
): T[] => {
  const { from, to } = dayWindow(range);
  return rows.filter((r) => r.day >= from && r.day <= to);
};

const totalsOf = (rows: SearchDayRow[]): SearchTotals => {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const r of rows) {
    clicks += num(r.clicks);
    impressions += num(r.impressions);
    weighted += num(r.position) * num(r.impressions);
  }
  return {
    clicks,
    impressions,
    ctr: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    position: impressions ? Math.round((weighted / impressions) * 10) / 10 : 0,
  };
};

/** Totals over a range of days. */
export const searchTotals = (
  rows: SearchDayRow[],
  range: DateRange,
): SearchTotals => totalsOf(inRange(rows, range));

/**
 * The change from the previous period, as a percentage. For the average spot
 * a smaller number is better, so moving up from 12 to 8 reads as a gain.
 */
export const searchChange = (
  metric: SearchMetric,
  current: SearchTotals,
  previous: SearchTotals,
): number | null => {
  if (metric === "position") {
    if (!current.position || !previous.position) return null;
    return percentChange(previous.position, current.position);
  }
  return percentChange(current[metric], previous[metric]);
};

const bucketOf = (day: string, bucket: Bucket) =>
  bucket === "day" ? day : bucket === "week" ? mondayOf(day) : day.slice(0, 7);

const bucketed = (rows: SearchDayRow[], range: DateRange, bucket: Bucket) => {
  const byKey = new Map<string, SearchDayRow[]>();
  for (const r of inRange(rows, range)) {
    const key = bucketOf(r.day, bucket);
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return bucketKeys(range, bucket).map((key) => ({
    key,
    totals: totalsOf(byKey.get(key) ?? []),
  }));
};

/** The chosen figure per day, week or month, with the previous period beside it. */
export const searchTrend = (
  rows: SearchDayRow[],
  ranges: NumbersRanges,
  metric: SearchMetric,
) => {
  const current = bucketed(rows, ranges.current, ranges.bucket);
  const previous = bucketed(rows, ranges.previous, ranges.bucket);
  return current.map((c, i) => ({
    key: c.key,
    label: bucketLabel(c.key, ranges.bucket),
    value: c.totals[metric],
    previous: previous[i]?.totals[metric] ?? 0,
  }));
};

export interface SearchGroup extends SearchTotals {
  label: string;
}

/**
 * The searches (or pages) over a range, most clicked first, then most shown:
 * a search that shows a lot but gets no clicks is worth seeing too.
 */
export const searchGroups = <R extends SearchDayRow>(
  rows: R[],
  range: DateRange,
  labelOf: (row: R) => string,
): SearchGroup[] => {
  const byLabel = new Map<string, R[]>();
  for (const r of inRange(rows, range)) {
    const label = labelOf(r);
    byLabel.set(label, [...(byLabel.get(label) ?? []), r]);
  }
  return [...byLabel.entries()]
    .map(([label, list]) => ({ label, ...totalsOf(list) }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks ||
        b.impressions - a.impressions ||
        a.label.localeCompare(b.label),
    );
};

/** "https://thelabfsj.ca/pages/tint?x=1" -> "/pages/tint"; the home page is "/". */
export const pagePath = (url: string): string => {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
};

/** When the copy was last brought up to date. */
export const newestSearchSync = (rows: SearchDayRow[]): string | null =>
  rows.reduce<string | null>(
    (newest, r) =>
      r.synced_at && (!newest || r.synced_at > newest) ? r.synced_at : newest,
    null,
  );
