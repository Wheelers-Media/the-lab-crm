import { describe, expect, it } from "vitest";

import { formatDue } from "./taskDue";

// Saturday Oct 10, 2026, 6 PM local
const now = new Date(2026, 9, 10, 18, 0);

describe("formatDue", () => {
  it("says overdue with a short date and no seconds", () => {
    // Arrange / Act
    const due = formatDue(new Date(2024, 2, 6, 10, 42, 56).toISOString(), now);

    // Assert
    expect(due).toEqual({ label: "Overdue · Mar 6, 2024", isOverdue: true });
  });

  it("names today and tomorrow, with the time when there is one", () => {
    // Arrange / Act
    const today = formatDue(new Date(2026, 9, 10, 20, 30).toISOString(), now);
    const tomorrow = formatDue("2026-10-11", now);

    // Assert
    expect(today.label).toMatch(/^Today, 8:30/);
    expect(tomorrow).toEqual({ label: "Tomorrow", isOverdue: false });
  });

  it("uses the weekday within a week and the date after that", () => {
    // Arrange / Act
    const soon = formatDue("2026-10-14", now);
    const later = formatDue("2026-11-02", now);

    // Assert
    expect(soon.label).toBe("Wednesday");
    expect(later.label).toBe("Nov 2");
  });

  it("reads a date-only due date as that calendar day, not the day before", () => {
    // Arrange / Act
    const due = formatDue("2026-10-10", now);

    // Assert
    expect(due).toEqual({ label: "Today", isOverdue: false });
  });
});
