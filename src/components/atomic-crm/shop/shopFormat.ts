import type { Contact, Order } from "../types";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** "$1,234.50" for CAD; other currencies keep their code ("US$37.00"). */
export const formatMoney = (
  amount: number | null | undefined,
  currency = "CAD",
): string => {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(Number(amount) || 0);
};

/** What the customer actually kept paying for: total minus refunds. */
export const orderNet = (order: Pick<Order, "total" | "refunded_amount">) =>
  Math.max(
    0,
    (Number(order.total) || 0) - (Number(order.refunded_amount) || 0),
  );

export type CustomerSpend = {
  orderCount: number;
  lifetime: number;
  lastOrderedAt: string | null;
};

/**
 * Lifetime spend in CAD across a customer's orders. Cancelled orders and
 * deposits are left out: the $50 deposit is credited to the final invoice,
 * so counting it would count the same money twice.
 */
export const customerSpend = (
  orders: Array<
    Pick<
      Order,
      "total" | "refunded_amount" | "cancelled_at" | "is_deposit" | "ordered_at"
    > & { currency?: string }
  >,
): CustomerSpend => {
  const counted = orders.filter(
    (o) => !o.cancelled_at && !o.is_deposit && (o.currency ?? "CAD") === "CAD",
  );
  const lastOrderedAt = orders.reduce<string | null>(
    (latest, o) => (!latest || o.ordered_at > latest ? o.ordered_at : latest),
    null,
  );
  return {
    orderCount: counted.length,
    lifetime: counted.reduce((sum, o) => sum + orderNet(o), 0),
    lastOrderedAt,
  };
};

/** Plain-language payment status for an order row. */
export const orderStatusLabel = (
  order: Pick<
    Order,
    "financial_status" | "cancelled_at" | "refunded_amount" | "total"
  >,
): string => {
  if (order.cancelled_at) return "Cancelled";
  const refunded = Number(order.refunded_amount) || 0;
  if (refunded > 0 && refunded >= (Number(order.total) || 0)) return "Refunded";
  if (refunded > 0) return "Part refunded";
  switch (order.financial_status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "authorized":
      return "Authorized";
    case "partially_paid":
      return "Part paid";
    default:
      return order.financial_status || "Unknown";
  }
};

/** Short summary of what was bought: "2× Ceramic Tint - Front Roll Ups, +1 more". */
export const summarizeLines = (
  lines: Array<{ name: string; quantity: number }> | null | undefined,
  max = 2,
): string => {
  const items = Array.isArray(lines) ? lines : [];
  if (items.length === 0) return "";
  const shown = items
    .slice(0, max)
    .map((l) =>
      l.quantity > 1
        ? `${l.quantity}× ${shortName(l.name)}`
        : shortName(l.name),
    );
  const rest = items.length - max;
  return rest > 0 ? `${shown.join(", ")}, +${rest} more` : shown.join(", ");
};

const shortName = (name: string) =>
  name.replace(/^Universal Fit\s*[-–]\s*(THE LAB|Suntek)\s*[-–]\s*/i, "");

/** Local calendar date (YYYY-MM-DD), so "upcoming" starts at midnight today. */
export const todayDate = (now = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const contactDisplayName = (c: Contact): string =>
  [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
  c.email_jsonb?.[0]?.email ||
  c.phone_jsonb?.[0]?.number ||
  "Contact";
