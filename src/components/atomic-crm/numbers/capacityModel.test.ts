import { describe, expect, it } from "vitest";

import type { Appointment } from "../types";
import { businessDays, shopCapacity, upcomingLoad } from "./capacityModel";
import { numbersRanges } from "./periods";

// Friday Oct 9 2026, 9:00 in Fort St. John
const NOW = new Date("2026-10-09T16:00:00Z");
const { current } = numbersRanges("month", NOW);

const appt = (over: Partial<Appointment>): Appointment =>
  ({
    id: Math.random(),
    resource: "detailing-bay",
    status: "booked",
    deposit_paid: true,
    start_at: "2026-10-05T15:00:00Z",
    ...over,
  }) as Appointment;

describe("businessDays", () => {
  it("counts Monday to Friday only", () => {
    expect(businessDays(current)).toBe(7); // Oct 1-9 2026: Thu, Fri, then Mon-Fri, Mon-Fri minus weekend
  });
});

describe("shopCapacity", () => {
  it("measures bay bookings against two slots a business day", () => {
    const appointments = [
      appt({}),
      appt({ status: "completed" }),
      appt({ status: "cancelled" }),
      appt({ resource: "eric" }),
    ];

    const c = shopCapacity(appointments, current);

    expect(c).toMatchObject({
      bayBooked: 2,
      bayCapacity: 10, // the first booking on file is Oct 5: five business days
      utilization: 20,
      ericBooked: 1,
      cancelled: 1,
    });
  });

  it("reports no-shows and how many bookings paid the deposit", () => {
    const appointments = [
      appt({}),
      appt({ status: "completed", deposit_paid: false }),
      appt({ status: "no_show", deposit_paid: false }),
      appt({ status: "no_show", deposit_paid: true }),
    ];

    const c = shopCapacity(appointments, current);

    expect(c.noShows).toBe(2);
    expect(c.noShowRate).toBe(50);
    expect(c.depositRate).toBe(50);
  });

  it("only counts the days since the first booking on file, so untracked months do not look empty", () => {
    // The first booking is Oct 5: only Oct 5, 6, 7, 8, 9 count (5 business days)
    const c = shopCapacity(
      [appt({ start_at: "2026-10-05T15:00:00Z" })],
      current,
    );

    expect(c).toMatchObject({
      businessDays: 5,
      bayCapacity: 10,
      bayBooked: 1,
      utilization: 10,
    });
  });

  it("has no utilization when no bookings are on file at all", () => {
    expect(shopCapacity([], current)).toMatchObject({
      businessDays: 0,
      utilization: null,
    });
  });

  it("ignores appointments outside the period", () => {
    const c = shopCapacity(
      [appt({ start_at: "2026-09-10T15:00:00Z" })],
      current,
    );

    expect(c.bayBooked).toBe(0);
    expect(c.noShowRate).toBeNull();
  });
});

describe("upcomingLoad", () => {
  it("measures the next two weeks of bay bookings against open slots", () => {
    const appointments = [
      appt({ start_at: "2026-10-12T15:00:00Z" }),
      appt({ start_at: "2026-10-13T15:00:00Z" }),
      appt({ start_at: "2026-10-14T15:00:00Z", resource: "eric" }),
      appt({ start_at: "2026-10-30T15:00:00Z" }), // beyond two weeks
    ];

    const load = upcomingLoad(appointments, NOW);

    expect(load).toMatchObject({
      businessDays: 10,
      booked: 2,
      capacity: 20,
      open: 18,
      utilization: 10,
    });
  });
});
