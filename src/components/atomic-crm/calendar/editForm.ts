// Editing a booking: the form's values, turned into the fields that are saved,
// and whether removing it deletes the row or cancels it. Pure, so it can be
// tested without a screen.
import { shopDayKey, startOfShopDay } from "../operations/shopTime";
import type { Appointment } from "../types";
import { minutesIntoDay } from "./gridLayout";

export interface EditValues {
  title: string;
  resource: Appointment["resource"];
  /** The shop-clock day, "2026-11-02". */
  day: string;
  /** Minutes into the day the booking starts, as the select holds it. */
  start: string;
  /** Length in minutes. */
  duration: string;
  vehicle: string;
  notes: string;
  deposit_paid: boolean;
}

export const valuesFrom = (a: Appointment): EditValues => ({
  title: a.title,
  resource: a.resource,
  day: shopDayKey(a.start_at),
  start: String(minutesIntoDay(a.start_at)),
  duration: String(
    Math.max(
      15,
      Math.round(
        (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) /
          60_000,
      ),
    ),
  ),
  vehicle: a.vehicle ?? "",
  notes: a.notes ?? "",
  deposit_paid: a.deposit_paid,
});

/** What the form asks for that cannot be saved, or null when it can. */
export const problemWith = (v: EditValues): string | null => {
  if (!v.title.trim()) return "Give the appointment a title.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.day)) return "Pick a day.";
  if (!(Number(v.duration) > 0)) return "The appointment needs a length.";
  return null;
};

/** The fields to save: day, start and length become stored timestamps. */
export const patchFrom = (v: EditValues) => {
  const start = new Date(
    startOfShopDay(v.day).getTime() + Number(v.start) * 60_000,
  );
  const end = new Date(start.getTime() + Number(v.duration) * 60_000);
  return {
    title: v.title.trim(),
    resource: v.resource,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    vehicle: v.vehicle.trim() || null,
    notes: v.notes.trim() || null,
    deposit_paid: v.deposit_paid,
  };
};

/**
 * A booking made only here can be deleted. One that exists in Google or
 * Cal.com is cancelled instead: deleting the row would let the next sync bring
 * it straight back, while a cancellation is carried to Google.
 */
export const removeKind = (a: Pick<Appointment, "external_id">) =>
  a.external_id ? ("cancel" as const) : ("delete" as const);
