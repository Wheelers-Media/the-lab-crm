import { ArrowRight, ShoppingBag, Tags } from "lucide-react";
import { Link } from "react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";

import type { Order } from "../types";
import { listLink, money } from "./format";
import {
  ordersByCategory,
  percentChange,
  shopifyStats,
  topProducts,
} from "./metrics";
import { KpiTile, SectionTitle } from "./OperationsWidgets";
import type { DateRange } from "./shopTime";

/**
 * The money side of the period: what was billed, what a job is worth, what came
 * in as deposits, and which services and products earned it. Web-shop funnel
 * numbers live on Numbers with the traffic they belong to; the shop's home
 * screen stays on jobs and money.
 */
export const ShopifyMetrics = ({
  orders,
  range,
  previous,
  vs,
  thisPeriod,
}: {
  orders: Order[];
  range: DateRange;
  previous: DateRange;
  vs: string;
  /** "this month" — spelled out in the card hints. */
  thisPeriod: string;
}) => {
  const stats = useMemo(() => shopifyStats(orders, range), [orders, range]);
  const before = useMemo(
    () => shopifyStats(orders, previous),
    [orders, previous],
  );
  const products = useMemo(() => topProducts(orders, range), [orders, range]);
  const categories = useMemo(
    () => ordersByCategory(orders, range),
    [orders, range],
  );
  const maxCategory = Math.max(1, ...categories.map((c) => c.orders));
  const totalCategoryOrders = categories.reduce((sum, c) => sum + c.orders, 0);
  const ordered = {
    "ordered_at@gte": range.start.toISOString(),
    "ordered_at@lt": range.end.toISOString(),
  };
  const allOrders = (
    <Link
      to={listLink("orders", ordered)}
      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
    >
      Orders <ArrowRight className="w-4 h-4" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={
          stats.refunded > 0
            ? "grid grid-cols-2 lg:grid-cols-4 gap-3"
            : "grid grid-cols-2 lg:grid-cols-3 gap-3"
        }
      >
        <KpiTile
          label="Jobs billed"
          to={listLink("orders", { ...ordered, is_deposit: false })}
          value={String(stats.orders)}
          trend={percentChange(stats.orders, before.orders)}
          detail={`${stats.customers} customers`}
        />
        <KpiTile
          label="Average job"
          to={listLink("orders", { ...ordered, is_deposit: false })}
          value={stats.averageOrder == null ? "-" : money(stats.averageOrder)}
          trend={
            stats.averageOrder != null && before.averageOrder != null
              ? percentChange(stats.averageOrder, before.averageOrder)
              : null
          }
          detail={before.averageOrder != null ? vs : "Deposits not included"}
        />
        <KpiTile
          label="Deposits paid"
          to={listLink("orders", { ...ordered, is_deposit: true })}
          value={String(stats.deposits)}
          trend={percentChange(stats.deposits, before.deposits)}
          detail={`${money(stats.depositAmount)} collected`}
        />
        {/* A refund tile that only exists when there is something to see */}
        {stats.refunded > 0 ? (
          <KpiTile
            label="Refunded"
            to={listLink("orders", { ...ordered, "refunded_amount@gt": 0 })}
            value={money(stats.refunded)}
            detail={`${stats.refundedOrders} ${stats.refundedOrders === 1 ? "order" : "orders"}`}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 gap-0">
          <SectionTitle
            icon={ShoppingBag}
            hint={`By line revenue, ${thisPeriod}.`}
            action={allOrders}
          >
            Top sellers
          </SectionTitle>
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
              Nothing billed {thisPeriod} yet.
            </p>
          )}
        </Card>
        <Card className="p-4 gap-0">
          <SectionTitle
            icon={Tags}
            hint={`Where the billed work went, ${thisPeriod}.`}
            action={allOrders}
          >
            Service mix
          </SectionTitle>
          {categories.length ? (
            <div className="flex flex-col">
              {categories.map((c) => (
                <Link
                  key={c.category}
                  to={listLink("orders", {
                    ...ordered,
                    "categories@cs": `{"${c.category}"}`,
                  })}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md border-b border-border last:border-0 min-h-10 hover:bg-muted"
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
                  <span className="w-10 text-right text-xs text-muted-foreground lab-num">
                    {totalCategoryOrders
                      ? `${Math.round((c.orders / totalCategoryOrders) * 100)}%`
                      : "–"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Service mix shows up once jobs are billed.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};
