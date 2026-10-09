import { describe, expect, it } from "vitest";

import { toAppointment } from "./toAppointment";

describe("toAppointment", () => {
  it("stores the chosen Fort St. John day and time, whatever the device clock says", () => {
    const appt = toAppointment({
      contact_id: 7,
      title: "Ceramic tint, crew cab",
      resource: "eric",
      day: "2026-10-09",
      time: "600", // 10:00 a.m.
      duration: "120",
      deposit_paid: false,
    });
    // 10:00 in Fort St. John (UTC-7) is 17:00 UTC
    expect(appt.start_at).toBe("2026-10-09T17:00:00.000Z");
    expect(appt.end_at).toBe("2026-10-09T19:00:00.000Z");
    expect(appt).toMatchObject({
      source: "manual",
      status: "booked",
      contact_id: 7,
      vehicle: null,
    });
  });

  it("keeps an 8 a.m. drop-off at 8 a.m. in winter too", () => {
    const appt = toAppointment({
      title: "Drop-off",
      resource: "detailing-bay",
      day: "2027-01-15",
      time: "480",
      duration: "60",
      deposit_paid: true,
    });
    expect(appt.start_at).toBe("2027-01-15T15:00:00.000Z");
    expect(appt.contact_id).toBeNull();
  });
});
