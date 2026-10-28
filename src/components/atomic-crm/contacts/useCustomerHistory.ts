import { type Identifier, useGetList } from "ra-core";

import type { Appointment, Deal, Order, Package } from "../types";

/**
 * Everything the profile needs to see a customer's history: their orders,
 * every appointment, and their jobs. The order query uses the same key as the
 * Purchases tab so the two share one request.
 */
export const useCustomerHistory = (contactId: Identifier) => {
  const orders = useGetList<Order>("orders", {
    filter: { contact_id: contactId },
    sort: { field: "ordered_at", order: "DESC" },
    pagination: { page: 1, perPage: 200 },
  });
  const appointments = useGetList<Appointment>("appointments", {
    filter: { contact_id: contactId },
    sort: { field: "start_at", order: "DESC" },
    pagination: { page: 1, perPage: 200 },
  });
  const deals = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${contactId}}`, "archived_at@is": null },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });
  return {
    orders: orders.data ?? [],
    appointments: appointments.data ?? [],
    deals: deals.data ?? [],
    isPending: orders.isPending || appointments.isPending,
    error: orders.error ?? appointments.error,
  };
};

/** The monthly membership's catalog price, to quote it in a suggestion. */
export const useMembershipPrice = (): number | null => {
  const { data = [] } = useGetList<Package>("packages", {
    filter: { category: "membership" },
    pagination: { page: 1, perPage: 5 },
    sort: { field: "price", order: "ASC" },
  });
  const monthly =
    data.find((p) => /monthly signature/i.test(p.title)) ?? data[0];
  return monthly?.price ?? null;
};
