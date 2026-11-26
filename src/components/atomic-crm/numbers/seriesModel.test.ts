import { describe, expect, it } from "vitest";

import { numbersRanges } from "./periods";
import { bucketSeries, customerSeries } from "./seriesModel";

const NOW = new Date("2026-11-26T20:00:00Z");

describe("bucketSeries", () => {
  it("counts items per day over the period and the one before", () => {
    const ranges = numbersRanges("30d", NOW);
    const items = [
      { at: "2026-11-26T18:00:00Z" },
      { at: "2026-11-26T19:00:00Z" },
      { at: "2026-11-20T18:00:00Z" },
    ];
    const { values, previous } = bucketSeries(
      items,
      (i) => i.at,
      () => 1,
      ranges,
    );
    expect(values.reduce((a, b) => a + b, 0)).toBe(3);
    expect(values[values.length - 1]).toBe(2);
    expect(previous.every((v) => v === 0)).toBe(true);
  });

  it("sums a value instead of counting", () => {
    const ranges = numbersRanges("30d", NOW);
    const { values } = bucketSeries(
      [
        { at: "2026-11-26T18:00:00Z", n: 40 },
        { at: "2026-11-26T19:00:00Z", n: 2 },
      ],
      (i) => i.at,
      (i) => i.n,
      ranges,
    );
    expect(values[values.length - 1]).toBe(42);
  });
});

describe("customerSeries", () => {
  it("splits who ordered into new and returning per bucket", () => {
    const ranges = numbersRanges("30d", NOW);
    const order = (id: number, contact: number, at: string) =>
      ({
        id,
        contact_id: contact,
        ordered_at: at,
        total: 10,
        refunded_amount: 0,
        is_deposit: false,
        cancelled_at: null,
      }) as never;
    const { active, added, returning } = customerSeries(
      [
        order(1, 1, "2026-11-26T18:00:00Z"),
        order(2, 2, "2026-11-26T19:00:00Z"),
        order(3, 2, "2026-01-01T19:00:00Z"),
      ],
      ranges,
    );
    const last = (s: { values: number[] }) => s.values[s.values.length - 1];
    expect(last(active)).toBe(2);
    expect(last(added)).toBe(1);
    expect(last(returning)).toBe(1);
  });
});
