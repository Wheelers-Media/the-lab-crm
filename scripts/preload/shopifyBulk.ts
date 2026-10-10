// Turns Shopify bulk-operation exports (JSONL) into the rows the CRM preload
// loads. Orders go through the same parser as the live webhook
// (parseShopifyOrder), so preloaded and live orders look the same.
//
// Bulk JSONL: one object per line; items of a nested connection (line
// items) are separate lines that point at their parent with "__parentId".
import {
  capName,
  clip,
  formatPhone,
  normalizeEmail,
  orderNoteText,
  parseShopifyCheckout,
  parseShopifyOrder,
  type ShopifyCheckout,
  type ShopifyOrder,
} from "../../supabase/functions/_shared/lab/parse.ts";
import {
  packageFromProduct,
  type PackageRow,
} from "../../supabase/functions/_shared/lab/packages.ts";

type Json = Record<string, unknown>;

const rec = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const money = (bag: unknown): string =>
  String(rec(rec(bag).shopMoney).amount ?? "0");

/** Numeric id from a GraphQL id: "gid://shopify/Order/123" -> "123". */
export const legacyId = (gid: unknown): string =>
  String(gid ?? "").replace(/^gid:\/\/shopify\/\w+\//, "");

export const parseJsonl = (text: string): Json[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Json);

/** Splits parents from their connection children (keyed by parent id). */
const groupChildren = (rows: Json[]) => {
  const parents: Json[] = [];
  const children = new Map<string, Json[]>();
  for (const row of rows) {
    const parentId = row.__parentId;
    if (typeof parentId === "string") {
      const list = children.get(parentId) ?? [];
      list.push(row);
      children.set(parentId, list);
    } else {
      parents.push(row);
    }
  }
  return { parents, children };
};

export type PreloadCustomer = {
  shopifyId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  company: string;
  city: string;
  province: string;
  note: string;
  emailMarketing: boolean;
  smsMarketing: boolean;
  createdAt: string;
  orderCount: number;
};

export const customerFromBulk = (node: Json): PreloadCustomer => {
  const email = rec(node.defaultEmailAddress);
  const phone = rec(node.defaultPhoneNumber);
  const address = rec(node.defaultAddress);
  return {
    shopifyId: legacyId(node.id),
    email: normalizeEmail(email.emailAddress),
    phone: formatPhone(phone.phoneNumber ?? address.phone),
    firstName: capName(node.firstName),
    lastName: capName(node.lastName),
    company: clip(address.company, 120),
    city: clip(address.city, 80),
    province: clip(address.provinceCode, 10),
    note: clip(node.note, 2000),
    emailMarketing: email.marketingState === "SUBSCRIBED",
    smsMarketing: phone.marketingState === "SUBSCRIBED",
    createdAt: clip(node.createdAt, 40),
    orderCount: Number(node.numberOfOrders) || 0,
  };
};

/** Same statuses the history import accepts: money actually changed hands. */
export const PRELOAD_STATUSES = new Set([
  "paid",
  "partially_paid",
  "partially_refunded",
  "refunded",
]);

export type PreloadOrder = ShopifyOrder & { noteText: string };

/** Rebuilds the REST webhook shape from a bulk order, then parses it. */
export const orderFromBulk = (
  node: Json,
  lineItems: Json[],
  customer?: PreloadCustomer,
): PreloadOrder | null => {
  const billing = rec(node.billingAddress);
  const shipping = rec(node.shippingAddress);
  const refunded = money(node.totalRefundedSet);
  const parsed = parseShopifyOrder({
    id: legacyId(node.id),
    name: node.name,
    email: node.email || customer?.email || undefined,
    phone: node.phone || customer?.phone || undefined,
    customer: customer
      ? {
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          first_name: customer.firstName || undefined,
          last_name: customer.lastName || undefined,
        }
      : undefined,
    billing_address: {
      first_name: billing.firstName,
      last_name: billing.lastName,
      company: billing.company,
      phone: billing.phone,
    },
    shipping_address: { phone: shipping.phone },
    source_name: node.sourceName,
    financial_status: String(node.displayFinancialStatus ?? "").toLowerCase(),
    currency: node.currencyCode,
    subtotal_price: money(node.subtotalPriceSet),
    total_price: money(node.totalPriceSet),
    refunds: Number(refunded) ? [{ transactions: [{ amount: refunded }] }] : [],
    line_items: lineItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: money(item.originalUnitPriceSet),
    })),
    created_at: node.createdAt,
    cancelled_at: node.cancelledAt,
    note: node.note,
  });
  if (!parsed.ok) return null;
  return { ...parsed.value, noteText: orderNoteText(parsed.value) };
};

