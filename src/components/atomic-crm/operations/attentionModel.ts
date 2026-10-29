// What needs someone today on the home screen, computed from plain records
// so it can be tested without a database.
import type { Appointment, Deal, ShopifyCheckout, Task } from "../types";
import { PARTS_NUDGE_DAYS, PICKUP_NUDGE_DAYS } from "../shopfloor/workStatus";
import { activeAppointments, BIG_CART_THRESHOLD } from "./metrics";
import { shopDayKey, startOfShopDay } from "./shopTime";

const DAY_MS = 86_400_000;

/** Requests, quotes and overdue tasks older than this are a backlog, not today's work. */
export const ATTENTION_WINDOW_DAYS = 60;

export type AttentionKind =
  | "abandoned-cart"
  | "show-check"
  | "quotes-waiting"
  | "new-requests"
  | "no-deposit"
  | "pickups-waiting"
  | "parts-waiting"
  | "overdue-tasks";

export interface AttentionItem {
  kind: AttentionKind;
  count: number;
  amount?: number;
  oldest?: string;
  detail?: string;
  /** Items past the attention window, left out of `count` but still on their own page. */
  older?: number;
}

/** How far back Home asks "did they show?" about bookings nobody settled. */
export const SHOW_CHECK_DAYS = 7;

/**
 * Bookings from the last week, before today, still marked booked: nobody
 * paid around the booking day (that marks them done automatically) and
 * nobody said whether they came. Oldest first.
 */
export const bookingsToCheck = (
  appointments: Appointment[],
  now: Date,
): Appointment[] => {
  const today = startOfShopDay(shopDayKey(now)).getTime();
  const since = today - SHOW_CHECK_DAYS * DAY_MS;
  return appointments
    .filter((a) => {
      const start = new Date(a.start_at).getTime();
      return a.status === "booked" && start < today && start >= since;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
};

export interface AttentionInput {
  deals: Deal[];
  appointments: Appointment[];
  checkouts: ShopifyCheckout[];
  tasks: Task[];
  now?: Date;
}

/**
 * What needs someone today, most urgent first. Empty groups are left out.
 * Requests, quotes and tasks older than the attention window are counted as
 * `older` instead: a backlog that has sat for months is not today's work, and
 * leaving it in kept the list from ever emptying.
 */
export const needsAttention = ({
  deals,
  appointments,
  checkouts,
  tasks,
  now = new Date(),
}: AttentionInput): AttentionItem[] => {
  const t = now.getTime();
  const items: AttentionItem[] = [];
  const isRecent = (iso: string) =>
    t - new Date(iso).getTime() < ATTENTION_WINDOW_DAYS * DAY_MS;
  const older = (all: number, recent: number) =>
    all > recent ? { older: all - recent } : {};

  const carts = checkouts.filter(
    (c) =>
      !c.completed_at &&
      Number(c.total) >= BIG_CART_THRESHOLD &&
      t - new Date(c.checkout_updated_at).getTime() > 3_600_000 &&
      t - new Date(c.checkout_updated_at).getTime() < 14 * DAY_MS,
  );
  if (carts.length) {
    items.push({
      kind: "abandoned-cart",
      count: carts.length,
      amount: carts.reduce((s, c) => s + Number(c.total), 0),
      oldest: carts.map((c) => c.checkout_updated_at).sort()[0],
    });
  }

  const unpaid = activeAppointments(appointments).filter(
    (a) =>
      a.status === "booked" &&
      !a.deposit_paid &&
      new Date(a.start_at).getTime() > t,
  );
  if (unpaid.length) {
    const next = [...unpaid].sort((a, b) =>
      a.start_at.localeCompare(b.start_at),
    )[0];
    items.push({
      kind: "no-deposit",
      count: unpaid.length,
      oldest: next.start_at,
      detail: next.title,
    });
  }

  const toCheck = bookingsToCheck(appointments, now);
  if (toCheck.length) {
    items.push({
      kind: "show-check",
      count: toCheck.length,
      oldest: toCheck[0].start_at,
    });
  }

  const waitingFor = (status: "ready" | "waiting_parts", days: number) =>
    deals.filter(
      (d) =>
        d.work_status === status &&
        !d.archived_at &&
        d.work_status_changed_at &&
        t - new Date(d.work_status_changed_at).getTime() >= days * DAY_MS,
    );
  const pickups = waitingFor("ready", PICKUP_NUDGE_DAYS);
  if (pickups.length) {
    items.push({
      kind: "pickups-waiting",
      count: pickups.length,
      oldest: pickups.map((d) => d.work_status_changed_at!).sort()[0],
    });
  }
  const parts = waitingFor("waiting_parts", PARTS_NUDGE_DAYS);
  if (parts.length) {
    items.push({
      kind: "parts-waiting",
      count: parts.length,
      oldest: parts.map((d) => d.work_status_changed_at!).sort()[0],
    });
  }

  const allIntake = deals.filter((d) => d.stage === "intake" && !d.archived_at);
  const intake = allIntake.filter((d) => isRecent(d.created_at));
  if (intake.length) {
    items.push({
      kind: "new-requests",
      count: intake.length,
      oldest: intake.map((d) => d.created_at).sort()[0],
      ...older(allIntake.length, intake.length),
    });
  }

  const quotedAt = (d: Deal) => d.stage_changed_at ?? d.updated_at;
  const allWaiting = deals.filter(
    (d) =>
      d.stage === "quoted" &&
      !d.archived_at &&
      t - new Date(quotedAt(d)).getTime() >= 3 * DAY_MS,
  );
  const waiting = allWaiting.filter((d) => isRecent(quotedAt(d)));
  if (waiting.length) {
    items.push({
      kind: "quotes-waiting",
      count: waiting.length,
      amount: waiting.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      oldest: waiting.map(quotedAt).sort()[0],
      ...older(allWaiting.length, waiting.length),
    });
  }

  const allOverdue = tasks.filter(
    (task) => !task.done_date && new Date(task.due_date).getTime() < t,
  );
  const overdue = allOverdue.filter((task) => isRecent(task.due_date));
  if (overdue.length) {
    items.push({
      kind: "overdue-tasks",
      count: overdue.length,
      oldest: overdue.map((task) => task.due_date).sort()[0],
      ...older(allOverdue.length, overdue.length),
    });
  }

  return items;
};
