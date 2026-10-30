import { describe, expect, it } from "vitest";

import { monthDays, monthStart, shiftMonth } from "./monthRange";

describe("monthDays", () => {
  it("covers October 2026 with five whole weeks, Monday to Sunday", () => {
    const days = monthDays("2026-10-30");

    expect(days).toHaveLength(35);
    expect(days[0]).toBe("2026-09-28"); // 1 Oct 2026 is a Thursday
    expect(days[34]).toBe("2026-11-01");
    expect(days).toContain("2026-10-01");
    expect(days).toContain("2026-10-31");
  });

  it("uses only four weeks when the month fits them exactly", () => {
    const days = monthDays("2027-02-10"); // 1 Feb 2027 is a Monday, 28 days

    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2027-02-01");
    expect(days[27]).toBe("2027-02-28");
  });

  it("needs six weeks when a long month starts late in the week", () => {
    const days = monthDays("2026-08-15"); // 1 Aug 2026 is a Saturday, 31 days

    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-07-27");
  });
});

describe("shiftMonth", () => {
  it("moves to the 1st of another month", () => {
    expect(shiftMonth("2026-10-30", 1, "2026-10-30")).toBe("2026-11-01");
    expect(shiftMonth("2026-01-15", -1, "2026-10-30")).toBe("2025-12-01");
  });

  it("goes to today when it lands on the current month", () => {
    expect(shiftMonth("2026-11-01", -1, "2026-10-30")).toBe("2026-10-30");
  });
});

describe("monthStart", () => {
  it("is the first of the month the day falls in", () => {
    expect(monthStart("2026-10-30")).toBe("2026-10-01");
  });
});
