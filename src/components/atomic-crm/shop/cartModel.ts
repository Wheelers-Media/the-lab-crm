// What the shop wants to know about an abandoned cart: how long ago it was
// left, how hot it still is, and a ready-to-send text. Plain records in,
// plain answers out, so the rules can be tested without a screen.
import { SHOP_PHONE } from "../shopfloor/messageTemplates";
import type { OrderLineItem, ShopifyCheckout } from "../types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type CartHeat = "hot" | "warm" | "cold";

/** "20 minutes ago", "3 hours ago", "2 days ago". */
export const agoLabel = (iso: string, now: Date = new Date()): string => {
  const ms = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (ms < HOUR_MS) {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (ms < DAY_MS) {
    const hours = Math.round(ms / HOUR_MS);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(ms / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** Fresh carts are the ones worth a call: under a day hot, under a week warm. */
export const cartHeat = (
  checkout: Pick<ShopifyCheckout, "checkout_updated_at">,
  now: Date = new Date(),
): CartHeat => {
  const age = now.getTime() - new Date(checkout.checkout_updated_at).getTime();
  if (age < DAY_MS) return "hot";
  if (age < 7 * DAY_MS) return "warm";
  return "cold";
};

export const HEAT_LABEL: Record<CartHeat, string> = {
  hot: "Left today",
  warm: "This week",
  cold: "Gone cold",
};

export const lineTotal = (line: OrderLineItem): number =>
  (Number(line.price) || 0) * (Number(line.quantity) || 1);

/** Whether the shop can reach the customer, and by what. */
export const reachOf = (
  checkout: Pick<ShopifyCheckout, "phone" | "email">,
): { phone: string | null; email: string | null } => ({
  phone: checkout.phone?.trim() || null,
  email: checkout.email?.trim() || null,
});

export interface CartTotals {
  count: number;
  value: number;
  hot: number;
  unreachable: number;
}

/** The numbers over the list: how much is sitting in carts and how much can still be won. */
export const cartTotals = (
  checkouts: ShopifyCheckout[],
  now: Date = new Date(),
): CartTotals => ({
  count: checkouts.length,
  value: checkouts.reduce((sum, c) => sum + (Number(c.total) || 0), 0),
  hot: checkouts.filter((c) => cartHeat(c, now) === "hot").length,
  unreachable: checkouts.filter((c) => {
    const { phone, email } = reachOf(c);
    return !phone && !email;
  }).length,
});

const firstWord = (name: string | null | undefined): string =>
  name?.trim().split(/\s+/)[0] || "there";

/** The first item's name, trimmed to something a person would say. */
const itemPhrase = (lines: OrderLineItem[]): string => {
  const [first] = lines;
  if (!first?.name) return "your cart";
  const short = first.name.replace(/\s+/g, " ").trim().slice(0, 60);
  return lines.length > 1 ? `${short} and ${lines.length - 1} more` : short;
};

/**
 * A recovery text in the shop team's voice: personal, no pressure, an offer to answer
 * fitment questions, and the cart link when there is one. Never sent for the
 * shop; it only fills the Messages app.
 */
export const recoveryText = (
  checkout: Pick<
    ShopifyCheckout,
    "customer_name" | "line_items" | "recovery_url"
  >,
): string => {
  const link =
    checkout.recovery_url && /^https:\/\//i.test(checkout.recovery_url)
      ? `\n\nYour cart is saved here: ${checkout.recovery_url}`
      : "";
  return `Hey ${firstWord(checkout.customer_name)}, it's the team at THE LAB. we saw you were looking at ${itemPhrase(checkout.line_items ?? [])}. If you've got any questions on fitment or what goes with what, text back or call ${SHOP_PHONE} and we'll sort you out.${link}`;
};
