// Imports one Shopify order from an "Import from JSON" file into the orders
// table. Re-importing the same file is safe: orders are matched on their
// Shopify order id and updated rather than duplicated.
import type { DataProvider, Identifier } from "ra-core";

export type OrderImport = {
  shopify_order_id: string;
  order_number: string;
  contact_id?: number;
  email?: string;
  phone?: string;
  source?: string;
  financial_status?: string;
  currency?: string;
  subtotal?: number;
  total: number;
  refunded_amount?: number;
  line_items?: Array<{ name: string; quantity: number; price: number }>;
  categories?: string[];
  is_deposit?: boolean;
  ordered_at: string;
  cancelled_at?: string | null;
};

export const isOrder = (data: unknown): data is OrderImport => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.shopify_order_id === "string" &&
    typeof d.order_number === "string" &&
    typeof d.total === "number" &&
    typeof d.ordered_at === "string" &&
    !Number.isNaN(new Date(d.ordered_at).getTime())
  );
};

export type ContactIndex = {
  byEmail: Map<string, Identifier>;
  byPhone: Map<string, Identifier>;
};

/** Loads every contact's emails and phones once, for matching orders to customers. */
export const loadContactIndex = async (
  dataProvider: DataProvider,
): Promise<ContactIndex> => {
  const index: ContactIndex = { byEmail: new Map(), byPhone: new Map() };
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data } = await dataProvider.getList("contacts", {
      filter: {},
      pagination: { page, perPage },
      sort: { field: "id", order: "ASC" },
    });
    for (const c of data) {
      for (const e of c.email_jsonb ?? []) {
        const email = String(e?.email ?? "").toLowerCase();
        if (email && !index.byEmail.has(email)) index.byEmail.set(email, c.id);
      }
      for (const p of c.phone_jsonb ?? []) {
        const number = String(p?.number ?? "");
        if (number && !index.byPhone.has(number))
          index.byPhone.set(number, c.id);
      }
    }
    if (data.length < perPage) break;
  }
  return index;
};

/**
 * The customer for this order: the contact created earlier in the same file,
 * otherwise an existing contact with the same email, then the same phone.
 */
const resolveContact = (
  order: OrderImport,
  importedContacts: Record<number, Identifier>,
  index: ContactIndex,
): Identifier | null => {
  if (order.contact_id != null && importedContacts[order.contact_id] != null) {
    return importedContacts[order.contact_id];
  }
  return (
    (order.email && index.byEmail.get(order.email.toLowerCase())) ||
    (order.phone && index.byPhone.get(order.phone)) ||
    null
  );
};

export const importOrder = async (
  dataProvider: DataProvider,
  order: OrderImport,
  importedContacts: Record<number, Identifier>,
  index: ContactIndex,
): Promise<void> => {
  const contactId = resolveContact(order, importedContacts, index);
  const record = {
    shopify_order_id: order.shopify_order_id,
    order_number: order.order_number,
    contact_id: contactId,
    source: order.source ?? null,
    financial_status: order.financial_status ?? null,
    currency: order.currency ?? "CAD",
    subtotal: order.subtotal ?? null,
    total: order.total,
    refunded_amount: order.refunded_amount ?? 0,
    line_items: order.line_items ?? [],
    categories: order.categories ?? [],
    is_deposit: order.is_deposit ?? false,
    ordered_at: order.ordered_at,
    cancelled_at: order.cancelled_at ?? null,
  };
  const { data: existing } = await dataProvider.getList("orders", {
    filter: { shopify_order_id: order.shopify_order_id },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  if (existing[0]) {
    await dataProvider.update("orders", {
      id: existing[0].id,
      data: record,
      previousData: existing[0],
    });
  } else {
    await dataProvider.create("orders", { data: record });
  }
};
