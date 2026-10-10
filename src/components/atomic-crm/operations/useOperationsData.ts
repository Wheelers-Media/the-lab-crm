import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetList, useGetMany } from "ra-core";
import { useEffect, useMemo } from "react";

import type { CrmDataProvider } from "../providers/types";
import type {
  Appointment,
  Contact,
  Deal,
  Order,
  ShopifyCheckout,
  Task,
} from "../types";
import {
  addDays,
  type Period,
  periodRange,
  previousPeriodRange,
  shopDayKey,
  startOfShopDay,
} from "./shopTime";

const BIG = { page: 1, perPage: 2000 };
const DAY_MS = 86_400_000;

/**
 * Runs the follow-up rules when the dashboard opens (they also run every 15
 * minutes on the server), then refreshes the task lists so new tasks show up.
 */
export const useRunAutomations = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["run_automations"],
    queryFn: () => dataProvider.runAutomations(),
    staleTime: 10 * 60_000,
    retry: false,
  });
  useEffect(() => {
    if (data && data > 0) {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  }, [data, queryClient]);
};

/** Appointments overlapping [startKey, endKey) in shop days, with their contacts. */
export const useAppointments = (startKey: string, endKey: string) => {
  const { data: appointments = [], isPending } = useGetList<Appointment>(
    "appointments",
    {
      pagination: BIG,
      sort: { field: "start_at", order: "ASC" },
      filter: {
        "start_at@gte": startOfShopDay(startKey).toISOString(),
        "start_at@lt": startOfShopDay(endKey).toISOString(),
      },
    },
  );
  const contactIds = useMemo(
    () => [
      ...new Set(
        appointments.map((a) => a.contact_id).filter((id) => id != null),
      ),
    ],
    [appointments],
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const contactsById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );
  return { appointments, contactsById, isPending };
};

export const useOperationsData = (period: Period) => {
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => periodRange(period, now), [period, now]);
  const previous = useMemo(
    () => previousPeriodRange(period, now),
    [period, now],
  );
  const week = useMemo(() => periodRange("week", now), [now]);
  const weekStartKey = shopDayKey(week.start);

  const { data: orders = [], isPending: ordersPending } = useGetList<Order>(
    "orders",
    {
      pagination: BIG,
      sort: { field: "ordered_at", order: "DESC" },
      filter: { "ordered_at@gte": previous.start.toISOString() },
    },
  );

  const { data: deals = [], isPending: dealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: BIG,
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    },
  );

  const { data: checkouts = [] } = useGetList<ShopifyCheckout>(
    "shopify_checkouts",
    {
      pagination: BIG,
      sort: { field: "checkout_updated_at", order: "DESC" },
      filter: {
        // Back to the previous period's start (and at least 14 days, for
        // the abandoned-cart follow-up)
        "checkout_updated_at@gte": new Date(
          Math.min(previous.start.getTime(), now.getTime() - 14 * DAY_MS),
        ).toISOString(),
      },
    },
  );

  // Team-wide open tasks: automatic tasks belong to the shop, not one person
  const { data: tasks = [] } = useGetList<Task>("tasks", {
    pagination: BIG,
    sort: { field: "due_date", order: "ASC" },
    filter: { "done_date@is": null },
  });

  // This week plus the next 60 days, for the week strip and unpaid deposits
  const { appointments, contactsById } = useAppointments(
    weekStartKey,
    addDays(shopDayKey(now), 60),
  );

  return {
    now,
    range,
    previous,
    weekStartKey,
    orders,
    deals,
    checkouts,
    tasks,
    appointments,
    contactsById,
    isPending: ordersPending || dealsPending,
  };
};
