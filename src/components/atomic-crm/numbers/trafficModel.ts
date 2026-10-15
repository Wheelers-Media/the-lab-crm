// Online store traffic on the Numbers screen: visits, how far they got, where
// they came from and on what device. Plain functions over the daily rows the
// traffic_sync function copies from Shopify's reports, like salesModel.ts, so
// every figure can be tested without a database. Days are the shop's own
// calendar days ("2026-10-05"), the way Shopify reports them.
import { type DateRange, mondayOf, shopDayKey } from "../operations/shopTime";
import {
  type Bucket,
  bucketKeys,
  bucketLabel,
  type NumbersRanges,
} from "./periods";
import { percentChange } from "./salesModel";

export interface TrafficRow {
  id: number;
  day: string;
  /** What kind of link brought the visit: direct, search, social, email, unknown or "". */
  referrer_source: string;
  /** The site or app behind it ("facebook", "gmail"); "" for direct visits. */
  referrer_name: string;
  /** mobile, desktop, tablet or "". */
  device_type: string;
  sessions: number;
  cart_sessions: number;
  checkout_sessions: number;
  completed_sessions: number;
  synced_at?: string;
}

// ── The metric on the trend chart ──────────────────────────────────────────

export type TrafficMetric =
  | "sessions"
  | "conversion"
  | "carts"
  | "checkouts"
  | "completed";

export const TRAFFIC_METRICS: Array<{
  value: TrafficMetric;
  label: string;
  percent: boolean;
}> = [
  { value: "sessions", label: "Sessions", percent: false },
  { value: "conversion", label: "Conversion rate", percent: true },
  { value: "carts", label: "Added to cart", percent: false },
  { value: "checkouts", label: "Reached checkout", percent: false },
  { value: "completed", label: "Completed checkout", percent: false },
];

export const isTrafficMetric = (value: string | null): value is TrafficMetric =>
  TRAFFIC_METRICS.some((m) => m.value === value);

// ── Filter: one source and one device across the whole section ─────────────

export interface TrafficFilter {
  source: string | null;
  device: string | null;
}

export const NO_FILTER: TrafficFilter = { source: null, device: null };

export const isFiltered = (filter: TrafficFilter): boolean =>
  filter.source != null || filter.device != null;

/** "social:facebook", or just "direct" when no site is behind the visit. */
export const sourceKeyOf = (
  row: Pick<TrafficRow, "referrer_source" | "referrer_name">,
): string => {
  const kind = row.referrer_source || "other";
  return row.referrer_name ? `${kind}:${row.referrer_name}` : kind;
};

export const deviceKeyOf = (row: Pick<TrafficRow, "device_type">): string =>
  row.device_type || "other";

const KIND_LABELS: Record<string, string> = {
  direct: "Direct",
  search: "Search",
  social: "Social",
  email: "Email",
  paid: "Paid",
  unknown: "Other site",
  other: "Not recorded",
};

// Sites worth a plainer name than the one Shopify records
const NAME_LABELS: Record<string, string> = {
  thelabfsj: "thelabfsj.ca",
  localhost: "Localhost (testing)",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
  other: "Not recorded",
};

const capital = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** The kind of link: "Social", "Search", "Other site". */
export const sourceKind = (
  row: Pick<TrafficRow, "referrer_source">,
): string => {
  const kind = row.referrer_source || "other";
  return KIND_LABELS[kind] ?? capital(kind);
};

/** "Facebook", "Direct", "thelabfsj.ca": what a person calls this source. */
export const sourceLabel = (
  row: Pick<TrafficRow, "referrer_source" | "referrer_name">,
): string =>
  row.referrer_name
    ? (NAME_LABELS[row.referrer_name.toLowerCase()] ??
      capital(row.referrer_name))
    : sourceKind(row);

export const deviceLabel = (row: Pick<TrafficRow, "device_type">): string => {
  const key = deviceKeyOf(row);
  return DEVICE_LABELS[key] ?? capital(key);
};

/** The name for a source key, for the filter chip above the section. */
export const sourceKeyLabel = (key: string): string => {
  const at = key.indexOf(":");
  return sourceLabel({
    referrer_source: at < 0 ? key : key.slice(0, at),
    referrer_name: at < 0 ? "" : key.slice(at + 1),
  });
};

export const deviceKeyLabel = (key: string): string =>
  DEVICE_LABELS[key] ?? capital(key);

// ── Days and buckets ───────────────────────────────────────────────────────

