// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BACKFILL_DAYS,
  daysToSync,
  PAGE_ROWS,
  parseTrafficRows,
  trafficQuery,
  windowsFor,
} from "./shopifyTraffic";

describe("trafficQuery", () => {
  it("asks for the latest window up to today, then the windows before it with no gap", () => {
    expect(trafficQuery(0, 0)).toContain("SINCE -91d UNTIL today");
    expect(trafficQuery(1, 0)).toContain("SINCE -183d UNTIL -92d");
    expect(trafficQuery(2, 0)).toContain("SINCE -275d UNTIL -184d");
  });

  it("sorts totally and pages with OFFSET so no row repeats or is skipped", () => {
    const query = trafficQuery(0, PAGE_ROWS);
    expect(query).toContain(
      "ORDER BY day ASC, referrer_source ASC, referrer_name ASC, session_device_type ASC",
    );
    expect(query).toContain(`LIMIT ${PAGE_ROWS} OFFSET ${PAGE_ROWS}`);
  });
});

describe("parseTrafficRows", () => {
  const columns = [
    { name: "day" },
    { name: "referrer_source" },
    { name: "referrer_name" },
    { name: "session_device_type" },
    { name: "sessions" },
    { name: "sessions_with_cart_additions" },
    { name: "sessions_that_reached_checkout" },
    { name: "sessions_that_completed_checkout" },
  ];

  it("reads rows given as arrays in column order, counts as text", () => {
    const rows = parseTrafficRows({
      columns,
      rows: [
        ["2026-10-04", "social", "facebook", "desktop", "1", "0", "1", "1"],
      ],
    });

    expect(rows).toEqual([
      {
        day: "2026-10-04",
        referrer_source: "social",
        referrer_name: "facebook",
        device_type: "desktop",
        sessions: 1,
        cart_sessions: 0,
        checkout_sessions: 1,
        completed_sessions: 1,
      },
    ]);
  });

  it("reads rows given as objects and cuts a timestamp to its day", () => {
    const rows = parseTrafficRows({
      columns,
      rows: [
        {
          day: "2026-10-05T00:00:00-07:00",
          referrer_source: "direct",
          referrer_name: "",
          session_device_type: "mobile",
          sessions: "4",
          sessions_with_cart_additions: "2",
          sessions_that_reached_checkout: "1",
          sessions_that_completed_checkout: "0",
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      day: "2026-10-05",
      device_type: "mobile",
      sessions: 4,
      cart_sessions: 2,
    });
  });

  it("keeps visits with no recorded source or device as empty text", () => {
    const rows = parseTrafficRows({
      columns,
      rows: [["2026-10-04", null, null, null, "1", "0", "1", "1"]],
    });

    expect(rows[0]).toMatchObject({
      referrer_source: "",
      referrer_name: "",
      device_type: "",
    });
  });

  it("adds up rows that land on the same key, since one upsert cannot touch a row twice", () => {
    const rows = parseTrafficRows({
      columns,
      rows: [
        ["2026-10-04", "social", "facebook", "mobile", "2", "1", "1", "0"],
        ["2026-10-04", "social", " facebook ", "mobile", "3", "0", "1", "1"],
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sessions: 5,
      cart_sessions: 1,
      checkout_sessions: 2,
      completed_sessions: 1,
    });
  });

  it("skips rows with no usable day and survives an empty answer", () => {
    expect(
      parseTrafficRows({
        columns,
        rows: [["Total", "", "", "", "9", "", "", ""]],
      }),
    ).toEqual([]);
    expect(parseTrafficRows(null)).toEqual([]);
    expect(parseTrafficRows({})).toEqual([]);
  });
});

describe("daysToSync", () => {
  const now = new Date("2026-10-14T18:00:00Z");

  it("goes all the way back the first time", () => {
    expect(daysToSync(null, now)).toBe(BACKFILL_DAYS);
  });

  it("reaches a week before the newest day already held, counting a part day whole", () => {
    expect(daysToSync("2026-10-14", now)).toBe(8);
    expect(daysToSync("2026-10-13", now)).toBe(9);
  });

  it("covers a long gap but never more than the first sync does", () => {
    expect(daysToSync("2026-06-14", now)).toBe(130);
    expect(daysToSync("2020-01-01", now)).toBe(BACKFILL_DAYS);
  });

  it("needs one query window per 92 days, and at least one", () => {
    expect(windowsFor(8)).toBe(1);
    expect(windowsFor(92)).toBe(1);
    expect(windowsFor(93)).toBe(2);
    expect(windowsFor(BACKFILL_DAYS)).toBe(9);
  });
});
