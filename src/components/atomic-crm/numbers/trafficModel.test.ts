import { describe, expect, it } from "vitest";

import { numbersRanges } from "./periods";
import {
  deviceKeyOf,
  isTrafficMetric,
  newestSync,
  percentText,
  sourceKeyLabel,
  sourceKeyOf,
  sourceKind,
  sourceLabel,
  sourcesIn,
  trafficBySource,
  trafficByDevice,
  trafficFunnel,
  trafficInBucket,
  trafficTotals,
  trafficTrend,
  type TrafficRow,
} from "./trafficModel";

// Friday Oct 9 2026, 9:00 in Fort St. John (UTC-7, no clock change)
const NOW = new Date("2026-10-09T16:00:00Z");
const ranges = numbersRanges("month", NOW);

let nextId = 1;
const row = (
  day: string,
  source: string,
  name: string,
  device: string,
  counts: [number, number, number, number],
  syncedAt?: string,
): TrafficRow => ({
  id: nextId++,
  day,
  referrer_source: source,
  referrer_name: name,
  device_type: device,
  sessions: counts[0],
  cart_sessions: counts[1],
  checkout_sessions: counts[2],
  completed_sessions: counts[3],
  synced_at: syncedAt,
});

const rows: TrafficRow[] = [
  row("2026-10-01", "direct", "", "mobile", [10, 2, 1, 1]),
  row("2026-10-02", "social", "facebook", "mobile", [4, 1, 1, 0]),
  row("2026-10-02", "direct", "", "desktop", [6, 1, 0, 0]),
  row("2026-10-02", "unknown", "thelabfsj", "mobile", [2, 2, 2, 1]),
  row("2026-10-05", "direct", "", "mobile", [5, 0, 1, 0]),
  // The stretch before: Sept 1 to Sept 9
  row("2026-09-01", "direct", "", "mobile", [8, 1, 1, 1]),
  row("2026-09-02", "social", "facebook", "mobile", [2, 0, 0, 0]),
  // Before both periods
  row("2026-08-01", "direct", "", "mobile", [100, 0, 0, 0]),
];

describe("trafficTotals", () => {
  it("adds up the period and works the conversion rate from the sums", () => {
    const t = trafficTotals(rows, ranges.current);

    expect(t).toEqual({
      sessions: 27,
      carts: 6,
      checkouts: 5,
      completed: 2,
      conversion: 7.4,
    });
  });

  it("totals the stretch before on its own", () => {
    const t = trafficTotals(rows, ranges.previous);

    expect(t.sessions).toBe(10);
    expect(t.conversion).toBe(10);
  });

  it("has no conversion rate when there were no sessions", () => {
    const t = trafficTotals([], ranges.current);

    expect(t).toMatchObject({ sessions: 0, completed: 0, conversion: null });
  });

  it("narrows to a source, a device, or both", () => {
    expect(
      trafficTotals(rows, ranges.current, {
        source: "social:facebook",
        device: null,
      }).sessions,
    ).toBe(4);
    expect(
      trafficTotals(rows, ranges.current, { source: null, device: "mobile" })
        .sessions,
    ).toBe(21);
    expect(
      trafficTotals(rows, ranges.current, {
        source: "direct",
        device: "mobile",
      }),
    ).toMatchObject({ sessions: 15, completed: 1, conversion: 6.7 });
  });
});

describe("trafficTrend", () => {
  it("charts sessions per day with the previous month's same day beside it", () => {
    const points = trafficTrend(rows, ranges, "sessions");

    expect(points).toHaveLength(9);
    expect(points[0]).toMatchObject({
      key: "2026-10-01",
      value: 10,
      previous: 8,
    });
    expect(points[1]).toMatchObject({
      key: "2026-10-02",
      value: 12,
      previous: 2,
    });
    expect(points[2].value).toBe(0);
  });

  it("charts the conversion rate of each day, zero on a day with no visits", () => {
    const points = trafficTrend(rows, ranges, "conversion");

    expect(points[1].value).toBe(8.3);
    expect(points[2].value).toBe(0);
  });

  it("follows the filter", () => {
    const points = trafficTrend(rows, ranges, "sessions", {
      source: "social:facebook",
      device: null,
    });

    expect(points[1].value).toBe(4);
    expect(points[0].value).toBe(0);
  });

  it("groups by the Monday of the week on a quarter", () => {
    const quarter = numbersRanges("quarter", NOW);

    const points = trafficTrend(rows, quarter, "sessions");

    expect(points.map((p) => [p.key, p.value])).toEqual([
      ["2026-09-28", 22],
      ["2026-10-05", 5],
    ]);
  });

  it("finds the rows behind one bar", () => {
    const day = trafficInBucket(rows, ranges, "2026-10-02");

    expect(day).toHaveLength(3);
    expect(day.reduce((s, r) => s + r.sessions, 0)).toBe(12);
  });
});

