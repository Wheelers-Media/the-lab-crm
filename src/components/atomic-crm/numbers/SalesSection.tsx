import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { money } from "../operations/format";
import { KpiTile } from "../operations/OperationsWidgets";
import type { Order } from "../types";
import {
  metricTrend,
  ordersInBucket,
  sameSegment,
  SALES_METRICS,
  type SalesMetric,
  type Segment,
} from "./insightsModel";
import type { Drill } from "./OrderDrillSheet";
import type { NumbersRanges } from "./periods";
import {
  percentChange,
  salesByCategory,
  salesByChannel,
  salesSummary,
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

const bucketTitle = (bucket: NumbersRanges["bucket"], label: string) =>
  bucket === "day"
    ? `Orders on ${label}`
    : bucket === "week"
      ? `Orders in the week of ${label}`
      : `Orders in ${label}`;

export const SalesSection = ({
  orders,
  breakdownOrders,
  ranges,
  vs,
  metric,
  onMetric,
  segment,
  onSegment,
  onDrill,
}: {
  /** The orders after the screen's segment filter: figures and chart. */
  orders: Order[];
  /** Every order: the breakdown tables keep showing all rows to pick from. */
  breakdownOrders: Order[];
  ranges: NumbersRanges;
  vs: string;
  metric: SalesMetric;
  onMetric: (metric: SalesMetric) => void;
  segment: Segment | null;
  onSegment: (segment: Segment) => void;
  onDrill: (drill: Drill) => void;
}) => {
  const [compare, setCompare] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const now = useMemo(
    () => ({
      current: salesSummary(orders, ranges.current),
      previous: salesSummary(orders, ranges.previous),
      breakdownTotal: salesSummary(breakdownOrders, ranges.current).netSales,
      categories: withPrevious(
        salesByCategory(breakdownOrders, ranges.current),
        salesByCategory(breakdownOrders, ranges.previous),
      ),
      channels: withPrevious(
        salesByChannel(breakdownOrders, ranges.current),
        salesByChannel(breakdownOrders, ranges.previous),
      ),
    }),
    [orders, breakdownOrders, ranges],
  );
  const { current: c, previous: p } = now;
  const points = useMemo(
    () => metricTrend(orders, ranges, metric),
    [orders, ranges, metric],
  );
  const meta = SALES_METRICS.find((m) => m.value === metric)!;

  const openBucket = (key: string) => {
    const point = points.find((pt) => pt.key === key);
    if (!point) return;
    setSelectedKey(key);
    onDrill({
      title: bucketTitle(ranges.bucket, point.label),
      orders: ordersInBucket(orders, ranges, key),
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiTile
          label="Net sales"
          value={money(c.netSales)}
          trend={percentChange(c.netSales, p.netSales)}
          detail={`${money(c.collected)} collected`}
          onSelect={() => onMetric("netSales")}
          selected={metric === "netSales"}
        />
        <KpiTile
          label="Orders"
          value={String(c.orders)}
          trend={percentChange(c.orders, p.orders)}
          detail={vs}
          onSelect={() => onMetric("orders")}
          selected={metric === "orders"}
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
          onSelect={() => onMetric("average")}
          selected={metric === "average"}
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
          onSelect={() => onMetric("units")}
          selected={metric === "units"}
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
        title={`${meta.label} over time`}
        hint="Bars are this period; the line across each bar is the same stretch before. Net sales are before tax and shipping, after discounts. Tap a figure above to chart it; tap a bar for its orders."
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="numbers-compare"
              checked={compare}
              onCheckedChange={setCompare}
            />
            <Label htmlFor="numbers-compare">Compare</Label>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={metric}
            onValueChange={(v) => v && onMetric(v as SalesMetric)}
            aria-label="Chart metric"
            className="lab-scroll-x"
          >
            {SALES_METRICS.map((m) => (
              <ToggleGroupItem
                key={m.value}
                value={m.value}
                className="px-3 min-h-9"
              >
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value="" onValueChange={openBucket}>
            <SelectTrigger size="sm" className="w-auto min-w-40">
              <SelectValue placeholder="See orders for…" />
            </SelectTrigger>
            <SelectContent>
              {points
                .filter((pt) => pt.orders > 0)
                .map((pt) => (
                  <SelectItem key={pt.key} value={pt.key}>
                    {pt.label}, {pt.orders}{" "}
                    {pt.orders === 1 ? "order" : "orders"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <TrendChart
          points={points}
          isMoney={meta.money}
          compare={compare}
          selectedKey={selectedKey}
          onSelect={openBucket}
          label={meta.label}
        />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SectionCard
          title="By kind of work"
          hint="Tap a row to filter the whole screen to it. Discounts are spread over each order's lines."
        >
          <StatTable
            rows={now.categories}
            rowKey={(r) => r.name}
            columns={groupColumns("Category", now.breakdownTotal)}
            filename="net-sales-by-category.csv"
            onRowClick={(r) => onSegment({ kind: "category", value: r.name })}
            isSelected={(r) =>
              sameSegment(segment, { kind: "category", value: r.name })
            }
          />
        </SectionCard>
        <SectionCard
          title="By channel"
          hint="Tap a row to filter. Draft orders are the pay links made from quotes."
        >
          <StatTable
            rows={now.channels}
            rowKey={(r) => r.name}
            columns={groupColumns("Channel", now.breakdownTotal)}
            filename="net-sales-by-channel.csv"
            onRowClick={(r) => onSegment({ kind: "channel", value: r.name })}
            isSelected={(r) =>
              sameSegment(segment, { kind: "channel", value: r.name })
            }
          />
        </SectionCard>
      </div>
    </>
  );
};
