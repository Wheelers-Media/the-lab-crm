// Package helpers: job lines and totals, catalog prices, and the services a
// customer has had, worked out from their Shopify orders.
import type { DealPackageLine, Order, Package } from "../types";

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: n % 1 ? 2 : 0,
  });

/** "$250", "$2,549 to $3,149", or "Eric quotes" when Shopify has no price. */
export const packagePriceLabel = (
  pkg: Pick<Package, "price" | "price_max">,
): string => {
  if (pkg.price == null || pkg.price <= 0) return "Eric quotes";
  if (pkg.price_max != null && pkg.price_max > pkg.price)
    return `${money(pkg.price)} to ${money(pkg.price_max)}`;
  return money(pkg.price);
};

export const lineFromPackage = (pkg: Package): DealPackageLine => ({
  package_id: pkg.id,
  title: pkg.title,
  price: pkg.price ?? 0,
  quantity: 1,
});

export const linesTotal = (lines: DealPackageLine[] | null | undefined) =>
  Math.round(
    (lines ?? []).reduce(
      (sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 1),
      0,
    ) * 100,
  ) / 100;

// Order lines that are not a service the customer had
const NOT_A_SERVICE =
  /^(shop supplies.*|mechanical shop supplies|shipping.*|duty fees.*|tip|custom sale|test amount)$|secure booking deposit/i;

const shortName = (name: string) =>
  name
    .replace(/^Universal Fit\s*[-–]\s*(THE LAB|Suntek)\s*[-–]\s*/i, "")
    .trim();

export type CustomerService = {
  name: string;
  times: number;
  spent: number;
  lastDate: string;
  isMembership: boolean;
};

/** Each service a customer bought, how often, and when last. Newest first. */
export const servicesFromOrders = (
  orders: Array<Pick<Order, "line_items" | "ordered_at" | "cancelled_at">>,
): CustomerService[] => {
  const byName = new Map<string, CustomerService>();
  for (const order of orders) {
    if (order.cancelled_at) continue;
    for (const line of order.line_items ?? []) {
      const name = shortName(line.name ?? "");
      if (!name || NOT_A_SERVICE.test(name)) continue;
      const key = name.toLowerCase();
      const qty = Number(line.quantity) || 1;
      const current = byName.get(key) ?? {
        name,
        times: 0,
        spent: 0,
        lastDate: order.ordered_at,
        isMembership: /membership|monthly signature|syndicate/i.test(name),
      };
      current.times += qty;
      current.spent += (Number(line.price) || 0) * qty;
      if (order.ordered_at > current.lastDate)
        current.lastDate = order.ordered_at;
      byName.set(key, current);
    }
  }
  return [...byName.values()].sort((a, b) =>
    b.lastDate.localeCompare(a.lastDate),
  );
};

/** Finds the catalog entry for an order line name (short or Shopify title). */
export const catalogIndex = (
  catalog: Array<Pick<Package, "title" | "shopify_title" | "status">>,
) => {
  const byName = new Map<string, Package>();
  // Live products win over deleted ones with the same name
  const ordered = [...catalog].sort(
    (a, b) => Number(a.status === "deleted") - Number(b.status === "deleted"),
  );
  for (const pkg of ordered as Package[]) {
    for (const name of [pkg.title, shortName(pkg.shopify_title ?? "")]) {
      const key = name.trim().toLowerCase();
      if (key && !byName.has(key)) byName.set(key, pkg);
    }
  }
  return (name: string): Package | undefined =>
    byName.get(shortName(name).trim().toLowerCase());
};

const MEMBERSHIP_NAMES: Record<string, string> = {
  "monthly-signature": "The Monthly Signature",
  "lab-syndicate": "The LAB Syndicate",
};
// A monthly membership counts as current for a month plus a few days' grace
const MEMBERSHIP_DAYS = 35;

export type MembershipStatus = { active: boolean; label: string };

/** Membership from the profile, or from the latest membership payment. */
export const membershipStatus = (
  contact: { membership?: string | null; membership_since?: string | null },
  services: CustomerService[],
  now: Date = new Date(),
): MembershipStatus | null => {
  if (contact.membership) {
    const name = MEMBERSHIP_NAMES[contact.membership] ?? contact.membership;
    return {
      active: true,
      label: contact.membership_since
        ? `${name} since ${new Date(`${contact.membership_since}T12:00:00`).toLocaleDateString("en-CA", { month: "short", year: "numeric" })}`
        : `${name} member`,
    };
  }
  const paid = services.find((s) => s.isMembership);
  if (!paid) return null;
  const days = (now.getTime() - new Date(paid.lastDate).getTime()) / 86_400_000;
  const when = new Date(paid.lastDate).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
  return days <= MEMBERSHIP_DAYS
    ? { active: true, label: `Membership paid ${when}` }
    : { active: false, label: `Membership lapsed, last paid ${when}` };
};
