// Customer numbers: who is new, who comes back, who spends the most and who
// has gone quiet. Built from every order on file for a customer, so "new"
// means their first order ever, not their first order in the loaded period.
import type { Identifier } from "ra-core";

import { type DateRange, inRange } from "../operations/shopTime";
import type { Order } from "../types";

export type LedgerOrder = Pick<
  Order,
  | "contact_id"
  | "total"
  | "refunded_amount"
  | "ordered_at"
  | "is_deposit"
  | "cancelled_at"
>;

export interface LedgerRow {
  contactId: Identifier;
  firstOrderAt: string;
  lastOrderAt: string;
  orders: number;
  /** Money collected over their lifetime: order totals less refunds. */
  spend: number;
}

const num = (value: unknown): number => Number(value) || 0;
const collected = (o: LedgerOrder): number =>
  Math.max(0, num(o.total) - num(o.refunded_amount));

/** One row per customer from their sales orders (deposits and cancelled orders left out). */
export const customerLedger = (
  orders: LedgerOrder[],
): Map<Identifier, LedgerRow> => {
  const ledger = new Map<Identifier, LedgerRow>();
  for (const o of orders) {
    if (o.cancelled_at || o.is_deposit || o.contact_id == null) continue;
    const row = ledger.get(o.contact_id) ?? {
      contactId: o.contact_id,
      firstOrderAt: o.ordered_at,
      lastOrderAt: o.ordered_at,
      orders: 0,
      spend: 0,
    };
    if (o.ordered_at < row.firstOrderAt) row.firstOrderAt = o.ordered_at;
    if (o.ordered_at > row.lastOrderAt) row.lastOrderAt = o.ordered_at;
    row.orders += 1;
    row.spend += collected(o);
    ledger.set(o.contact_id, row);
  }
  return ledger;
};

export interface CustomerStats {
  /** Customers who ordered in the period. */
  active: number;
  newCustomers: number;
  returning: number;
  /** Returning customers as a whole percent of active ones. */
  repeatRate: number | null;
  newCollected: number;
  returningCollected: number;
  /** Orders in the period with no customer attached (in-shop sales), as a whole percent. */
  unidentifiedShare: number | null;
  averageLifetimeSpend: number | null;
  averageOrdersPerCustomer: number | null;
}

export const customerStats = (
  orders: LedgerOrder[],
  range: DateRange,
): CustomerStats => {
  const ledger = customerLedger(orders);
  const inPeriod = orders.filter(
    (o) => !o.cancelled_at && !o.is_deposit && inRange(o.ordered_at, range),
  );
  const isNew = (id: Identifier) => {
    const first = ledger.get(id)?.firstOrderAt;
    return first != null && inRange(first, range);
  };
  const identified = inPeriod.filter((o) => o.contact_id != null);
  const active = new Set(identified.map((o) => o.contact_id as Identifier));
  const newIds = [...active].filter(isNew);
  const rows = [...ledger.values()];
  return {
    active: active.size,
    newCustomers: newIds.length,
    returning: active.size - newIds.length,
    repeatRate: active.size
      ? Math.round(((active.size - newIds.length) / active.size) * 100)
      : null,
    newCollected: identified
      .filter((o) => isNew(o.contact_id as Identifier))
      .reduce((s, o) => s + collected(o), 0),
    returningCollected: identified
      .filter((o) => !isNew(o.contact_id as Identifier))
      .reduce((s, o) => s + collected(o), 0),
    unidentifiedShare: inPeriod.length
      ? Math.round(
          ((inPeriod.length - identified.length) / inPeriod.length) * 100,
        )
      : null,
    averageLifetimeSpend: rows.length
      ? rows.reduce((s, r) => s + r.spend, 0) / rows.length
      : null,
    averageOrdersPerCustomer: rows.length
      ? rows.reduce((s, r) => s + r.orders, 0) / rows.length
      : null,
  };
};

export const topSpenders = (
  ledger: Map<Identifier, LedgerRow>,
  limit = 10,
): LedgerRow[] =>
  [...ledger.values()]
    .sort(
      (a, b) => b.spend - a.spend || a.lastOrderAt.localeCompare(b.lastOrderAt),
    )
    .slice(0, limit);

const DAY_MS = 86_400_000;

export const SLIPPING_DAYS = 180;
export const LAPSED_DAYS = 365;

export interface QuietCustomers {
  /** Bought more than once, and not in the last 6 months: worth a call. */
  slipping: LedgerRow[];
  /** Bought more than once, and not in the last 12 months. */
  lapsed: LedgerRow[];
}

/** Repeat customers who have gone quiet, the biggest spenders first. */
export const quietCustomers = (
  ledger: Map<Identifier, LedgerRow>,
  now: Date = new Date(),
): QuietCustomers => {
  const repeat = [...ledger.values()].filter((r) => r.orders >= 2);
  const quietFor = (r: LedgerRow) =>
    (now.getTime() - new Date(r.lastOrderAt).getTime()) / DAY_MS;
  const bySpend = (a: LedgerRow, b: LedgerRow) => b.spend - a.spend;
  return {
    slipping: repeat
      .filter((r) => quietFor(r) >= SLIPPING_DAYS && quietFor(r) < LAPSED_DAYS)
      .sort(bySpend),
    lapsed: repeat.filter((r) => quietFor(r) >= LAPSED_DAYS).sort(bySpend),
  };
};
