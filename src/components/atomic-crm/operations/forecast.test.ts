import { describe, expect, it } from "vitest";

import {
  isInProgress,
  landing,
  paceRange,
  paceSentence,
  project,
  projectRecords,
  shortMoney,
  workdaysBetween,
} from "./forecast";
import { periodRange } from "./shopTime";

// November 2026: Sunday the 1st, 21 working days. Wednesday the 11th, noon.
const NOW = new Date("2026-11-11T19:00:00Z");
const month = periodRange("month", NOW);

describe("workdaysBetween", () => {
  it("counts weekdays only, a part-day as a part", () => {
    expect(workdaysBetween(month.start, month.end)).toBe(21);
    // Mon 2 to Tue 10 is 7 weekdays, plus the morning of Wed 11 (noon shop time)
    expect(workdaysBetween(month.start, NOW)).toBeCloseTo(7.5, 5);
  });
});

describe("project", () => {
  it("lands at the whole-period pace for the rest of the month", () => {
    const done = workdaysBetween(month.start, NOW);
    const p = project(done * 100, null, month, NOW); // $100 a working day
    expect(Math.round(p.projected)).toBe(2100);
    expect(p.low).toBe(p.high);
    expect(p.workdaysLeft).toBeCloseTo(21 - done, 5);
  });

  it("widens to a range when the last week ran hotter than the month", () => {
    const done = workdaysBetween(month.start, NOW);
    const p = project(done * 100, 5 * 160, month, NOW);
    expect(p.low).toBeLessThan(p.high);
    expect(p.high).toBeGreaterThan(p.projected);
    expect(p.projected).toBeGreaterThanOrEqual(p.low);
  });

  it("says early under three working days in", () => {
    const early = new Date("2026-11-03T19:00:00Z");
    expect(project(100, 100, month, early).confidence).toBe("early");
    expect(project(1000, 1000, month, NOW).confidence).toBe("fair");
  });

  it("has nothing to project once the period is over", () => {
    const after = new Date("2026-12-02T19:00:00Z");
    const p = project(5000, 0, month, after);
    expect(p.final).toBe(true);
    expect(p.projected).toBe(5000);
    expect(isInProgress(month, after)).toBe(false);
    expect(isInProgress(month, NOW)).toBe(true);
  });
});

describe("projectRecords", () => {
  it("sums what is dated inside the period and counts the last seven days as recent", () => {
    const items = [
      { at: "2026-11-03T18:00:00Z", n: 100 },
      { at: "2026-11-10T18:00:00Z", n: 300 },
      { at: "2026-10-30T18:00:00Z", n: 999 }, // before the period
      { at: "2026-11-20T18:00:00Z", n: 999 }, // in the future
    ];
    const p = projectRecords(
      items,
      (i) => i.at,
      (i) => i.n,
      month,
      NOW,
    );
    expect(p.current).toBe(400);
  });
});

describe("landing", () => {
  it("compares the projection with the goal and the daily pace to reach it", () => {
    const p = project(3000, null, month, NOW);
    const l = landing(p, 10_000);
    expect(l.hits).toBe(p.projected >= 10_000);
    expect(l.perDayNeeded).toBeCloseTo((10_000 - 3000) / p.workdaysLeft, 5);
    expect(l.percent).toBe(Math.round((p.projected / 10_000) * 100));
  });
});

describe("wording", () => {
  it("writes a sentence, a range and short money", () => {
    const done = workdaysBetween(month.start, NOW);
    const p = project(done * 100, 5 * 160, month, NOW);
    expect(paceSentence(p, shortMoney)).toMatch(/^On pace for \$/);
    expect(paceRange(p, shortMoney)).toMatch(/ to /);
    expect(shortMoney(14_200)).toBe("$14k");
    expect(shortMoney(2_450)).toBe("$2.5k");
    expect(shortMoney(480)).toBe("$480");
    const early = project(100, 100, month, new Date("2026-11-03T19:00:00Z"));
    expect(paceSentence(early, shortMoney)).toMatch(/^Early guess/);
  });
});
