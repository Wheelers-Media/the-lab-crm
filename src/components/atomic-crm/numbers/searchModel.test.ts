import { describe, expect, it } from "vitest";

import { startOfShopDay } from "../operations/shopTime";
import {
  newestSearchSync,
  pagePath,
  searchChange,
  searchGroups,
  searchTotals,
  searchTrend,
  type SearchDayRow,
  type SearchQueryRow,
} from "./searchModel";

const range = (from: string, toExclusive: string) => ({
  start: startOfShopDay(from),
  end: startOfShopDay(toExclusive),
});

const day = (
  d: string,
  clicks: number,
  impressions: number,
  position: number,
): SearchDayRow => ({ id: 0, day: d, clicks, impressions, position });

describe("searchTotals", () => {
  it("adds clicks and times shown, and weights the average spot by times shown", () => {
    const rows = [
      day("2026-10-01", 2, 100, 10),
      day("2026-10-02", 3, 300, 6),
      day("2026-09-30", 50, 50, 1),
    ];

    expect(searchTotals(rows, range("2026-10-01", "2026-11-01"))).toEqual({
      clicks: 5,
      impressions: 400,
      ctr: 1.3,
      position: 7,
    });
  });

  it("is all zeros for a period the website never showed in", () => {
    expect(searchTotals([], range("2026-10-01", "2026-11-01"))).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });
});

describe("searchChange", () => {
  const was = { clicks: 10, impressions: 200, ctr: 5, position: 12 };
  const now = { clicks: 15, impressions: 200, ctr: 7.5, position: 8 };

  it("reads a move up the results as a gain", () => {
    expect(searchChange("position", now, was)).toBe(50);
    expect(searchChange("clicks", now, was)).toBe(50);
  });

  it("has no change when there is nothing to compare with", () => {
    expect(searchChange("position", now, { ...was, position: 0 })).toBeNull();
  });
});

describe("searchTrend", () => {
  it("lines each day up with the same day of the previous period", () => {
    const rows = [day("2026-10-01", 4, 40, 3), day("2026-09-01", 1, 10, 9)];
    const points = searchTrend(
      rows,
      {
        current: range("2026-10-01", "2026-10-03"),
        previous: range("2026-09-01", "2026-09-03"),
        bucket: "day",
      },
      "clicks",
    );

    expect(points.map((p) => [p.key, p.value, p.previous])).toEqual([
      ["2026-10-01", 4, 1],
      ["2026-10-02", 0, 0],
    ]);
  });
});

describe("searchGroups", () => {
  it("puts the most clicked searches first, then the most shown", () => {
    const q = (d: string, query: string, clicks: number, impressions: number) =>
      ({ ...day(d, clicks, impressions, 5), query }) as SearchQueryRow;
    const groups = searchGroups(
      [
        q("2026-10-01", "window tint fort st john", 1, 20),
        q("2026-10-02", "window tint fort st john", 2, 30),
        q("2026-10-01", "the lab fsj", 4, 10),
        q("2026-10-01", "ceramic coating", 0, 90),
        q("2026-10-01", "remote starter", 0, 5),
      ],
      range("2026-10-01", "2026-11-01"),
      (r) => r.query,
    );

    expect(groups.map((g) => [g.label, g.clicks, g.impressions])).toEqual([
      ["the lab fsj", 4, 10],
      ["window tint fort st john", 3, 50],
      ["ceramic coating", 0, 90],
      ["remote starter", 0, 5],
    ]);
  });
});

describe("pagePath and newestSearchSync", () => {
  it("shows a page by its path", () => {
    expect(pagePath("https://thelabfsj.ca/pages/tint?ref=1")).toBe(
      "/pages/tint",
    );
    expect(pagePath("https://thelabfsj.ca/")).toBe("/");
  });

  it("finds the latest copy time", () => {
    expect(
      newestSearchSync([
        { ...day("2026-10-01", 0, 0, 0), synced_at: "2026-10-29T10:00:00Z" },
        { ...day("2026-10-02", 0, 0, 0), synced_at: "2026-10-29T12:00:00Z" },
        day("2026-10-03", 0, 0, 0),
      ]),
    ).toBe("2026-10-29T12:00:00Z");
  });
});
