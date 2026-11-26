import { describe, expect, it } from "vitest";

import { showsFloorControls } from "./floorVisibility";

const NOW = new Date("2026-11-26T18:00:00Z"); // 11 a.m. in Fort St. John
const appt = (
  start_at: string,
  status: "booked" | "cancelled" | "completed" = "booked",
) => ({
  start_at,
  status,
});

describe("showsFloorControls", () => {
  it("shows on the appointment day so the vehicle can be marked arrived", () => {
    expect(
      showsFloorControls(
        { stage: "booked" },
        [appt("2026-11-26T16:00:00Z")],
        NOW,
      ),
    ).toBe(true);
  });

  it("hides before the vehicle's appointment day and with no appointment", () => {
    expect(
      showsFloorControls(
        { stage: "booked" },
        [appt("2026-11-30T16:00:00Z")],
        NOW,
      ),
    ).toBe(false);
    expect(showsFloorControls({ stage: "quoted" }, [], NOW)).toBe(false);
  });

  it("ignores a cancelled appointment today", () => {
    expect(
      showsFloorControls(
        { stage: "booked" },
        [appt("2026-11-26T16:00:00Z", "cancelled")],
        NOW,
      ),
    ).toBe(false);
  });

  it("stays visible while the vehicle is on the floor, whatever the date", () => {
    for (const work_status of ["in_shop", "waiting_parts", "ready"] as const) {
      expect(
        showsFloorControls({ stage: "booked", work_status }, [], NOW),
      ).toBe(true);
    }
  });

  it("hides once picked up, even on the appointment day", () => {
    expect(
      showsFloorControls(
        { stage: "won", work_status: "picked_up" },
        [appt("2026-11-26T16:00:00Z", "completed")],
        NOW,
      ),
    ).toBe(false);
  });
});
