// The shop floor: where each vehicle is once it has arrived. Pure helpers, so
// the board, the dashboard and the follow-up rules in the database agree.
import type { Deal, WorkStatus } from "../types";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  in_shop: "In the shop",
  waiting_parts: "Waiting on parts",
  ready: "Ready for pickup",
  picked_up: "Picked up",
};

/** The columns of the board; a picked-up vehicle has left the floor. */
export const FLOOR_STATUSES: WorkStatus[] = [
  "in_shop",
  "waiting_parts",
  "ready",
];

// Same limits as the follow-up rules in supabase/schemas/08_the_lab.sql
export const PICKUP_NUDGE_DAYS = 2;
export const PARTS_NUDGE_DAYS = 5;

const DAY_MS = 86_400_000;

export const isWorkStatus = (value: unknown): value is WorkStatus =>
  typeof value === "string" && value in WORK_STATUS_LABEL;

/** The next steps from a status; from nothing the only step is arriving. */
export const NEXT_STATUSES: Record<WorkStatus | "none", WorkStatus[]> = {
  none: ["in_shop"],
  in_shop: ["ready", "waiting_parts"],
  waiting_parts: ["in_shop", "ready"],
  ready: ["picked_up"],
  picked_up: [],
};

/** The button text for moving a vehicle to a status, from where it is now. */
export const actionLabel = (
  from: WorkStatus | null | undefined,
  to: WorkStatus,
): string => {
  if (to === "in_shop")
    return from === "waiting_parts" ? "Parts in" : "Arrived";
  return WORK_STATUS_LABEL[to];
};

/** Whole days the vehicle has been in its status, or null when unknown. */
export const daysInStatus = (
  deal: Pick<Deal, "work_status_changed_at">,
  now: Date = new Date(),
): number | null => {
  if (!deal.work_status_changed_at) return null;
  const since = new Date(deal.work_status_changed_at).getTime();
  if (Number.isNaN(since)) return null;
  return Math.max(0, Math.floor((now.getTime() - since) / DAY_MS));
};

/** A vehicle that has waited long enough for the shop to chase it. */
export const needsChasing = (
  deal: Pick<Deal, "work_status" | "work_status_changed_at">,
  now: Date = new Date(),
): boolean => {
  const days = daysInStatus(deal, now);
  if (days == null) return false;
  if (deal.work_status === "ready") return days >= PICKUP_NUDGE_DAYS;
  if (deal.work_status === "waiting_parts") return days >= PARTS_NUDGE_DAYS;
  return false;
};

export interface FloorColumn {
  status: WorkStatus;
  label: string;
  deals: Deal[];
}

/** The board: one column per floor status, longest-waiting first. */
export const floorColumns = (deals: Deal[]): FloorColumn[] =>
  FLOOR_STATUSES.map((status) => ({
    status,
    label: WORK_STATUS_LABEL[status],
    deals: deals
      .filter((d) => d.work_status === status && !d.archived_at)
      .sort(
        (a, b) =>
          (a.work_status_changed_at ?? "").localeCompare(
            b.work_status_changed_at ?? "",
          ) || String(a.id).localeCompare(String(b.id)),
      ),
  }));

export interface FloorCounts {
  inShop: number;
  waitingParts: number;
  ready: number;
  /** Vehicles waiting longer than the shop wants (pickups, parts). */
  chase: number;
}

export const floorCounts = (
  deals: Deal[],
  now: Date = new Date(),
): FloorCounts => {
  const onFloor = deals.filter(
    (d) => !d.archived_at && FLOOR_STATUSES.includes(d.work_status as never),
  );
  return {
    inShop: onFloor.filter((d) => d.work_status === "in_shop").length,
    waitingParts: onFloor.filter((d) => d.work_status === "waiting_parts")
      .length,
    ready: onFloor.filter((d) => d.work_status === "ready").length,
    chase: onFloor.filter((d) => needsChasing(d, now)).length,
  };
};
