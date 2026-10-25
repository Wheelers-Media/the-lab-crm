import type { Appointment } from "../types";

/** Where an appointment came from, in the shop's words. */
export const appointmentSource = (appointment: Appointment): string =>
  appointment.source === "google"
    ? "From Google Calendar"
    : appointment.source === "calcom"
      ? "Cal.com booking"
      : "Added in the CRM";
