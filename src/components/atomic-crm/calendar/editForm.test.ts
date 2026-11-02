import { describe, expect, it } from "vitest";

import type { Appointment } from "../types";
import { patchFrom, problemWith, removeKind, valuesFrom } from "./editForm";

const appt = (over: Partial<Appointment> = {}): Appointment =>
  ({
    id: 1,
    title: "Interior Standard",
    resource: "detailing-bay",
    // 8:00 to 10:30 a.m. in Fort St. John (UTC-7)
    start_at: "2026-11-02T15:00:00Z",
    end_at: "2026-11-02T17:30:00Z",
    status: "booked",
    deposit_paid: true,
    vehicle: "2022 Ram 3500",
    notes: "Call before 9",
    ...over,
  }) as Appointment;

describe("valuesFrom", () => {
  it("reads the booking back onto the shop clock", () => {
    expect(valuesFrom(appt())).toEqual({
      title: "Interior Standard",
      resource: "detailing-bay",
      day: "2026-11-02",
      start: "480",
      duration: "150",
      vehicle: "2022 Ram 3500",
      notes: "Call before 9",
      deposit_paid: true,
    });
  });

  it("fills in blanks for a booking with no car or notes", () => {
    const v = valuesFrom(appt({ vehicle: null, notes: null }));

    expect(v.vehicle).toBe("");
    expect(v.notes).toBe("");
  });
});

describe("patchFrom", () => {
  it("turns day, start and length back into stored times", () => {
    const patch = patchFrom({
      ...valuesFrom(appt()),
      day: "2026-11-03",
      start: "540", // 9:00 a.m.
      duration: "60",
    });

    expect(patch.start_at).toBe("2026-11-03T16:00:00.000Z");
    expect(patch.end_at).toBe("2026-11-03T17:00:00.000Z");
  });

  it("trims text and stores empty car and notes as nothing", () => {
    const patch = patchFrom({
      ...valuesFrom(appt()),
      title: "  New title  ",
      vehicle: "   ",
      notes: "",
    });

    expect(patch.title).toBe("New title");
    expect(patch.vehicle).toBeNull();
    expect(patch.notes).toBeNull();
  });
});

describe("problemWith", () => {
  it("accepts a good booking and names what is missing otherwise", () => {
    const good = valuesFrom(appt());

    expect(problemWith(good)).toBeNull();
    expect(problemWith({ ...good, title: "  " })).toMatch(/title/i);
    expect(problemWith({ ...good, day: "" })).toMatch(/day/i);
    expect(problemWith({ ...good, duration: "0" })).toMatch(/length/i);
  });
});

describe("removeKind", () => {
  it("deletes a booking made only here, and cancels one that lives in Google or Cal.com", () => {
    expect(removeKind({ external_id: null })).toBe("delete");
    expect(removeKind({ external_id: "gcal:abc" })).toBe("cancel");
  });
});
