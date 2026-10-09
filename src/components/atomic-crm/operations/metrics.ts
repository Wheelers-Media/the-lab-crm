// Numbers for the home dashboard, computed from plain records so they can be
// tested without a database.
import type { Appointment, Deal, Order, ShopifyCheckout, Task } from "../types";
import { type DateRange, inRange, shopDayKey } from "./shopTime";

export const OPEN_STAGES = ["intake", "qualified", "quoted", "booked"];
export const BAY_SLOTS_PER_DAY = 2;
export const BIG_CART_THRESHOLD = 2000;

const DAY_MS = 86_400_000;

export const orderRevenue = (orders: Order[], range: DateRange): number =>
  orders
    .filter((o) => !o.cancelled_at && inRange(o.ordered_at, range))
    .reduce(
      (sum, o) =>
        sum + Math.max(0, Number(o.total) - Number(o.refunded_amount ?? 0)),
      0,
    );

/** Change between two values as a whole percentage, or null when there is no base. */
export const percentChange = (
  current: number,
  previous: number,
): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

export interface LeadStats {
  total: number;
  website: number;
  booked: number; // reached Booked or Converted
  conversion: number | null; // booked / total, whole percent
}

export const leadStats = (deals: Deal[], range: DateRange): LeadStats => {
  const leads = deals.filter((d) => inRange(d.created_at, range));
  const booked = leads.filter(
    (d) => d.stage === "booked" || d.stage === "won",
  ).length;
  return {
    total: leads.length,
    website: leads.filter((d) => d.lead_source === "website").length,
    booked,
    conversion: leads.length ? Math.round((booked / leads.length) * 100) : null,
  };
};

export const openPipeline = (
  deals: Deal[],
): { amount: number; count: number } => {
  const open = deals.filter(
    (d) => OPEN_STAGES.includes(d.stage) && !d.archived_at,
  );
  return {
    amount: open.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    count: open.length,
  };
};

export const activeAppointments = (
  appointments: Appointment[],
): Appointment[] =>
  appointments.filter((a) => a.status === "booked" || a.status === "completed");

export interface DayLoad {
  key: string;
  bay: number;
  eric: number;
}

export const dayLoads = (
  appointments: Appointment[],
  keys: string[],
): DayLoad[] =>
  keys.map((key) => {
    const day = activeAppointments(appointments).filter(
      (a) => shopDayKey(a.start_at) === key,
    );
    return {
      key,
      bay: day.filter((a) => a.resource === "detailing-bay").length,
      eric: day.filter((a) => a.resource === "eric").length,
    };
  });

export type AttentionKind =
  | "abandoned-cart"
  | "quotes-waiting"
  | "new-requests"
  | "no-deposit"
  | "overdue-tasks";

export interface AttentionItem {
  kind: AttentionKind;
  count: number;
  amount?: number;
  oldest?: string;
  detail?: string;
}

export interface AttentionInput {
  deals: Deal[];
  appointments: Appointment[];
  checkouts: ShopifyCheckout[];
  tasks: Task[];
  now?: Date;
}

/** What needs someone today, most urgent first. Empty groups are left out. */
export const needsAttention = ({
  deals,
  appointments,
  checkouts,
  tasks,
  now = new Date(),
}: AttentionInput): AttentionItem[] => {
  const t = now.getTime();
  const items: AttentionItem[] = [];

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

  const intake = deals.filter((d) => d.stage === "intake" && !d.archived_at);
  if (intake.length) {
    items.push({
      kind: "new-requests",
      count: intake.length,
      oldest: intake.map((d) => d.created_at).sort()[0],
    });
  }

  const waiting = deals.filter(
    (d) =>
      d.stage === "quoted" &&
      !d.archived_at &&
      t - new Date(d.stage_changed_at ?? d.updated_at).getTime() >= 3 * DAY_MS,
  );
  if (waiting.length) {
    items.push({
      kind: "quotes-waiting",
      count: waiting.length,
      amount: waiting.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      oldest: waiting.map((d) => d.stage_changed_at ?? d.updated_at).sort()[0],
    });
  }

  const overdue = tasks.filter(
    (task) => !task.done_date && new Date(task.due_date).getTime() < t,
  );
  if (overdue.length) {
    items.push({
      kind: "overdue-tasks",
      count: overdue.length,
      oldest: overdue.map((task) => task.due_date).sort()[0],
    });
  }

  return items;
};
