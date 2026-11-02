// The maths behind the Day and Week time grid: where an appointment sits on the
// hour lines and how overlapping ones share a column, like Google Calendar.
// Pure, so it can be tested without a screen.
import { shopDayKey, startOfShopDay } from "../operations/shopTime";

/** Minutes into the shop day (0 to 1440) for a stored timestamp. */
export const minutesIntoDay = (iso: string): number =>
  Math.round(
    (new Date(iso).getTime() - startOfShopDay(shopDayKey(iso)).getTime()) /
      60_000,
  );

export interface Timed {
  /** Minutes into the shop day the appointment starts. */
  startMin: number;
  /** Minutes into the shop day it ends; a booking that runs past midnight stops at 1440. */
  endMin: number;
}

export interface Placed<T extends Timed> {
  event: T;
  /** Side by side with the others it overlaps: column `col` of `cols`. */
  col: number;
  cols: number;
}

/**
 * Gives each appointment a column so that ones overlapping in time sit side by
 * side and the rest take the full width.
 */
export const placeEvents = <T extends Timed>(events: T[]): Array<Placed<T>> => {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  );
  const placed: Array<Placed<T>> = [];
  let cluster: Array<{ event: T; col: number }> = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = Math.max(1, columnEnds.length);
    for (const item of cluster) placed.push({ ...item, cols });
    cluster = [];
    columnEnds = [];
  };

  for (const event of sorted) {
    if (cluster.length && event.startMin >= clusterEnd) flush();
    let col = columnEnds.findIndex((end) => end <= event.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(event.endMin);
    } else {
      columnEnds[col] = event.endMin;
    }
    cluster.push({ event, col });
    clusterEnd = Math.max(clusterEnd, event.endMin);
  }
  if (cluster.length) flush();
  return placed;
};

/**
 * The hours the grid shows: the shop's day, stretched to take in anything
 * booked earlier or later, always whole hours.
 */
export const gridHours = (
  events: Timed[],
  shopStart = 7,
  shopEnd = 19,
): { start: number; end: number } => {
  const first = events.length
    ? Math.min(...events.map((e) => e.startMin))
    : shopStart * 60;
  const last = events.length
    ? Math.max(...events.map((e) => e.endMin))
    : shopEnd * 60;
  return {
    start: Math.min(shopStart, Math.floor(first / 60)),
    end: Math.max(shopEnd, Math.ceil(last / 60)),
  };
};

/** A clicked spot (minutes into the day) as the nearest half hour, kept inside the add form's choices. */
export const snapToSlot = (minutes: number, first = 7 * 60, last = 18 * 60) =>
  Math.min(last, Math.max(first, Math.round(minutes / 30) * 30));