/** First and last shop day of a range, both included. */
export const dayWindow = (range: DateRange): { from: string; to: string } => ({
  from: shopDayKey(range.start),
  to: shopDayKey(new Date(range.end.getTime() - 1)),
});

/** The chart bucket a shop day falls in: the day, its Monday, or "2026-10". */
const bucketOfDay = (day: string, bucket: Bucket): string =>
  bucket === "day" ? day : bucket === "week" ? mondayOf(day) : day.slice(0, 7);

const num = (value: unknown): number => Number(value) || 0;

/** The rows inside a range that match the filter. */
export const trafficRows = (
  rows: TrafficRow[],
  range: DateRange,
  filter: TrafficFilter = NO_FILTER,
): TrafficRow[] => {
  const { from, to } = dayWindow(range);
  return rows.filter(
    (r) =>
      r.day >= from &&
      r.day <= to &&
      (filter.source == null || sourceKeyOf(r) === filter.source) &&
      (filter.device == null || deviceKeyOf(r) === filter.device),
  );
};

// ── Totals ─────────────────────────────────────────────────────────────────

export interface TrafficTotals {
  sessions: number;
  /** Visits that added something to a cart. */
  carts: number;
  /** Visits that reached checkout. */
  checkouts: number;
  /** Visits that finished checkout. */
  completed: number;
  /** Completed as a percent of sessions, one decimal; null with no sessions. */
  conversion: number | null;
}

export const totalsOf = (rows: TrafficRow[]): TrafficTotals => {
  let sessions = 0;
  let carts = 0;
  let checkouts = 0;
  let completed = 0;
  for (const r of rows) {
    sessions += num(r.sessions);
    carts += num(r.cart_sessions);
    checkouts += num(r.checkout_sessions);
    completed += num(r.completed_sessions);
  }
  return {
    sessions,
    carts,
    checkouts,
    completed,
    conversion: sessions
      ? Math.round((completed / sessions) * 1000) / 10
      : null,
  };
};

export const trafficTotals = (
  rows: TrafficRow[],
  range: DateRange,
  filter: TrafficFilter = NO_FILTER,
): TrafficTotals => totalsOf(trafficRows(rows, range, filter));

const pick = (t: TrafficTotals, metric: TrafficMetric): number => {
  if (metric === "sessions") return t.sessions;
  if (metric === "carts") return t.carts;
  if (metric === "checkouts") return t.checkouts;
  if (metric === "completed") return t.completed;
  return t.conversion ?? 0;
};

/** "2.8%", or a dash when there is nothing to divide. */
export const percentText = (value: number | null): string =>
  value == null
    ? "–"
    : `${value.toLocaleString("en-CA", { maximumFractionDigits: 1 })}%`;

export { percentChange };

// ── Trend ──────────────────────────────────────────────────────────────────

export interface TrafficPoint {
  key: string;
  label: string;
  value: number;
  /** The same bucket of the previous period, by position. */
  previous: number;
  sessions: number;
}

const bucketTotals = (
  rows: TrafficRow[],
  range: DateRange,
  bucket: Bucket,
  filter: TrafficFilter,
): Array<{ key: string; totals: TrafficTotals }> => {
  const byKey = new Map<string, TrafficRow[]>();
  for (const r of trafficRows(rows, range, filter)) {
    const key = bucketOfDay(r.day, bucket);
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }
  return bucketKeys(range, bucket).map((key) => ({
    key,
    totals: totalsOf(byKey.get(key) ?? []),
  }));
};

/** The chosen metric per day, week or month, with the previous period beside it. */
export const trafficTrend = (
  rows: TrafficRow[],
  ranges: NumbersRanges,
  metric: TrafficMetric,
  filter: TrafficFilter = NO_FILTER,
): TrafficPoint[] => {
  const current = bucketTotals(rows, ranges.current, ranges.bucket, filter);
  const previous = bucketTotals(rows, ranges.previous, ranges.bucket, filter);
  return current.map((c, i) => ({
    key: c.key,
    label: bucketLabel(c.key, ranges.bucket),
    value: pick(c.totals, metric),
    previous: previous[i] ? pick(previous[i].totals, metric) : 0,
    sessions: c.totals.sessions,
  }));
};

/** The rows that fall in one bucket of the chart. */
export const trafficInBucket = (
  rows: TrafficRow[],
  ranges: NumbersRanges,
  key: string,
  filter: TrafficFilter = NO_FILTER,
): TrafficRow[] =>
  trafficRows(rows, ranges.current, filter).filter(
    (r) => bucketOfDay(r.day, ranges.bucket) === key,
  );

// ── Where visitors come from, and on what ──────────────────────────────────

