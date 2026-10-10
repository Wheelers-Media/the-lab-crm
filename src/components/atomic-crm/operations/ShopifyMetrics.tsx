import { ShoppingBag, Tags } from "lucide-react";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";

import type { Order, ShopifyCheckout } from "../types";
import { money } from "./format";
import {
  cartStats,
  ordersByCategory,
  percentChange,
  shopifyStats,
  topProducts,
} from "./metrics";
import { KpiTile, SectionTitle } from "./OperationsWidgets";
import type { DateRange } from "./shopTime";

/** Shopify numbers for the period: order tiles, best sellers and what kinds of work sold. */
export const ShopifyMetrics = ({
  orders,
  checkouts,
  range,
  previous,
  vs,
  now,
}: {
  orders: Order[];
  checkouts: ShopifyCheckout[];
  range: DateRange;
  previous: DateRange;
  vs: string;
  now: Date;
}) => {
  const stats = useMemo(() => shopifyStats(orders, range), [orders, range]);
  const before = useMemo(
    () => shopifyStats(orders, previous),
    [orders, previous],
  );
  const carts = useMemo(
    () => cartStats(checkouts, range, now),
    [checkouts, range, now],
  );
  const products = useMemo(() => topProducts(orders, range), [orders, range]);
  const categories = useMemo(
    () => ordersByCategory(orders, range),
    [orders, range],
  );
  const maxCategory = Math.max(1, ...categories.map((c) => c.orders));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          label="Orders"
          value={String(stats.orders)}
          trend={percentChange(stats.orders, before.orders)}
          detail={`${stats.customers} customers`}
        />
        <KpiTile
          label="Average order"
          value={stats.averageOrder == null ? "-" : money(stats.averageOrder)}
          trend={
            stats.averageOrder != null && before.averageOrder != null
              ? percentChange(stats.averageOrder, before.averageOrder)
              : null
          }
          detail={before.averageOrder != null ? vs : "Deposits not included"}
        />
        <KpiTile
          label="Deposits"
          value={String(stats.deposits)}
          detail={`${money(stats.depositAmount)} collected`}
        />
        <KpiTile
          label="Refunds"
          value={money(stats.refunded)}
          detail={`${stats.refundedOrders} ${stats.refundedOrders === 1 ? "order" : "orders"}`}
        />
        <KpiTile
          label="Checkout completion"
          value={
            carts.completionRate == null ? "-" : `${carts.completionRate}%`
          }
          detail={
            carts.abandoned
              ? `${carts.abandoned} abandoned, ${money(carts.abandonedValue)}`
              : `${carts.completed} of ${carts.started} checkouts`
          }
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 gap-0">
          <SectionTitle icon={ShoppingBag}>Best sellers</SectionTitle>
          {products.length ? (
            <div className="divide-y divide-border">
              {products.map((p) => (
                <div
                  key={p.name}
                  className="flex items-baseline gap-3 py-2 min-h-10"
                >
                  <span className="flex-1 text-sm truncate" title={p.name}>
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground lab-num">
                    × {p.quantity}
                  </span>
                  <span className="w-20 text-right text-sm lab-num">
                    {money(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No Shopify sales in this period yet.
            </p>
          )}
        </Card>
        <Card className="p-4 gap-0">
          <SectionTitle icon={Tags}>Orders by type</SectionTitle>
          {categories.length ? (
            <div className="flex flex-col">
              {categories.map((c) => (
                <div
                  key={c.category}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0 min-h-10"
                >
                  <span className="w-28 font-display uppercase tracking-wide text-sm">
                    {c.category}
                  </span>
                  <span className="flex-1 h-2 rounded-sm bg-muted overflow-hidden">
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${(c.orders / maxCategory) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 text-right lab-num">{c.orders}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Order types show here once orders come in.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};
