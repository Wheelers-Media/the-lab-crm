import { describe, expect, it } from "vitest";

import {
  gridHours,
  minutesIntoDay,
  placeEvents,
  snapToSlot,
} from "./gridLayout";

const at = (startMin: number, endMin: number, name = "x") => ({
  name,
  startMin,
  endMin,
});

describe("minutesIntoDay", () => {
  it("reads a timestamp on the shop clock (Fort St. John, UTC-7 all year)", () => {
    expect(minutesIntoDay("2026-11-02T15:00:00Z")).toBe(8 * 60);
    expect(minutesIntoDay("2026-07-02T19:30:00Z")).toBe(12 * 60 + 30);
  });
});

describe("placeEvents", () => {
  it("gives lone appointments the full width", () => {
    const [a, b] = placeEvents([at(480, 540, "a"), at(600, 660, "b")]);

    expect([a.col, a.cols, b.col, b.cols]).toEqual([0, 1, 0, 1]);
  });

  it("puts overlapping appointments side by side", () => {
    const placed = placeEvents([at(480, 600, "a"), at(540, 660, "b")]);

    expect(placed.map((p) => [p.event.name, p.col, p.cols])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("reuses a freed column and keeps separate clusters independent", () => {
    const placed = placeEvents([
      at(480, 600, "a"),
      at(500, 560, "b"),
      at(570, 630, "c"), // starts after b ends, still overlaps a: takes b's column
      at(900, 960, "d"), // a new cluster, full width
    ]);
    const by = Object.fromEntries(
      placed.map((p) => [p.event.name, [p.col, p.cols]]),
    );

    expect(by.a).toEqual([0, 2]);
    expect(by.b).toEqual([1, 2]);
    expect(by.c).toEqual([1, 2]);
    expect(by.d).toEqual([0, 1]);
  });

  it("handles no appointments", () => {
    expect(placeEvents([])).toEqual([]);
  });
});

describe("gridHours", () => {
  it("shows the shop day by default", () => {
    expect(gridHours([])).toEqual({ start: 7, end: 19 });
  });

  it("stretches to take in an early or late booking, in whole hours", () => {
    expect(
      gridHours([at(6 * 60 + 15, 7 * 60), at(18 * 60, 20 * 60 + 20)]),
    ).toEqual({
      start: 6,
      end: 21,
    });
  });
});

describe("snapToSlot", () => {
  it("rounds a click to the nearest half hour inside the form's choices", () => {
    expect(snapToSlot(8 * 60 + 10)).toBe(8 * 60);
    expect(snapToSlot(8 * 60 + 20)).toBe(8 * 60 + 30);
    expect(snapToSlot(5 * 60)).toBe(7 * 60);
    expect(snapToSlot(20 * 60)).toBe(18 * 60);
  });
});