export interface TrafficGroup extends TrafficTotals {
  key: string;
  label: string;
  /** For a source: its kind ("Social"). For a device: the same as the label. */
  kind: string;
  /** Whole percent of the period's sessions. */
  share: number;
  previousSessions: number;
  /** Sessions against the same stretch before, whole percent; null with none before. */
  change: number | null;
}

interface Dimension {
  keyOf: (row: TrafficRow) => string;
  labelOf: (row: TrafficRow) => string;
  kindOf: (row: TrafficRow) => string;
}

const SOURCE: Dimension = {
  keyOf: sourceKeyOf,
  labelOf: sourceLabel,
  kindOf: sourceKind,
};
const DEVICE: Dimension = {
  keyOf: deviceKeyOf,
  labelOf: deviceLabel,
  kindOf: deviceLabel,
};

const group = (
  current: TrafficRow[],
  previous: TrafficRow[],
  by: Dimension,
): TrafficGroup[] => {
  const total = current.reduce((s, r) => s + num(r.sessions), 0);
  const before = new Map<string, number>();
  for (const r of previous) {
    const key = by.keyOf(r);
    before.set(key, (before.get(key) ?? 0) + num(r.sessions));
  }
  const groups = new Map<
    string,
    { label: string; kind: string; rows: TrafficRow[] }
  >();
  for (const r of current) {
    const key = by.keyOf(r);
    const entry = groups.get(key);
    if (entry) entry.rows.push(r);
    else
      groups.set(key, { label: by.labelOf(r), kind: by.kindOf(r), rows: [r] });
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const totals = totalsOf(g.rows);
      const previousSessions = before.get(key) ?? 0;
      return {
        ...totals,
        key,
        label: g.label,
        kind: g.kind,
        share: total ? Math.round((totals.sessions / total) * 100) : 0,
        previousSessions,
        change: percentChange(totals.sessions, previousSessions),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label));
};

/** Sources, with the device filter applied but not the source one, so every source stays pickable. */
export const trafficBySource = (
  rows: TrafficRow[],
  ranges: NumbersRanges,
  filter: TrafficFilter = NO_FILTER,
): TrafficGroup[] => {
  const only = { source: null, device: filter.device };
  return group(
    trafficRows(rows, ranges.current, only),
    trafficRows(rows, ranges.previous, only),
    SOURCE,
  );
};

/** Devices, with the source filter applied but not the device one. */
export const trafficByDevice = (
  rows: TrafficRow[],
  ranges: NumbersRanges,
  filter: TrafficFilter = NO_FILTER,
): TrafficGroup[] => {
  const only = { source: filter.source, device: null };
  return group(
    trafficRows(rows, ranges.current, only),
    trafficRows(rows, ranges.previous, only),
    DEVICE,
  );
};

/** The sources inside a set of rows, such as one day's, with no earlier period to compare. */
export const sourcesIn = (rows: TrafficRow[]): TrafficGroup[] =>
  group(rows, [], SOURCE);

// ── The path to a purchase ─────────────────────────────────────────────────

export interface FunnelStep {
  key: "sessions" | "carts" | "checkouts" | "completed";
  label: string;
  count: number;
  /** Percent of sessions, one decimal; null with no sessions. */
  share: number | null;
}

/**
 * Sessions, then how many added to a cart, reached checkout and finished.
 * Each step is shown against all sessions: a visit can go straight to checkout
 * (Buy now, Shop Pay), so a step can be bigger than the one above it.
 */
export const trafficFunnel = (t: TrafficTotals): FunnelStep[] => {
  const share = (n: number) =>
    t.sessions ? Math.round((n / t.sessions) * 1000) / 10 : null;
  return [
    {
      key: "sessions",
      label: "Visited",
      count: t.sessions,
      share: share(t.sessions),
    },
    {
      key: "carts",
      label: "Added to cart",
      count: t.carts,
      share: share(t.carts),
    },
    {
      key: "checkouts",
      label: "Reached checkout",
      count: t.checkouts,
      share: share(t.checkouts),
    },
    {
      key: "completed",
      label: "Completed checkout",
      count: t.completed,
      share: share(t.completed),
    },
  ];
};

// ── Freshness ──────────────────────────────────────────────────────────────

/** When the newest copy from Shopify was made, or null when nothing is held. */
export const newestSync = (rows: TrafficRow[]): string | null =>
  rows.reduce<string | null>(
    (newest, r) =>
      r.synced_at && (!newest || r.synced_at > newest) ? r.synced_at : newest,
    null,
  );
