import { describe, expect, it } from "vitest";

import type { Appointment } from "../types";
import {
  DEFAULT_FILTERS,
  filtersActive,
  matchesFilters,
  parseFilters,
} from "./filterModel";

const appt = (over: Partial<Appointment> = {}): Appointment =>
  ({
    id: 1,
    resource: "detailing-bay",
    status: "booked",
    deposit_paid: true,
    ...over,
  }) as Appointment;

describe("matchesFilters", () => {
  it("shows everything by default", () => {
    expect(matchesFilters(appt(), DEFAULT_FILTERS)).toBe(true);
    expect(
      matchesFilters(
        appt({ resource: "eric", status: "no_show" }),
        DEFAULT_FILTERS,
      ),
    ).toBe(true);
  });

  it("hides a calendar that is switched off", () => {
    const f = { ...DEFAULT_FILTERS, eric: false };
    expect(matchesFilters(appt({ resource: "eric" }), f)).toBe(false);
    expect(matchesFilters(appt({ resource: "detailing-bay" }), f)).toBe(true);
  });

  it("hides a status that is switched off", () => {
    const f = { ...DEFAULT_FILTERS, done: false, noShow: false };
    expect(matchesFilters(appt({ status: "completed" }), f)).toBe(false);
    expect(matchesFilters(appt({ status: "no_show" }), f)).toBe(false);
    expect(matchesFilters(appt({ status: "booked" }), f)).toBe(true);
  });

  it("can show only upcoming bookings still owing a deposit", () => {
    const f = { ...DEFAULT_FILTERS, noDepositOnly: true };
    expect(matchesFilters(appt({ deposit_paid: false }), f)).toBe(true);
    expect(matchesFilters(appt({ deposit_paid: true }), f)).toBe(false);
    expect(
      matchesFilters(appt({ deposit_paid: false, status: "completed" }), f),
    ).toBe(false);
  });
});

describe("filtersActive", () => {
  it("counts the switches that differ from the defaults", () => {
    expect(filtersActive(DEFAULT_FILTERS)).toBe(0);
    expect(
      filtersActive({ ...DEFAULT_FILTERS, eric: false, noDepositOnly: true }),
    ).toBe(2);
  });
});

describe("parseFilters", () => {
  it("restores saved switches and ignores anything odd", () => {
    expect(parseFilters('{"eric":false,"bay":"yes","extra":1}')).toEqual({
      ...DEFAULT_FILTERS,
      eric: false,
    });
  });

  it("falls back to the defaults when nothing usable was saved", () => {
    expect(parseFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(parseFilters("not json")).toEqual(DEFAULT_FILTERS);
  });
});
