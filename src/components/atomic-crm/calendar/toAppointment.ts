import { startOfShopDay } from "../operations/shopTime";

export type AppointmentForm = {
  contact_id?: number;
  title: string;
  resource: string;
  day: string;
  time: string;
  duration: string;
  deposit_paid: boolean;
  vehicle?: string;
  notes?: string;
};

/** Converts the form's shop-clock day and time into stored timestamps. */
export const toAppointment = (values: AppointmentForm) => {
  const start = new Date(
    startOfShopDay(values.day).getTime() + Number(values.time) * 60_000,
  );
  const end = new Date(start.getTime() + Number(values.duration) * 60_000);
  return {
    contact_id: values.contact_id ?? null,
    title: values.title,
    resource: values.resource,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    deposit_paid: values.deposit_paid ?? false,
    vehicle: values.vehicle || null,
    notes: values.notes || null,
    source: "manual",
    status: "booked",
  };
};
