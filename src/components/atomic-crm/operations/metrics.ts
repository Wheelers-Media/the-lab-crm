// Numbers for the home dashboard, computed from plain records so they can be
// tested without a database.
import type { Appointment, Deal, Order, ShopifyCheckout, Task } from "../types";
import { type DateRange, inRange, shopDayKey } from "./shopTime";

export const OPEN_STAGES = ["intake", "qualified", "quoted", "booked"];
export const BAY_SLOTS_PER_DAY = 2;
export const BIG_CART_THRESHOLD = 2000;

const DAY_MS = 86_400_000;

const countedOrders = (orders: Order[], range: DateRange): Order[] =>
  orders.filter((o) => !o.cancelled_at && inRange(o.ordered_at, range));

const netTotal = (o: Order): number =>
  Math.max(0, Number(o.total) - Number(o.refunded_amount ?? 0));

export const orderRevenue = (orders: Order[], range: DateRange): number =>
  countedOrders(orders, range).reduce((sum, o) => sum + netTotal(o), 0);

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

export interface ShopifyStats {
  orders: number; // sales orders, booking deposits left out
  averageOrder: number | null;
  customers: number; // distinct linked contacts with a sales order
  refunded: number;
  refundedOrders: number;
  deposits: number;
  depositAmount: number;
}

/** Order counts and values for the period. Deposits are counted on their own so they don't drag the average down. */
export const shopifyStats = (
  orders: Order[],
  range: DateRange,
): ShopifyStats => {
  const inPeriod = countedOrders(orders, range);
  const sales = inPeriod.filter((o) => !o.is_deposit);
  const deposits = inPeriod.filter((o) => o.is_deposit);
  const salesTotal = sales.reduce((s, o) => s + netTotal(o), 0);
  const refunds = inPeriod.filter((o) => Number(o.refunded_amount) > 0);
  return {
    orders: sales.length,
    averageOrder: sales.length ? salesTotal / sales.length : null,
    customers: new Set(
      sales.map((o) => o.contact_id).filter((id) => id != null),
    ).size,
    refunded: refunds.reduce((s, o) => s + Number(o.refunded_amount), 0),
    refundedOrders: refunds.length,
    deposits: deposits.length,
    depositAmount: deposits.reduce((s, o) => s + netTotal(o), 0),
  };
};

export interface CartStats {
  started: number;
  completed: number;
  abandoned: number;
  abandonedValue: number;
  completionRate: number | null; // completed / started, whole percent
}

/** Checkouts last touched in the period; open ones under an hour old are still in progress and left out. */
export const cartStats = (
  checkouts: ShopifyCheckout[],
  range: DateRange,
  now: Date = new Date(),
): CartStats => {
  const settled = checkouts.filter(
    (c) =>
      inRange(c.checkout_updated_at, range) &&
      (c.completed_at ||
        now.getTime() - new Date(c.checkout_updated_at).getTime() > 3_600_000),
  );
  const open = settled.filter((c) => !c.completed_at);
  const completed = settled.length - open.length;
  return {
    started: settled.length,
    completed,
    abandoned: open.length,
    abandonedValue: open.reduce((s, c) => s + Number(c.total), 0),
    completionRate: settled.length
      ? Math.round((completed / settled.length) * 100)
      : null,
  };
};

export interface ProductSales {
  name: string;
  quantity: number;
  revenue: number;
}

// Fees and adjustments that are not products
const NOT_A_PRODUCT =
  /^(shop supplies.*|mechanical shop supplies|shipping.*|duty fees.*|tip|custom sale|test amount)$/i;

export const cleanProductName = (name: string): string =>
  name
    // "Universal Fit - THE LAB - X", "Universal Fit - Suntek - X", "Universal – X"
    .replace(/^Universal(?: Fit)?\s*[-–]\s*(?:THE LAB\s*[-–]\s*)?/i, "")
    .trim();

/** Best sellers by line revenue in the period (list price × quantity, before refunds). */
export const topProducts = (
  orders: Order[],
  range: DateRange,
  limit = 5,
): ProductSales[] => {
  const byName = new Map<string, ProductSales>();
  for (const o of countedOrders(orders, range)) {
    if (o.is_deposit) continue;
    for (const line of o.line_items ?? []) {
      const name = cleanProductName(line.name);
      if (!name || NOT_A_PRODUCT.test(name)) continue;
      const row = byName.get(name) ?? { name, quantity: 0, revenue: 0 };
      const qty = Number(line.quantity) || 0;
      row.quantity += qty;
      row.revenue += qty * (Number(line.price) || 0);
      byName.set(name, row);
    }
  }
  return [...byName.values()]
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, limit);
};

export interface CategoryCount {
  category: string;
  orders: number;
}

/** How many sales orders included each kind of work or product. An order with two kinds counts in both. */
export const ordersByCategory = (
  orders: Order[],
  range: DateRange,
): CategoryCount[] => {
  const counts = new Map<string, number>();
  for (const o of countedOrders(orders, range)) {
    if (o.is_deposit) continue;
    for (const c of o.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([category, n]) => ({ category, orders: n }))
    .sort(
      (a, b) => b.orders - a.orders || a.category.localeCompare(b.category),
    );
};
