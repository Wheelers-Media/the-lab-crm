// What kind of work an order line is: a detail, tint, parts, a tune, lighting
// or a membership. Shopify's categories are per order, so a tint and a detail
// on one invoice would both read as both; the line names settle it per line.
// Shared by the customer suggestions and the dashboard's revenue mix so they
// never disagree about what counts as a detail.
import type { Order, OrderLineItem } from "../types";

export type ServiceKind =
  | "detail"
  | "tint"
  | "parts"
  | "tune"
  | "lighting"
  | "membership";

const MEMBERSHIP_LINE = /membership|monthly signature|syndicate/i;
const DETAIL_LINE = /detail|signature|de-luxx|headlight|ozone|odour|odor/i;
const TINT_LINE = /tint/i;
const PARTS_LINE =
  /exhaust|duramax|cummins|powerstroke|delete|intake|turbo|polar|dieselr/i;
const TUNE_LINE = /tun(e|ing)|ez ?lynk|hp tuners/i;
const LIGHTING_LINE = /light|\bled\b|lamp/i;

/** The kinds of work one line is, from its name. Usually one, sometimes none. */
export const lineKinds = (name: string): ServiceKind[] => {
  if (MEMBERSHIP_LINE.test(name)) return ["membership"];
  const kinds: ServiceKind[] = [];
  if (TINT_LINE.test(name)) kinds.push("tint");
  else if (DETAIL_LINE.test(name)) kinds.push("detail");
  if (TUNE_LINE.test(name)) kinds.push("tune");
  else if (PARTS_LINE.test(name)) kinds.push("parts");
  if (LIGHTING_LINE.test(name) && !/headlight/i.test(name)) {
    kinds.push("lighting");
  }
  return kinds;
};

const categoryKinds = (categories: string[] | null | undefined) => {
  const kinds = new Set<ServiceKind>();
  for (const category of categories ?? []) {
    const c = category.toLowerCase();
    if (c.includes("detail")) kinds.add("detail");
    if (c.includes("tint")) kinds.add("tint");
    if (c.includes("diesel") || c.includes("parts")) kinds.add("parts");
    if (c.includes("tun")) kinds.add("tune");
    if (c.includes("light")) kinds.add("lighting");
    if (c.includes("membership")) kinds.add("membership");
  }
  return kinds;
};

/** Every kind of work in an order, from its categories and its line names. */
export const orderKinds = (
  order: Pick<Order, "categories" | "line_items">,
): Set<ServiceKind> => {
  const kinds = categoryKinds(order.categories);
  for (const line of order.line_items ?? []) {
    for (const kind of lineKinds(line.name ?? "")) kinds.add(kind);
  }
  return kinds;
};

/**
 * The single kind one line is filed under for revenue. When the name says
 * nothing, an order with one Shopify category lends it that category.
 */
export const lineRevenueKind = (
  line: Pick<OrderLineItem, "name">,
  order: Pick<Order, "categories">,
): ServiceKind | null => {
  const [first] = lineKinds(line.name ?? "");
  if (first) return first;
  const fromOrder = [...categoryKinds(order.categories)];
  return fromOrder.length === 1 ? fromOrder[0] : null;
};