/** The checkout token is the path segment before "/recover" in the link. */
export const checkoutToken = (url: string, id: unknown): string =>
  url.match(/\/([A-Za-z0-9]{16,})\/recover/)?.[1] ?? `gid-${legacyId(id)}`;

export const checkoutFromBulk = (
  node: Json,
  lineItems: Json[],
): ShopifyCheckout | null => {
  const customer = rec(node.customer);
  const billing = rec(node.billingAddress);
  const url = clip(node.abandonedCheckoutUrl, 500);
  const parsed = parseShopifyCheckout({
    token: checkoutToken(url, node.id),
    email: rec(customer.defaultEmailAddress).emailAddress,
    phone:
      rec(customer.defaultPhoneNumber).phoneNumber ?? billing.phone ?? null,
    customer: {
      first_name: customer.firstName ?? billing.firstName,
      last_name: customer.lastName ?? billing.lastName,
    },
    total_price: money(node.totalPriceSet),
    line_items: lineItems.map((item) => ({
      title: item.title,
      quantity: item.quantity,
    })),
    abandoned_checkout_url: url,
    completed_at: node.completedAt,
    updated_at: node.updatedAt,
  });
  return parsed.ok ? parsed.value : null;
};

/** A bulk product with its variants, as a catalog row (or null). */
export const packageFromBulk = (
  node: Json,
  variants: Json[],
): PackageRow | null =>
  packageFromProduct({
    id: legacyId(node.id),
    title: node.title,
    vendor: node.vendor,
    status: node.status,
    updated_at: node.updatedAt,
    handle: node.handle,
    product_type: node.productType,
    image: { src: rec(rec(rec(node.featuredMedia).preview).image).url },
    variants: variants.map((v) => ({
      id: legacyId(v.id),
      title: v.title,
      price: v.price,
      sku: v.sku,
      inventory_management: node.tracksInventory ? "shopify" : null,
      inventory_quantity: v.inventoryQuantity,
    })),
  });

export type PreloadPayload = {
  packages: PackageRow[];
  customers: PreloadCustomer[];
  orders: PreloadOrder[];
  checkouts: ShopifyCheckout[];
  skipped: Record<string, number>;
};

export const buildPayload = ({
  orders: orderRows,
  customers: customerRows,
  checkouts: checkoutRows,
  products: productRows = [],
}: {
  orders: Json[];
  customers: Json[];
  checkouts: Json[];
  products?: Json[];
}): PreloadPayload => {
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  const customers = customerRows
    .filter((row) => typeof row.__parentId !== "string")
    .map(customerFromBulk);
  const byId = new Map(customers.map((c) => [c.shopifyId, c]));

  const groupedOrders = groupChildren(orderRows);
  const orders: PreloadOrder[] = [];
  for (const node of groupedOrders.parents) {
    if (node.test === true) {
      skip("test order");
      continue;
    }
    const order = orderFromBulk(
      node,
      groupedOrders.children.get(String(node.id)) ?? [],
      byId.get(legacyId(rec(node.customer).id)),
    );
    if (!order) {
      skip("unreadable order");
      continue;
    }
    if (!PRELOAD_STATUSES.has(order.financialStatus)) {
      skip(`status ${order.financialStatus || "unknown"}`);
      continue;
    }
    orders.push(order);
  }

  const groupedCheckouts = groupChildren(checkoutRows);
  const checkouts: ShopifyCheckout[] = [];
  for (const node of groupedCheckouts.parents) {
    const checkout = checkoutFromBulk(
      node,
      groupedCheckouts.children.get(String(node.id)) ?? [],
    );
    if (checkout && !checkout.completedAt) checkouts.push(checkout);
    else skip("completed or unreadable cart");
  }

  const groupedProducts = groupChildren(productRows);
  const packages: PackageRow[] = [];
  for (const node of groupedProducts.parents) {
    const row = packageFromBulk(
      node,
      groupedProducts.children.get(String(node.id)) ?? [],
    );
    if (row) packages.push(row);
    else skip("unreadable product");
  }

  return { packages, customers, orders, checkouts, skipped };
};
