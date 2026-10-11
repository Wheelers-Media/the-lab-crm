import { useMemo } from "react";

import { money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Order } from "../types";
import type { NumbersRanges } from "./periods";
import {
  percentChange,
  salesByCategory,
  salesByChannel,
  salesSummary,
  salesTrend,
  withPrevious,
} from "./salesModel";
import { TrendChart } from "./TrendChart";
import type { Column } from "./widgets";
import { Delta, SectionCard, StatTable } from "./widgets";

type Row = ReturnType<
  typeof withPrevious<ReturnType<typeof salesByCategory>[number]>
>[number];

const groupColumns = (label: string, total: number): Array<Column<Row>> => [
  { header: label, value: (r) => r.name },
  { header: "Orders", value: (r) => r.orders, numeric: true },
  {
    header: "Net sales",
    value: (r) => Math.round(r.netSales),
    display: (r) => money(r.netSales),
    numeric: true,
  },
  {
    header: "Share",
    value: (r) => (total ? Math.round((r.netSales / total) * 100) : 0),
    display: (r) => `${total ? Math.round((r.netSales / total) * 100) : 0}%`,
    numeric: true,
  },
  {
    header: "Before",
    value: (r) => Math.round(r.previousNetSales),
    display: (r) => money(r.previousNetSales),
    numeric: true,
  },
  {
    header: "Change",
    value: (r) => r.change,
    display: (r) => <Delta value={r.change} />,
    numeric: true,
  },
];

export const SalesSection = ({
  orders,
  ranges,
  vs,
}: {
  orders: Order[];
  ranges: NumbersRanges;
  vs: string;
}) => {
  const now = useMemo(() => {
    const current = salesSummary(orders, ranges.current);
    const previous = salesSummary(orders, ranges.previous);
    return {
      current,
      previous,
      trend: salesTrend(orders, ranges),
      categories: withPrevious(
        salesByCategory(orders, ranges.current),
        salesByCategory(orders, ranges.previous),
      ),
      channels: withPrevious(
        salesByChannel(orders, ranges.current),
        salesByChannel(orders, ranges.previous),
      ),
    };
  }, [orders, ranges]);
  const { current: c, previous: p } = now;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Net sales"
          value={money(c.netSales)}
          trend={percentChange(c.netSales, p.netSales)}
          detail={`${money(c.collected)} collected`}
        />
        <KpiTile
          label="Orders"
          value={String(c.orders)}
          trend={percentChange(c.orders, p.orders)}
          detail={vs}
        />
        <KpiTile
          label="Average order"
          value={c.averageOrder == null ? "–" : money(c.averageOrder)}
          trend={
            c.averageOrder != null && p.averageOrder
              ? percentChange(c.averageOrder, p.averageOrder)
              : null
          }
          detail={`largest ${money(c.largestOrder)}`}
        />
        <KpiTile
          label="Units sold"
          value={String(Math.round(c.units))}
          trend={percentChange(c.units, p.units)}
          detail={
            c.unitsPerOrder == null
              ? ""
              : `${c.unitsPerOrder.toFixed(1)} per order`
          }
        />
        <KpiTile
          label="Refunds"
          value={money(c.refunds)}
          detail={
            c.refundRate == null
              ? "no orders"
              : `${c.refundedOrders} orders, ${c.refundRate}%`
          }
        />
        <KpiTile
          label="Deposits"
          value={String(c.deposits)}
          detail={`${money(c.depositAmount)} held, not counted as sales`}
        />
      </div>

      <SectionCard
        title="Net sales over time"
        hint="Blue is this period, grey is the same stretch before. Net sales are before tax and shipping, after discounts."
      >
        <TrendChart points={now.trend} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="By kind of work"
          hint="Discounts are spread over each order's lines."
        >
          <StatTable
            rows={now.categories}
            rowKey={(r) => r.name}
            columns={groupColumns("Category", c.netSales)}
            filename="net-sales-by-category.csv"
          />
        </SectionCard>
        <SectionCard
          title="By channel"
          hint="Draft orders are the pay links made from quotes."
        >
          <StatTable
            rows={now.channels}
            rowKey={(r) => r.name}
            columns={groupColumns("Channel", c.netSales)}
            filename="net-sales-by-channel.csv"
          />
        </SectionCard>
      </div>
    </>
  );
};
