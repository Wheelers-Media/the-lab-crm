import { describe, expect, it } from "vitest";

import { defaultDealStages } from "../root/defaultConfiguration";
import { getDealsByStage, nextStage } from "./stages";

describe("nextStage", () => {
  it("takes an ordinary quoted job straight to Booked", () => {
    expect(nextStage(defaultDealStages, "quoted")?.value).toBe("booked");
  });

  it("steps an install job from parts on the way to ready to book to booked", () => {
    expect(nextStage(defaultDealStages, "parts_on_the_way")?.value).toBe(
      "ready_to_book",
    );
    expect(nextStage(defaultDealStages, "ready_to_book")?.value).toBe("booked");
  });
});

describe("getDealsByStage order", () => {
  it("lists every column newest job first, open or closed", () => {
    const mk = (id: number, stage: string, created_at: string, index = 0) =>
      ({ id, stage, created_at, index }) as never;
    const columns = getDealsByStage(
      [
        mk(1, "quoted", "2026-01-01T00:00:00Z", 0),
        mk(2, "quoted", "2026-03-01T00:00:00Z", 5),
        mk(3, "quoted", "2026-02-01T00:00:00Z", 2),
        mk(4, "won", "2026-01-05T00:00:00Z"),
        mk(5, "won", "2026-04-05T00:00:00Z"),
      ],
      defaultDealStages,
    );
    expect(columns.quoted.map((d) => d.id)).toEqual([2, 3, 1]);
    expect(columns.won.map((d) => d.id)).toEqual([5, 4]);
  });
});
