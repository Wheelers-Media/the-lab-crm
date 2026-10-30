// What the calendar shows, the way Google Calendar lets you switch calendars on
// and off. Pure, so it can be tested without a screen.
import type { Appointment } from "../types";

export interface CalendarFilters {
  /** The detailing bay's drop-offs. */
  bay: boolean;
  /** Eric's own jobs. */
  eric: boolean;
  booked: boolean;
  done: boolean;
  noShow: boolean;
  /** Only upcoming bookings whose $50 deposit has not been paid. */
  noDepositOnly: boolean;
}

export const DEFAULT_FILTERS: CalendarFilters = {
  bay: true,
  eric: true,
  booked: true,
  done: true,
  noShow: true,
  noDepositOnly: false,
};

const KEYS = Object.keys(DEFAULT_FILTERS) as Array<keyof CalendarFilters>;

/** How many switches differ from the defaults, for the badge on the button. */
export const filtersActive = (f: CalendarFilters): number =>
  KEYS.filter((k) => f[k] !== DEFAULT_FILTERS[k]).length;

export const matchesFilters = (a: Appointment, f: CalendarFilters): boolean => {
  if (!(a.resource === "detailing-bay" ? f.bay : f.eric)) return false;
  const status =
    a.status === "completed"
      ? f.done
      : a.status === "no_show"
        ? f.noShow
        : f.booked;
  if (!status) return false;
  if (f.noDepositOnly && (a.deposit_paid || a.status !== "booked"))
    return false;
  return true;
};

/** Saved filters, with anything missing or odd falling back to the default. */
export const parseFilters = (raw: string | null): CalendarFilters => {
  try {
    const saved = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    const next = { ...DEFAULT_FILTERS };
    for (const k of KEYS) {
      if (typeof saved?.[k] === "boolean") next[k] = saved[k] as boolean;
    }
    return next;
  } catch {
    return DEFAULT_FILTERS;
  }
};
