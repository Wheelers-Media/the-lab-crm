import { useMemo } from "react";

import { useAllRecords } from "../numbers/useAllRecords";
import { useLedgerOrders } from "../numbers/useNumbersData";
import type { Appointment, Order } from "../types";
import type { Period } from "./shopTime";
import { trendsStart } from "./trendsModel";

/**
 * Orders and drop-offs far enough back for the home screen's trends: eight
 * periods for the sparklines and twelve weeks for the revenue mix.
 */
export const useTrendsData = (period: Period, now: Date) => {
  const since = useMemo(
    () => trendsStart(period, now).toISOString(),
    [period, now],
  );
  const orders = useAllRecords<Order>("orders", {
    filter: { "ordered_at@gte": since },
    sort: { field: "ordered_at", order: "ASC" },
  });
  const ledgerOrders = useLedgerOrders();
  const appointments = useAllRecords<Appointment>("appointments", {
    filter: { "start_at@gte": since, "start_at@lt": now.toISOString() },
    sort: { field: "start_at", order: "ASC" },
  });
  return {
    orders: orders.data ?? [],
    ledgerOrders: ledgerOrders.data ?? [],
    appointments: appointments.data ?? [],
    isPending: orders.isPending || ledgerOrders.isPending,
    error: orders.error ?? ledgerOrders.error ?? appointments.error,
    retry: () => {
      for (const q of [orders, ledgerOrders, appointments])
        if (q.error) q.refetch();
    },
  };
};
