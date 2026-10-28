// Turns breakdown rows into donut slices with a fixed colour per thing, so a
// kind of work or a channel keeps its colour whatever the period or filter.
// Four named colours (see --viz-* in index.css); anything else folds into a
// grey "Other" slice, because more hues than that stop being tellable apart.
import type { DonutSlice } from "../operations/DonutChart";

const OTHER = "var(--chart-compare)";

const fold = (
  rows: Array<{ key: string; label: string; value: number }>,
  colourOf: (key: string) => string | undefined,
): DonutSlice[] => {
  const named: DonutSlice[] = [];
  let other = 0;
  for (const row of rows) {
    const colour = colourOf(row.key);
    if (colour) named.push({ ...row, colour });
    else other += row.value;
  }
  return other > 0
    ? [...named, { key: "other", label: "Other", value: other, colour: OTHER }]
    : named;
};

const CATEGORY_COLOURS: Array<[RegExp, string]> = [
  [/detail/i, "var(--viz-1)"],
  [/tint/i, "var(--viz-2)"],
  [/light/i, "var(--viz-3)"],
  [/diesel|parts|tun/i, "var(--viz-4)"],
];

/** Net sales by kind of work: detailing, tint, lighting, parts, then Other. */
export const categorySlices = (
  rows: Array<{ name: string; netSales: number }>,
): DonutSlice[] =>
  fold(
    rows.map((r) => ({ key: r.name, label: r.name, value: r.netSales })),
    (key) => CATEGORY_COLOURS.find(([pattern]) => pattern.test(key))?.[1],
  );

const CHANNEL_COLOURS: Array<[RegExp, string]> = [
  [/online/i, "var(--viz-1)"],
  [/shop|pos/i, "var(--viz-2)"],
  [/draft|pay link/i, "var(--viz-3)"],
];

/** Net sales by channel: online store, in shop, draft orders, then Other. */
export const channelSlices = (
  rows: Array<{ name: string; netSales: number }>,
): DonutSlice[] =>
  fold(
    rows.map((r) => ({ key: r.name, label: r.name, value: r.netSales })),
    (key) => CHANNEL_COLOURS.find(([pattern]) => pattern.test(key))?.[1],
  );

const KIND_COLOURS: Record<string, string> = {
  Direct: "var(--viz-1)",
  Search: "var(--viz-2)",
  Social: "var(--viz-3)",
  "Other site": "var(--viz-4)",
};

/** Sessions by kind of source (Direct, Search, Social, Other site, Other). */
export const sourceKindSlices = (
  rows: Array<{ kind: string; sessions: number }>,
): DonutSlice[] => {
  const byKind = new Map<string, number>();
  for (const r of rows)
    byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + r.sessions);
  return fold(
    [...byKind.entries()]
      .map(([kind, value]) => ({ key: kind, label: kind, value }))
      .sort((a, b) => b.value - a.value),
    (key) => KIND_COLOURS[key],
  );
};
