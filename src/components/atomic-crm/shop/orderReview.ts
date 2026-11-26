// Asking for reviews from the Orders tab. A text the minute an order lands
// reaches people on the road home, so the shop asks in the evening, when they
// are home and relaxed. Plain records in, plain answers out.
import { REVIEW_WINDOW_DAYS } from "../contacts/reviewModel";
import {
  shopDayKey,
  shopHour,
  startOfShopDay,
  addDays,
} from "../operations/shopTime";
import type { Order } from "../types";
import { orderStatusLabel } from "./shopFormat";

/** The text Eric's team leaves on a customer's notes once the ask has gone out. */
export const REVIEW_NOTE_PREFIX = "Review asked";

/** Evening, shop time: home from work, supper done, phone in hand. */
export const EVENING_START_HOUR = 17;
export const EVENING_END_HOUR = 21;
/** When "remind me this evening" fires. */
export const EVENING_REMINDER_HOUR = 18;

const DAY_MS = 86_400_000;

/** A paid order the customer actually kept: no deposits, no cancels, no full refunds. */
export const canAskReview = (
  order: Pick<
    Order,
    | "is_deposit"
    | "cancelled_at"
    | "financial_status"
    | "refunded_amount"
    | "total"
    | "contact_id"
  >,
): boolean =>
  order.contact_id != null &&
  !order.is_deposit &&
  !order.cancelled_at &&
  ["Paid", "Part refunded"].includes(orderStatusLabel(order));

/** Orders still worth a review ask: recent, and not asked for already. */
export const isDueForReview = (
  order: Pick<Order, "ordered_at">,
  now: Date = new Date(),
): boolean => {
  const age = now.getTime() - new Date(order.ordered_at).getTime();
  return age >= 0 && age < REVIEW_WINDOW_DAYS * DAY_MS;
};

export interface ReviewTiming {
  good: boolean;
  label: string;
}

/** Whether now is a kind moment to text a customer for a review. */
export const reviewTiming = (now: Date = new Date()): ReviewTiming => {
  const hour = shopHour(now);
  if (hour >= EVENING_START_HOUR && hour < EVENING_END_HOUR) {
    return {
      good: true,
      label: "Good time to send: they're home for the evening.",
    };
  }
  if (hour < EVENING_START_HOUR) {
    return {
      good: false,
      label:
        "They're likely at work or driving home. Better after 5 p.m., so use Remind me this evening.",
    };
  }
  return {
    good: false,
    label: "It's late. Better to send tomorrow evening.",
  };
};

/** The next 6 p.m. on the shop's clock: tonight, or tomorrow if tonight has passed. */
export const nextEveningReminder = (now: Date = new Date()): Date => {
  const today = shopDayKey(now);
  const tonight = new Date(
    startOfShopDay(today).getTime() + EVENING_REMINDER_HOUR * 3_600_000,
  );
  return tonight.getTime() > now.getTime()
    ? tonight
    : new Date(
        startOfShopDay(addDays(today, 1)).getTime() +
          EVENING_REMINDER_HOUR * 3_600_000,
      );
};

/** "Review asked for order #1042." and the day, for the customer's notes. */
export const askedNote = (order: Pick<Order, "order_number">): string =>
  `${REVIEW_NOTE_PREFIX} for order ${order.order_number.startsWith("#") ? "" : "#"}${order.order_number}.`;

/**
 * Customers who were asked for a review within the last 30 days, from the
 * notes. Counted per customer, not per order, so someone with two orders is
 * never texted for a review twice in a row.
 */
export const askedContacts = (
  notes: Array<{
    contact_id: unknown;
    text?: string | null;
    date?: string | null;
  }>,
  now: Date = new Date(),
): Set<string> => {
  const asked = new Set<string>();
  for (const note of notes) {
    if (!note.text?.startsWith(REVIEW_NOTE_PREFIX)) continue;
    const at = note.date ? new Date(note.date).getTime() : now.getTime();
    if (now.getTime() - at < REVIEW_WINDOW_DAYS * DAY_MS) {
      asked.add(String(note.contact_id));
    }
  }
  return asked;
};

export const wasAsked = (
  order: Pick<Order, "contact_id">,
  asked: Set<string>,
): boolean => order.contact_id != null && asked.has(String(order.contact_id));
