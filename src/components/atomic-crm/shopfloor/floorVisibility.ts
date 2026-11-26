// When a job shows the shop floor controls. They are for a vehicle that is
// actually at the shop: on its appointment day (to mark it arrived) and while
// it is on the floor (in the shop, waiting on parts, ready). Before it comes
// in, and once it has been picked up, they are only clutter.
import { shopDayKey } from "../operations/shopTime";
import type { Appointment, Deal } from "../types";
import { FLOOR_STATUSES } from "./workStatus";

const KEPT_STATUSES: Appointment["status"][] = [
  "booked",
  "rescheduled",
  "completed",
];

export const showsFloorControls = (
  deal: Pick<Deal, "work_status" | "archived_at" | "stage">,
  appointments: Array<Pick<Appointment, "start_at" | "status">>,
  now: Date = new Date(),
): boolean => {
  if (deal.archived_at || deal.work_status === "picked_up") return false;
  if (deal.work_status && FLOOR_STATUSES.includes(deal.work_status))
    return true;
  const today = shopDayKey(now);
  return appointments.some(
    (a) => KEPT_STATUSES.includes(a.status) && shopDayKey(a.start_at) === today,
  );
};
