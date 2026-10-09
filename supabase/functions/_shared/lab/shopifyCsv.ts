// Converts Shopify's admin order export (Orders > Export > CSV) into the same
// payload shape Shopify sends to the orders webhook, so a history import runs
// through parseShopifyOrder exactly like a live order. Pure: no I/O.
//
// The export has one row per line item. Order-level columns (Email, Total,
// Billing Name...) are only filled on the first row of each order; later rows
// repeat just "Name" and the "Lineitem ..." columns.

export type CsvRow = Record<string, string | undefined>;

export type ShopifyOrderPayload = {
  id: string;
  name: string;
  email: string;
  phone: string;
  financial_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal_price: string;
  total_price: string;
  source_name: string;
  created_at: string;
  processed_at: string;
  cancelled_at: string | null;
  note: string;
  customer: { first_name: string; last_name: string; email: string };
  billing_address: {
    first_name: string;
    last_name: string;
    phone: string;
    company: string;
  };
  shipping_address: { phone: string };
  line_items: Array<{
    name: string;
    quantity: number;
    price: string;
    sku: string;
  }>;
  refunds: Array<{ transactions: Array<{ amount: string }> }>;
};

/** Payment statuses worth importing: money changed hands at some point. */
export const IMPORTABLE_STATUSES = new Set([
  "paid",
  "partially_paid",
  "partially_refunded",
  "refunded",
]);

const col = (row: CsvRow, name: string): string => (row[name] ?? "").trim();

/** "2025-05-01 10:22:33 -0600" -> "2025-05-01T10:22:33-06:00"; "" stays "". */
export const toIsoDate = (value: string): string => {
  const v = value.trim();
  const m = v.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*([+-])(\d{2}):?(\d{2})$/,
  );
  if (!m) return v;
  const time = m[2].length === 5 ? `${m[2]}:00` : m[2];
  return `${m[1]}T${time}${m[3]}${m[4]}:${m[5]}`;
};

const splitName = (full: string): { first: string; last: string } => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
};

export type CsvConversion = {
  orders: ShopifyOrderPayload[];
  skipped: Array<{ name: string; reason: string }>;
};

export const ordersFromCsv = (rows: CsvRow[]): CsvConversion => {
  const byName = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const name = col(row, "Name");
    if (!name) continue;
    const group = byName.get(name);
    if (group) group.push(row);
    else byName.set(name, [row]);
  }

  const orders: ShopifyOrderPayload[] = [];
  const skipped: CsvConversion["skipped"] = [];

  for (const [name, group] of byName) {
    // The order-level columns live on whichever row has them (normally the first)
    const head = group.find((r) => col(r, "Financial Status")) ?? group[0];
    const id = col(head, "Id");
    const status = col(head, "Financial Status").toLowerCase();
    if (!id) {
      skipped.push({ name, reason: "no order Id column" });
      continue;
    }
    if (!IMPORTABLE_STATUSES.has(status)) {
      skipped.push({ name, reason: `payment status "${status || "blank"}"` });
      continue;
    }

    const billingName = splitName(
      col(head, "Billing Name") || col(head, "Shipping Name"),
    );
    const createdAt = toIsoDate(col(head, "Created at"));
    const refunded = col(head, "Refunded Amount");

    orders.push({
      id,
      name,
      email: col(head, "Email"),
      phone: col(head, "Phone"),
      financial_status: status,
      fulfillment_status: col(head, "Fulfillment Status").toLowerCase(),
      currency: col(head, "Currency") || "CAD",
      subtotal_price: col(head, "Subtotal"),
      total_price: col(head, "Total"),
      source_name: col(head, "Source"),
      created_at: createdAt,
      processed_at: toIsoDate(col(head, "Paid at")) || createdAt,
      cancelled_at: toIsoDate(col(head, "Cancelled at")) || null,
      note: col(head, "Notes"),
      customer: {
        first_name: billingName.first,
        last_name: billingName.last,
        email: col(head, "Email"),
      },
      billing_address: {
        first_name: billingName.first,
        last_name: billingName.last,
        phone: col(head, "Billing Phone"),
        company: col(head, "Billing Company"),
      },
      shipping_address: { phone: col(head, "Shipping Phone") },
      line_items: group
        .filter((r) => col(r, "Lineitem name"))
        .map((r) => ({
          name: col(r, "Lineitem name"),
          quantity: Number(col(r, "Lineitem quantity")) || 1,
          price: col(r, "Lineitem price"),
          sku: col(r, "Lineitem sku"),
        })),
      refunds:
        Number(refunded) > 0 ? [{ transactions: [{ amount: refunded }] }] : [],
    });
  }

  return { orders, skipped };
};
