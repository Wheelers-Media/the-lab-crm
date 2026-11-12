import { describe, expect, it } from "vitest";

import { defaultDealStages } from "../root/defaultConfiguration";
import { nextStage } from "./stages";

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
