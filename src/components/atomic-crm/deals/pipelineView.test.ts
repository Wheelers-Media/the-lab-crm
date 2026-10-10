import { describe, expect, it } from "vitest";

import type { Deal } from "../types";
import {
  COLUMN_PAGE_SIZE,
  columnView,
  isClosedStage,
  stageTotal,
} from "./pipelineView";

const NOW = new Date("2026-10-09T18:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const deal = (id: number, stage: string, movedDaysAgo: number, amount = 100) =>
  ({
    id,
    stage,
    amount,
    stage_changed_at: daysAgo(movedDaysAgo),
    created_at: daysAgo(movedDaysAgo + 5),
    updated_at: daysAgo(movedDaysAgo),
  }) as unknown as Deal;

describe("columnView", () => {
  it("hides converted jobs that closed more than 30 days ago", () => {
    const deals = [deal(1, "won", 2), deal(2, "won", 45), deal(3, "won", 29)];
    const view = columnView(deals, "won", { now: NOW });
    expect(view.visible.map((d) => d.id)).toEqual([1, 3]);
    expect(view.olderCount).toBe(1);
  });

  it("shows older closed jobs when asked", () => {
    const deals = [deal(1, "lost", 2), deal(2, "lost", 90)];
    const view = columnView(deals, "lost", { now: NOW, showOlder: true });
    expect(view.visible).toHaveLength(2);
    expect(view.olderCount).toBe(0);
  });

  it("never hides open jobs for being old", () => {
    const deals = [deal(1, "quoted", 120)];
    expect(columnView(deals, "quoted", { now: NOW }).visible).toHaveLength(1);
  });

  it("shows a first page and counts the rest", () => {
    const deals = Array.from({ length: COLUMN_PAGE_SIZE + 7 }, (_, i) =>
      deal(i, "intake", 1),
    );
    const view = columnView(deals, "intake", { now: NOW });
    expect(view.visible).toHaveLength(COLUMN_PAGE_SIZE);
    expect(view.moreCount).toBe(7);
    expect(
      columnView(deals, "intake", { now: NOW, showAll: true }).moreCount,
    ).toBe(0);
  });
});

describe("pipeline helpers", () => {
  it("treats converted and not now as closed", () => {
    expect(isClosedStage("won")).toBe(true);
    expect(isClosedStage("lost")).toBe(true);
    expect(isClosedStage("booked")).toBe(false);
  });

  it("adds up a stage", () => {
    expect(stageTotal([{ amount: 180 }, { amount: 260 }])).toBe(440);
  });
});
