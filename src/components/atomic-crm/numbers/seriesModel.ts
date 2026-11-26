// The figures behind each tile's trend graphic: the same count or sum, one
// point per day, week or month of the chosen period, with the period before
// alongside. Plain records in, numbers out.
import { inRange, type DateRange } from "../operations/shopTime";
import {
  type Bucket,
  bucketKeyOf,
  bucketKeys,
  type NumbersRanges,
} from "./periods";
import { customerLedger, type LedgerOrder } from "./customerModel";

export interface Series {
  values: number[];
  previous: number[];
}

const sumByBucket = <T>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  valueOf: (item: T) => number,
  range: DateRange,
  bucket: Bucket,
): number[] => {
  const sums = new Map<string, number>();
  for (const item of items) {
    const at = dateOf(item);
    if (!at || !inRange(at, range)) continue;
    const key = bucketKeyOf(at, bucket);
    sums.set(key, (sums.get(key) ?? 0) + valueOf(item));
  }
  return bucketKeys(range, bucket).map((key) => sums.get(key) ?? 0);
};

/** A count or a sum per bucket of the period and of the period before. */
export const bucketSeries = <T>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  valueOf: (item: T) => number,
  ranges: NumbersRanges,
): Series => ({
  values: sumByBucket(items, dateOf, valueOf, ranges.current, ranges.bucket),
  previous: sumByBucket(items, dateOf, valueOf, ranges.previous, ranges.bucket),
});

/** Customers who ordered, were new, and came back, per bucket. */
export const customerSeries = (
  orders: LedgerOrder[],
  ranges: NumbersRanges,
): { active: Series; added: Series; returning: Series } => {
  const first = new Map(
    [...customerLedger(orders).values()].map((r) => [
      r.contactId,
      r.firstOrderAt,
    ]),
  );
  const sales = orders.filter(
    (o) => !o.cancelled_at && !o.is_deposit && o.contact_id != null,
  );
  const perBucket = (range: DateRange, wanted: "active" | "added") => {
    const seen = new Map<string, Set<unknown>>();
    for (const o of sales) {
      if (!inRange(o.ordered_at, range)) continue;
      if (wanted === "added" && !inRange(first.get(o.contact_id!), range))
        continue;
      const key = bucketKeyOf(o.ordered_at, ranges.bucket);
      const set = seen.get(key) ?? new Set();
      set.add(o.contact_id);
      seen.set(key, set);
    }
    return bucketKeys(range, ranges.bucket).map((k) => seen.get(k)?.size ?? 0);
  };
  const both = (wanted: "active" | "added"): Series => ({
    values: perBucket(ranges.current, wanted),
    previous: perBucket(ranges.previous, wanted),
  });
  const active = both("active");
  const added = both("added");
  const minus = (a: number[], b: number[]) =>
    a.map((v, i) => Math.max(0, v - (b[i] ?? 0)));
  return {
    active,
    added,
    returning: {
      values: minus(active.values, added.values),
      previous: minus(active.previous, added.previous),
    },
  };
};
