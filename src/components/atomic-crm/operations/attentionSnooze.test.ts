import { describe, expect, it } from "vitest";

import type { AttentionItem } from "./attentionModel";
import { snoozeItem, splitSnoozed } from "./attentionSnooze";

const NOW = new Date("2026-10-28T16:00:00Z");
const DAY_MS = 86_400_000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

const carts: AttentionItem = { kind: "abandoned-cart", count: 4 };
const tasks: AttentionItem = { kind: "overdue-tasks", count: 12 };

describe("snoozing a Needs attention row", () => {
  it("hides the row for a week, then brings it back", () => {
    // Arrange
    const snoozes = snoozeItem(undefined, carts, NOW);

    // Act
    const inThreeDays = splitSnoozed([carts, tasks], snoozes, later(3));
    const inEightDays = splitSnoozed([carts, tasks], snoozes, later(8));

    // Assert
    expect(inThreeDays.shown).toEqual([tasks]);
    expect(inThreeDays.hidden).toEqual([carts]);
    expect(inEightDays.shown).toEqual([carts, tasks]);
  });

  it("brings the row back early when something new joins it", () => {
    const snoozes = snoozeItem(undefined, carts, NOW);
    const grown = { ...carts, count: 5 };
    expect(splitSnoozed([grown], snoozes, later(1)).shown).toEqual([grown]);
  });

  it("stays hidden when the row shrinks", () => {
    const snoozes = snoozeItem(undefined, carts, NOW);
    const fewer = { ...carts, count: 2 };
    expect(splitSnoozed([fewer], snoozes, later(1)).hidden).toEqual([fewer]);
  });
});
