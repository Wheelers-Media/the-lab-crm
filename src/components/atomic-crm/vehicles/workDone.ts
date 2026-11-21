// What THE LAB has already done for a customer, by kind of work, newest
// first. Shown on the profile's vehicle card so Eric sees at a glance what is
// already on the truck before he offers the next thing.
import { orderKinds, type ServiceKind } from "../operations/serviceKinds";
import type { Order } from "../types";

export const WORK_LABEL: Record<ServiceKind, string> = {
  detail: "Detail",
  tint: "Tint",
  tune: "Tune",
  parts: "Diesel parts",
  lighting: "Lighting",
  membership: "Membership",
};

export interface WorkDone {
  kind: ServiceKind;
  label: string;
  /** How many paid orders included this kind of work. */
  times: number;
  /** The latest of those orders (ISO). */
  last: string;
}

const isPaidSale = (o: Order): boolean => !o.cancelled_at && !o.is_deposit;

export const workDone = (orders: Order[]): WorkDone[] => {
  const byKind = new Map<ServiceKind, WorkDone>();
  for (const order of orders.filter(isPaidSale)) {
    for (const kind of orderKinds(order)) {
      const seen = byKind.get(kind);
      byKind.set(kind, {
        kind,
        label: WORK_LABEL[kind],
        times: (seen?.times ?? 0) + 1,
        last:
          seen && seen.last > order.ordered_at ? seen.last : order.ordered_at,
      });
    }
  }
  return [...byKind.values()].sort((a, b) => b.last.localeCompare(a.last));
};
