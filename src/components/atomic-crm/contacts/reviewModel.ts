// When a customer is due a review ask, worked out from plain records so the
// rule can be read (and tested) without a database. The work a customer has
// finished is a paid order, a job that was picked up (or won), or an
// appointment they kept; the most recent one is what the text talks about.
import { reviewAsk, reviewSubject } from "../shopfloor/reviewAsk";
import type { Appointment, Deal, Order } from "../types";

const DAY_MS = 86_400_000;

/** A review asked later than this reads as spam, so the card stays quiet. */
export const REVIEW_WINDOW_DAYS = 30;

export interface ReviewAskPlan {
  /** The pre-filled text, ready for Messages. */
  text: string;
  /** What the text calls the work, to show beside the button. */
  subject: string;
  /** "order #1201", "Ceramic tint", ... for the line explaining the ask. */
  what: string;
  /** When the work was finished. */
  at: string;
}

interface FinishedWork {
  at: string;
  names: string[];
  what: string;
}

const orderWhat = (order: Order): string =>
  order.order_number ? `order ${order.order_number}` : "purchase";

/** Everything the customer has finished, with the names to read the work from. */
const finishedWork = (
  orders: Order[],
  appointments: Appointment[],
  deals: Deal[],
): FinishedWork[] => {
  const out: FinishedWork[] = [];
  for (const order of orders) {
    if (order.cancelled_at || order.is_deposit) continue;
    out.push({
      at: order.ordered_at,
      names: (order.line_items ?? []).map((line) => line.name),
      what: orderWhat(order),
    });
  }
  for (const deal of deals) {
    if (deal.archived_at) continue;
    const finished = deal.work_status === "picked_up" || deal.stage === "won";
    if (!finished) continue;
    out.push({
      at:
        deal.work_status_changed_at ?? deal.stage_changed_at ?? deal.updated_at,
      names: [deal.name],
      what: deal.name,
    });
  }
  for (const appointment of appointments) {
    if (appointment.status !== "completed") continue;
    out.push({
      at: appointment.start_at,
      names: [appointment.title],
      what: appointment.title,
    });
  }
  return out;
};

export interface ReviewAskInput {
  firstName?: string | null;
  /** The contact's main vehicle, when they have one. */
  vehicle?: string | null;
  orders?: Order[];
  appointments?: Appointment[];
  deals?: Deal[];
  now?: Date;
}

/**
 * The review ask for this customer, or null when nothing has been finished in
 * the last 30 days, so the profile does not keep offering the same text.
 */
export const reviewAskFor = ({
  firstName,
  vehicle,
  orders = [],
  appointments = [],
  deals = [],
  now = new Date(),
}: ReviewAskInput): ReviewAskPlan | null => {
  const t = now.getTime();
  const latest = finishedWork(orders, appointments, deals)
    .filter((work) => {
      const at = new Date(work.at).getTime();
      return (
        !Number.isNaN(at) && at <= t && t - at < REVIEW_WINDOW_DAYS * DAY_MS
      );
    })
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest) return null;

  return {
    text: reviewAsk({ firstName, vehicle, names: latest.names }),
    subject: reviewSubject({ names: latest.names, vehicle }),
    what: latest.what,
    at: latest.at,
  };
};
