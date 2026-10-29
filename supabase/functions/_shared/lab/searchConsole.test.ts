import { describe, expect, it } from "vitest";

import {
  parseDaily,
  parseDetail,
  pickSite,
  queryBody,
  syncWindow,
} from "./searchConsole.ts";

describe("pickSite", () => {
  it("prefers the domain property, which covers every address of the site", () => {
    const site = pickSite([
      { siteUrl: "https://thelabfsj.ca/", permissionLevel: "siteFullUser" },
      {
        siteUrl: "sc-domain:thelabfsj.ca",
        permissionLevel: "siteRestrictedUser",
      },
      { siteUrl: "https://other.ca/", permissionLevel: "siteOwner" },
    ]);

    expect(site).toBe("sc-domain:thelabfsj.ca");
  });

  it("falls back to the https address and skips ones it cannot read", () => {
    expect(
      pickSite([
        {
          siteUrl: "sc-domain:thelabfsj.ca",
          permissionLevel: "siteUnverifiedUser",
        },
        { siteUrl: "http://thelabfsj.ca/", permissionLevel: "siteFullUser" },
        {
          siteUrl: "https://www.thelabfsj.ca/",
          permissionLevel: "siteFullUser",
        },
      ]),
    ).toBe("https://www.thelabfsj.ca/");
  });

  it("finds nothing when the account was not added to the shop's site", () => {
    expect(pickSite([{ siteUrl: "https://other.ca/" }])).toBeNull();
    expect(pickSite([])).toBeNull();
  });
});

describe("syncWindow", () => {
  const today = new Date("2026-10-29T18:00:00Z");

  it("takes the whole history on the first copy, up to yesterday", () => {
    expect(syncWindow(null, today, 480)).toEqual({
      startDate: "2025-07-05",
      endDate: "2026-10-28",
    });
  });

  it("reaches a few days back from the newest copied day, since Google revises them", () => {
    expect(syncWindow("2026-10-27", today, 480)).toEqual({
      startDate: "2026-10-23",
      endDate: "2026-10-28",
    });
  });
});

describe("queryBody", () => {
  it("asks for web results by the given dimensions, one page at a time", () => {
    expect(
      queryBody(
        { startDate: "2026-10-01", endDate: "2026-10-28" },
        ["date", "query"],
        25000,
      ),
    ).toMatchObject({
      startDate: "2026-10-01",
      endDate: "2026-10-28",
      dimensions: ["date", "query"],
      type: "web",
      rowLimit: 25000,
      startRow: 25000,
    });
  });
});

describe("parsing Google's rows", () => {
  it("turns daily rows into whole clicks and impressions with a rounded position", () => {
    expect(
      parseDaily([
        {
          keys: ["2026-10-27"],
          clicks: 4,
          impressions: 210,
          ctr: 0.019,
          position: 11.4567,
        },
        { keys: ["not a day"], clicks: 1 },
      ]),
    ).toEqual([
      { day: "2026-10-27", clicks: 4, impressions: 210, position: 11.46 },
    ]);
  });

  it("keys search phrase rows by the phrase, dropping blank ones", () => {
    expect(
      parseDetail(
        [
          {
            keys: ["2026-10-27", " window tint fort st john "],
            clicks: 2,
            impressions: 30,
            position: 3.2,
          },
          { keys: ["2026-10-27", ""], clicks: 1, impressions: 2, position: 1 },
        ],
        "query",
      ),
    ).toEqual([
      {
        day: "2026-10-27",
        query: "window tint fort st john",
        clicks: 2,
        impressions: 30,
        position: 3.2,
      },
    ]);
  });
});
