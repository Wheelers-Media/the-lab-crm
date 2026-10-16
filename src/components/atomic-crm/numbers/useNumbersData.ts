import { useGetMany } from "ra-core";
import { useMemo } from "react";

import type {
  Appointment,
  Contact,
  Deal,
  Order,
  Package,
  ShopifyCheckout,
} from "../types";
import { addDays, shopDayKey, startOfShopDay } from "../operations/shopTime";
import { type LedgerOrder } from "./customerModel";
import { type StageChange } from "./funnelModel";
import { type NumbersPeriod, numbersRanges } from "./periods";
import type { TrafficRow } from "./trafficModel";
import { useAllRecords } from "./useAllRecords";

const LEDGER_COLUMNS = [
  "id",
  "contact_id",
  "total",
  "refunded_amount",
  "ordered_at",
  "is_deposit",
  "cancelled_at",
];

/** Everything the Numbers screen reads, fetched once per period. */
export const useNumbersData = (period: NumbersPeriod) => {
  const now = useMemo(() => new Date(), []);
  const ranges = useMemo(() => numbersRanges(period, now), [period, now]);
  const since = ranges.previous.start.toISOString();
  const ahead = startOfShopDay(addDays(shopDayKey(now), 15)).toISOString();

  const orders = useAllRecords<Order>("orders", {
    filter: { "ordered_at@gte": since },
    sort: { field: "ordered_at", order: "ASC" },
  });
  // Every order ever, but only the few columns customer history needs
  const ledgerOrders = useAllRecords<LedgerOrder>("orders", {
    columns: LEDGER_COLUMNS,
    sort: { field: "ordered_at", order: "ASC" },
  });
  const catalog = useAllRecords<Package>("packages", {
    filter: { "status@neq": "deleted" },
  });
  const deals = useAllRecords<Deal>("deals", {
    filter: { "created_at@gte": ranges.current.start.toISOString() },
    sort: { field: "created_at", order: "ASC" },
  });
  // The log may be missing (older demo data): the funnel then goes by current stage
  const changes = useAllRecords<StageChange>("deal_stage_history", {
    filter: { "changed_at@gte": ranges.current.start.toISOString() },
    sort: { field: "changed_at", order: "ASC" },
  });
  const appointments = useAllRecords<Appointment>("appointments", {
    filter: { "start_at@gte": since, "start_at@lt": ahead },
    sort: { field: "start_at", order: "ASC" },
  });
  const checkouts = useAllRecords<ShopifyCheckout>("shopify_checkouts", {
    filter: { "checkout_updated_at@gte": since },
    sort: { field: "checkout_updated_at", order: "ASC" },
  });

  // Online store visits copied from Shopify's reports. Kept apart from the
  // orders: the table may not exist yet, and that must not blank the screen
  const traffic = useAllRecords<TrafficRow>("shop_traffic_daily", {
    filter: { "day@gte": shopDayKey(ranges.previous.start) },
    sort: { field: "day", order: "ASC" },
  });

  return {
    now,
    ranges,
    orders: orders.data ?? [],
    ledgerOrders: ledgerOrders.data ?? [],
    catalog: catalog.data ?? [],
    deals: deals.data ?? [],
    changes: changes.data ?? [],
    appointments: appointments.data ?? [],
    checkouts: checkouts.data ?? [],
    traffic: {
      rows: traffic.data ?? [],
      isPending: traffic.isPending,
      error: traffic.error,
      refetch: traffic.refetch,
    },
    isPending: orders.isPending || ledgerOrders.isPending,
    error: orders.error ?? ledgerOrders.error,
  };
};

/** Names for the customers listed in a table. */
export const useCustomerNames = (ids: Array<number | string>) => {
  const unique = useMemo(() => [...new Set(ids)], [ids]);
  const { data = [] } = useGetMany<Contact>(
    "contacts",
    { ids: unique },
    { enabled: unique.length > 0 },
  );
  return useMemo(() => new Map(data.map((c) => [c.id, c])), [data]);
};
