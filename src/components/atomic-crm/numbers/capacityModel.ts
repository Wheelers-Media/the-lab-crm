// Shop capacity: how full the detailing bay is, how many bookings turn up and
// pay their deposit. The bay takes two drop-offs a day, Monday to Friday.
import { BAY_SLOTS_PER_DAY } from "../operations/metrics";
import {
  addDays,
  type DateRange,
  inRange,
  shopDayKey,
  startOfShopDay,
} from "../operations/shopTime";
import type { Appointment } from "../types";

const isWeekday = (key: string): boolean => {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
};

/** Mon-Fri days from the start of the range up to (not including) its end. */
export const businessDays = (range: DateRange): number => {
  const endKey = shopDayKey(new Date(range.end.getTime() - 1));
  let days = 0;
  for (
    let key = shopDayKey(range.start);
    key <= endKey;
    key = addDays(key, 1)
  ) {
    if (isWeekday(key)) days += 1;
  }
  return days;
};

const kept = (a: Appointment) =>
  a.status === "booked" || a.status === "completed";

export interface Capacity {
  businessDays: number;
  bayBooked: number;
  bayCapacity: number;
  /** Bay slots used, as a whole percent. */
  utilization: number | null;
  ericBooked: number;
  noShows: number;
  /** No-shows as a whole percent of bookings that were due. */
  noShowRate: number | null;
  cancelled: number;
  /** Bookings that paid the deposit, as a whole percent. */
  depositRate: number | null;
}

/**
 * Appointments that started in the range, measured against the days the shop
 * was open. Days before the first booking on file are left out: the CRM only
 * knows about bookings from when it started receiving them, and counting
 * those days as empty would make the bay look idle.
 */
export const shopCapacity = (
  appointments: Appointment[],
  range: DateRange,
): Capacity => {
  const inPeriod = appointments.filter((a) => inRange(a.start_at, range));
  const bay = inPeriod.filter((a) => a.resource === "detailing-bay");
  const first = appointments.reduce<string | null>(
    (min, a) => (min == null || a.start_at < min ? a.start_at : min),
    null,
  );
  const tracked: DateRange = {
    start: first
      ? new Date(
          Math.max(
            range.start.getTime(),
            startOfShopDay(shopDayKey(first)).getTime(),
          ),
        )
      : range.end,
    end: range.end,
  };
  const days = tracked.start < tracked.end ? businessDays(tracked) : 0;
  const bayBooked = bay.filter(kept).length;
  const due = inPeriod.filter((a) => kept(a) || a.status === "no_show");
  const noShows = inPeriod.filter((a) => a.status === "no_show").length;
  return {
    businessDays: days,
    bayBooked,
    bayCapacity: days * BAY_SLOTS_PER_DAY,
    utilization: days
      ? Math.round((bayBooked / (days * BAY_SLOTS_PER_DAY)) * 100)
      : null,
    ericBooked: inPeriod.filter((a) => a.resource === "eric" && kept(a)).length,
    noShows,
    noShowRate: due.length ? Math.round((noShows / due.length) * 100) : null,
    cancelled: inPeriod.filter((a) => a.status === "cancelled").length,
    depositRate: due.length
      ? Math.round(
          (due.filter((a) => a.deposit_paid).length / due.length) * 100,
        )
      : null,
  };
};

export interface UpcomingLoad {
  businessDays: number;
  booked: number;
  capacity: number;
  /** Open bay drop-off slots over the next business days. */
  open: number;
  utilization: number | null;
}

/** How full the bay is over the next two weeks, today included. */
export const upcomingLoad = (
  appointments: Appointment[],
  now: Date,
  days = 14,
): UpcomingLoad => {
  const today = shopDayKey(now);
  const range = {
    start: startOfShopDay(today),
    end: startOfShopDay(addDays(today, days)),
  };
  const open = businessDays(range);
  const booked = appointments.filter(
    (a) =>
      a.resource === "detailing-bay" &&
      a.status === "booked" &&
      inRange(a.start_at, range),
  ).length;
  const capacity = open * BAY_SLOTS_PER_DAY;
  return {
    businessDays: open,
    booked,
    capacity,
    open: Math.max(0, capacity - booked),
    utilization: capacity ? Math.round((booked / capacity) * 100) : null,
  };
};
