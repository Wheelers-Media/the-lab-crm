import { describe, expect, it } from "vitest";

import {
  elapsedShare,
  goalProgress,
  monthlyTargets,
  suggestTarget,
  targetForPeriod,
} from "./goalsModel";
import { startOfShopDay } from "./shopTime";

describe("targetForPeriod", () => {
  it("scales a monthly goal to a week and to one working day", () => {
    expect(targetForPeriod(26_000, "month")).toBe(26_000);
    expect(targetForPeriod(26_000, "week")).toBe(6_000);
    expect(Math.round(targetForPeriod(26_000, "today"))).toBe(1_200);
  });
});

describe("goalProgress", () => {
  it("says behind pace when the shop is short of where it should be by now", () => {
    // Arrange: halfway through the month, a third of the way to the goal
    const goal = goalProgress("revenue", 10_000, 30_000, "month", 0.5, false);

    // Assert
    expect(goal.status).toBe("behind");
    expect(goal.expectedByNow).toBe(15_000);
    expect(goal.vsPace).toBe(-5_000);
    expect(goal.progress).toBeCloseTo(1 / 3);
  });

  it("counts within five percent of the pace as on pace", () => {
    expect(goalProgress("orders", 49, 100, "month", 0.5, false).status).toBe(
      "on-pace",
    );
  });

  it("marks a goal met however early it is", () => {
    expect(goalProgress("orders", 101, 100, "month", 0.2, false).status).toBe(
      "done",
    );
  });
});

describe("suggestTarget", () => {
  it("rounds ten percent above last month up to a clean number", () => {
    expect(suggestTarget(75_427, true)).toBe(83_000);
    expect(suggestTarget(8_200, true)).toBe(9_500);
    expect(suggestTarget(68, false)).toBe(75);
    expect(suggestTarget(12, false)).toBe(14);
  });

  it("offers a starting goal when there was nothing last month", () => {
    expect(suggestTarget(0, true)).toBe(10_000);
    expect(suggestTarget(0, false)).toBe(10);
  });
});

describe("monthlyTargets", () => {
  it("uses saved goals and suggests the ones not set", () => {
    const targets = monthlyTargets(
      { revenue: 90_000 },
      { revenue: 75_000, orders: 70, newCustomers: 20 },
    );
    expect(targets.revenue).toEqual({ value: 90_000, suggested: false });
    expect(targets.orders).toEqual({ value: 80, suggested: true });
    expect(targets.newCustomers.suggested).toBe(true);
  });
});

describe("elapsedShare", () => {
  // Mon Oct 5 to Mon Oct 12 2026, in shop days
  const week = {
    start: startOfShopDay("2026-10-05"),
    end: startOfShopDay("2026-10-12"),
  };

  it("counts weekdays only, so the weekend does not put the shop behind", () => {
    // Saturday: all five weekdays are behind us
    expect(elapsedShare(week, startOfShopDay("2026-10-10"))).toBe(1);
    // Wednesday at the start of the day: two of five weekdays done
    expect(elapsedShare(week, startOfShopDay("2026-10-07"))).toBeCloseTo(0.4);
  });

  it("clamps to 0 before the period and 1 after it", () => {
    expect(elapsedShare(week, startOfShopDay("2026-10-01"))).toBe(0);
    expect(elapsedShare(week, startOfShopDay("2026-11-01"))).toBe(1);
  });

  it("counts a single day by the clock", () => {
    const day = {
      start: new Date("2026-10-06T00:00:00Z"),
      end: new Date("2026-10-07T00:00:00Z"),
    };
    expect(elapsedShare(day, new Date("2026-10-06T12:00:00Z"))).toBe(0.5);
  });
});
