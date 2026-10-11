import { describe, expect, it } from "vitest";

import { shopDayKey } from "../operations/shopTime";
import { bucketKeyOf, bucketKeys, bucketLabel, numbersRanges } from "./periods";

// Friday Oct 9 2026, 9:00 in Fort St. John (UTC-7, no daylight saving)
const NOW = new Date("2026-10-09T16:00:00Z");
const keys = (r: { start: Date; end: Date }) => [
  shopDayKey(r.start),
  shopDayKey(new Date(r.end.getTime() - 1)),
];

describe("numbersRanges", () => {
  it("compares this month so far with the same days of last month", () => {
    const { current, previous, bucket } = numbersRanges("month", NOW);

    expect(keys(current)).toEqual(["2026-10-01", "2026-10-09"]);
    expect(keys(previous)).toEqual(["2026-09-01", "2026-09-09"]);
    expect(bucket).toBe("day");
  });

  it("reports a whole last month against the month before it", () => {
    const { current, previous } = numbersRanges("last-month", NOW);

    expect(keys(current)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(keys(previous)).toEqual(["2026-08-01", "2026-08-31"]);
  });

  it("takes the last 30 days including today, against the 30 before", () => {
    const { current, previous } = numbersRanges("30d", NOW);

    expect(keys(current)).toEqual(["2026-09-10", "2026-10-09"]);
    expect(keys(previous)).toEqual(["2026-08-11", "2026-09-09"]);
  });

  it("compares the quarter so far with the same number of days of the last quarter", () => {
    const { current, previous, bucket } = numbersRanges("quarter", NOW);

    expect(keys(current)).toEqual(["2026-10-01", "2026-10-09"]);
    expect(keys(previous)).toEqual(["2026-07-01", "2026-07-09"]);
    expect(bucket).toBe("week");
  });

  it("compares the year so far with the same days of last year", () => {
    const { current, previous, bucket } = numbersRanges("ytd", NOW);

    expect(keys(current)).toEqual(["2026-01-01", "2026-10-09"]);
    expect(keys(previous)).toEqual(["2025-01-01", "2025-10-09"]);
    expect(bucket).toBe("month");
  });

  it("takes twelve whole calendar months ending this month, against the twelve before", () => {
    const { current, previous } = numbersRanges("12m", NOW);

    expect(keys(current)).toEqual(["2025-11-01", "2026-10-09"]);
    expect(keys(previous)).toEqual(["2024-11-01", "2025-10-31"]);
  });
});

describe("buckets", () => {
  it("lists every day with none skipped", () => {
    const { current } = numbersRanges("30d", NOW);

    const days = bucketKeys(current, "day");

    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-09-10");
    expect(days[29]).toBe("2026-10-09");
  });

  it("groups days into weeks starting on Monday and months", () => {
    const { current } = numbersRanges("quarter", NOW);

    expect(bucketKeys(current, "week")).toEqual(["2026-09-28", "2026-10-05"]);
    expect(bucketKeyOf("2026-10-09T16:00:00Z", "week")).toBe("2026-10-05");
    expect(bucketKeyOf("2026-10-09T16:00:00Z", "month")).toBe("2026-10");
  });

  it("puts a late-evening order on the shop's day, not the UTC day", () => {
    // 9 pm Oct 8 in Fort St. John is 04:00 Oct 9 UTC
    expect(bucketKeyOf("2026-10-09T04:00:00Z", "day")).toBe("2026-10-08");
  });

  it("labels days, weeks and months for the chart", () => {
    expect(bucketLabel("2026-10-05", "day")).toBe("Oct 5");
    expect(bucketLabel("2026-10", "month")).toBe("Oct 26");
  });
});