describe("trafficBySource", () => {
  it("ranks sources by sessions with share and change against before", () => {
    const sources = trafficBySource(rows, ranges);

    expect(sources.map((s) => [s.label, s.sessions])).toEqual([
      ["Direct", 21],
      ["Facebook", 4],
      ["thelabfsj.ca", 2],
    ]);
    expect(sources[0]).toMatchObject({
      key: "direct",
      kind: "Direct",
      share: 78,
      previousSessions: 8,
      change: 163,
    });
    expect(sources[1]).toMatchObject({
      kind: "Social",
      previousSessions: 2,
      change: 100,
    });
    expect(sources[2].change).toBeNull();
  });

  it("follows the device filter but keeps every source pickable under its own", () => {
    const onDesktop = trafficBySource(rows, ranges, {
      source: null,
      device: "desktop",
    });
    const pickedFacebook = trafficBySource(rows, ranges, {
      source: "social:facebook",
      device: null,
    });

    expect(onDesktop.map((s) => s.key)).toEqual(["direct"]);
    expect(pickedFacebook).toHaveLength(3);
  });

  it("breaks one day down by source", () => {
    const day = trafficInBucket(rows, ranges, "2026-10-02");

    expect(sourcesIn(day).map((s) => [s.label, s.sessions])).toEqual([
      ["Direct", 6],
      ["Facebook", 4],
      ["thelabfsj.ca", 2],
    ]);
  });
});

describe("trafficByDevice", () => {
  it("splits sessions by device, with the stretch before", () => {
    const devices = trafficByDevice(rows, ranges);

    expect(
      devices.map((d) => [d.label, d.sessions, d.previousSessions]),
    ).toEqual([
      ["Mobile", 21, 10],
      ["Desktop", 6, 0],
    ]);
  });

  it("follows the source filter", () => {
    const devices = trafficByDevice(rows, ranges, {
      source: "direct",
      device: null,
    });

    expect(devices.map((d) => [d.key, d.sessions])).toEqual([
      ["mobile", 15],
      ["desktop", 6],
    ]);
  });
});

describe("names", () => {
  it("keys and names a visit with no recorded source", () => {
    const blank = { referrer_source: "", referrer_name: "" };

    expect(sourceKeyOf(blank)).toBe("other");
    expect(sourceLabel(blank)).toBe("Not recorded");
    expect(sourceKeyLabel("other")).toBe("Not recorded");
  });

  it("names a site by itself and its kind by what sort of link it was", () => {
    const site = { referrer_source: "unknown", referrer_name: "thelabfsj" };

    expect(sourceKeyOf(site)).toBe("unknown:thelabfsj");
    expect(sourceLabel(site)).toBe("thelabfsj.ca");
    expect(sourceKind(site)).toBe("Other site");
    expect(sourceKeyLabel("email:gmail")).toBe("Gmail");
  });

  it("keys a visit with no device", () => {
    expect(deviceKeyOf({ device_type: "" })).toBe("other");
    expect(deviceKeyOf({ device_type: "tablet" })).toBe("tablet");
  });

  it("only takes known metrics from the address", () => {
    expect(isTrafficMetric("conversion")).toBe(true);
    expect(isTrafficMetric("revenue")).toBe(false);
    expect(isTrafficMetric(null)).toBe(false);
  });
});

describe("trafficFunnel", () => {
  it("shows each step against all sessions", () => {
    const steps = trafficFunnel(trafficTotals(rows, ranges.current));

    expect(steps.map((s) => [s.key, s.count, s.share])).toEqual([
      ["sessions", 27, 100],
      ["carts", 6, 22.2],
      ["checkouts", 5, 18.5],
      ["completed", 2, 7.4],
    ]);
  });

  it("has no shares with no sessions", () => {
    const steps = trafficFunnel(trafficTotals([], ranges.current));

    expect(steps.every((s) => s.share === null)).toBe(true);
  });
});

describe("freshness and text", () => {
  it("reports the newest copy from Shopify", () => {
    const held = [
      row(
        "2026-10-01",
        "direct",
        "",
        "mobile",
        [1, 0, 0, 0],
        "2026-10-09T10:00:00Z",
      ),
      row(
        "2026-10-02",
        "direct",
        "",
        "mobile",
        [1, 0, 0, 0],
        "2026-10-09T16:30:00Z",
      ),
      row("2026-10-03", "direct", "", "mobile", [1, 0, 0, 0]),
    ];

    expect(newestSync(held)).toBe("2026-10-09T16:30:00Z");
    expect(newestSync([])).toBeNull();
  });

  it("writes a rate with up to one decimal, or a dash", () => {
    expect(percentText(7.4)).toBe("7.4%");
    expect(percentText(10)).toBe("10%");
    expect(percentText(null)).toBe("–");
  });
});
