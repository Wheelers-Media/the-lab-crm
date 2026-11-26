// The records behind a tile, as rows for the detail sheet: one builder per
// kind of record, so every tile follows its number down to the same pages.
import type { DrillRow } from "../operations/DrillSheet";
import { money } from "../operations/format";
import { inRange, type DateRange } from "../operations/shopTime";
import { agoLabel } from "../shop/cartModel";
import { orderNet, summarizeLines } from "../shop/shopFormat";
import type { Appointment, Deal, Order, ShopifyCheckout } from "../types";
import {
  type LedgerRow,
  customerLedger,
  type LedgerOrder,
} from "./customerModel";

export const shortDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

export const orderRows = (orders: Order[], limit = 200): DrillRow[] =>
  [...orders]
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at))
    .slice(0, limit)
    .map((o) => ({
      key: o.id,
      title: `Order ${o.order_number}${o.is_deposit ? " (deposit)" : ""}`,
      subtitle: `${shortDay(o.ordered_at)} · ${summarizeLines(o.line_items, 2)}`,
      value: money(orderNet(o)),
      to: `/orders/${o.id}/show`,
    }));

export const dealRows = (deals: Deal[], limit = 200): DrillRow[] =>
  [...deals]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((d) => ({
      key: d.id,
      title: d.name,
      subtitle: `${d.stage.replace(/_/g, " ")} · came in ${shortDay(d.created_at)}${d.lead_source ? ` · ${d.lead_source}` : ""}`,
      value: d.amount ? money(Number(d.amount)) : undefined,
      to: `/deals/${d.id}/show`,
    }));

export const cartRows = (
  carts: ShopifyCheckout[],
  onOpen: (cart: ShopifyCheckout) => void,
  limit = 200,
): DrillRow[] =>
  [...carts]
    .sort((a, b) => b.checkout_updated_at.localeCompare(a.checkout_updated_at))
    .slice(0, limit)
    .map((c) => ({
      key: c.id,
      title: c.customer_name || c.email || c.phone || "Unknown customer",
      subtitle: `${summarizeLines(c.line_items, 2)} · ${agoLabel(c.checkout_updated_at)}`,
      value: money(Number(c.total)),
      onOpen: () => onOpen(c),
    }));

export const appointmentRows = (
  appointments: Appointment[],
  limit = 200,
): DrillRow[] =>
  [...appointments]
    .sort((a, b) => b.start_at.localeCompare(a.start_at))
    .slice(0, limit)
    .map((a) => ({
      key: a.id,
      title: a.title,
      subtitle: `${shortDay(a.start_at)} · ${a.status.replace(/_/g, " ")}${a.deposit_paid ? " · deposit paid" : ""}`,
      to: a.contact_id != null ? `/contacts/${a.contact_id}/show` : undefined,
    }));

/** Customers who ordered in the range, with whether the range holds their first order ever. */
export const customersInRange = (
  orders: LedgerOrder[],
  range: DateRange,
): { active: LedgerRow[]; added: LedgerRow[]; returning: LedgerRow[] } => {
  const ledger = customerLedger(orders);
  const ids = new Set(
    orders
      .filter(
        (o) =>
          !o.cancelled_at &&
          !o.is_deposit &&
          o.contact_id != null &&
          inRange(o.ordered_at, range),
      )
      .map((o) => o.contact_id as LedgerRow["contactId"]),
  );
  const active = [...ids]
    .map((id) => ledger.get(id))
    .filter((r): r is LedgerRow => r != null)
    .sort((a, b) => b.spend - a.spend);
  return {
    active,
    added: active.filter((r) => inRange(r.firstOrderAt, range)),
    returning: active.filter((r) => !inRange(r.firstOrderAt, range)),
  };
};
