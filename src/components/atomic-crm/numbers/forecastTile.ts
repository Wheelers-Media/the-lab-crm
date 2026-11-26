// The "on pace for" line on a Numbers tile. Only "This month" is projected:
// the other periods are rolling or already over, so there is no end to land on.
import {
  isInProgress,
  paceRange,
  paceSentence,
  projectRecords,
} from "../operations/forecast";
import type { KpiTileProps } from "../operations/OperationsWidgets";
import { inRange } from "../operations/shopTime";
import type { NumbersRanges } from "./periods";

/**
 * Project a figure made of records to the end of the month, and set it against
 * what last month finished on. `betterWhen` says which way is good news
 * (more sales is good, more refunds is not).
 */
export const tileForecast = <T>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  valueOf: (item: T) => number,
  ranges: NumbersRanges,
  now: Date,
  format: (n: number) => string,
  betterWhen: "higher" | "lower" = "higher",
): KpiTileProps["forecast"] => {
  const full = ranges.fullPeriod;
  if (!full || !isInProgress(full, now)) return undefined;
  const p = projectRecords(items, dateOf, valueOf, full, now);
  const sentence = paceSentence(p, format);
  if (!sentence) return undefined;
  const prev = ranges.fullPrevious;
  const lastMonth = prev
    ? items.reduce(
        (sum, item) => sum + (inRange(dateOf(item), prev) ? valueOf(item) : 0),
        0,
      )
    : null;
  const note =
    lastMonth != null && lastMonth > 0
      ? `last month ${format(lastMonth)}`
      : null;
  const ahead =
    lastMonth == null || lastMonth === 0
      ? null
      : betterWhen === "higher"
        ? p.projected >= lastMonth
        : p.projected <= lastMonth;
  return {
    text: sentence,
    range: [paceRange(p, format), note].filter(Boolean).join(" · ") || null,
    tone: ahead == null ? undefined : ahead ? "good" : "bad",
  };
};
