import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { CustomersSection } from "./CustomersSection";
import { InsightsSection } from "./InsightsSection";
import {
  inSegment,
  isSalesMetric,
  parseSegment,
  sameSegment,
  type SalesMetric,
  type Segment,
  segmentLabel,
  segmentParam,
} from "./insightsModel";
import { type Drill, OrderDrillSheet } from "./OrderDrillSheet";
import { type NumbersPeriod, NUMBERS_PERIODS } from "./periods";
import { PipelineSection } from "./PipelineSection";
import { ProductsSection } from "./ProductsSection";
import { SalesSection } from "./SalesSection";
import { ShopSection } from "./ShopSection";
import { useNumbersData } from "./useNumbersData";

const isPeriod = (value: string | null): value is NumbersPeriod =>
  NUMBERS_PERIODS.some((p) => p.value === value);

const Heading = ({ children }: { children: string }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-4">
    {children}
  </h2>
);

/**
 * The shop's numbers: sales, products, customers, leads, stock and capacity.
 * What you pick lives in the address (period, chart metric, segment), so a
 * view can be bookmarked, shared and reached with the Back button.
 */
export const NumbersPage = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("period");
  const period: NumbersPeriod = isPeriod(requested) ? requested : "month";
  const requestedMetric = params.get("metric");
  const metric: SalesMetric = isSalesMetric(requestedMetric)
    ? requestedMetric
    : "netSales";
  const segmentRaw = params.get("segment");
  const segment = useMemo(() => parseSegment(segmentRaw), [segmentRaw]);

  const data = useNumbersData(period);
  const label = NUMBERS_PERIODS.find((p) => p.value === period)!;
  const [drill, setDrill] = useState<Drill | null>(null);

  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null) next.delete(name);
    else next.set(name, value);
    setParams(next, { replace: true });
  };
  // Picking the segment that is already on clears it
  const pickSegment = (next: Segment) =>
    setParam("segment", sameSegment(segment, next) ? null : segmentParam(next));

  const filtered = useMemo(
    () =>
      segment ? data.orders.filter((o) => inSegment(o, segment)) : data.orders,
    [data.orders, segment],
  );

  return (
    <div className="flex flex-col gap-4 mt-2 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display uppercase tracking-wide">
            Numbers
          </h1>
          <p className="text-sm text-muted-foreground">
            {label.label}, {label.vs}. From Shopify orders and the CRM. Tap a
            figure, bar or row to dig in.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={period}
          onValueChange={(v) => {
            if (v) setParam("period", v);
          }}
          aria-label="Period"
          className="flex-wrap"
        >
          {NUMBERS_PERIODS.map((p) => (
            <ToggleGroupItem
              key={p.value}
              value={p.value}
              className="px-3 min-h-9"
            >
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {segment ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="text-sm text-muted-foreground">Showing</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParam("segment", null)}
            aria-label={`Clear filter: ${segmentLabel(segment)}`}
          >
            {segmentLabel(segment)}
            <X />
          </Button>
          <span className="text-xs text-muted-foreground">
            Sales, patterns and products follow this filter. Customers, leads
            and stock always show everything.
          </span>
        </div>
      ) : null}

      {data.error ? (
        <p className="text-sm text-destructive">
          Could not load the orders. Try refreshing.
        </p>
      ) : data.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <Heading>Sales</Heading>
          <SalesSection
            orders={filtered}
            breakdownOrders={data.orders}
            ranges={data.ranges}
            vs={label.vs}
            metric={metric}
            onMetric={(m) => setParam("metric", m === "netSales" ? null : m)}
            segment={segment}
            onSegment={pickSegment}
            onDrill={setDrill}
          />
          <Heading>Patterns</Heading>
          <InsightsSection
            orders={filtered}
            ledgerOrders={data.ledgerOrders}
            ranges={data.ranges}
            period={period}
            now={data.now}
            segmentActive={segment != null}
            onDrill={setDrill}
          />
          <Heading>Products</Heading>
          <ProductsSection
            orders={filtered}
            catalog={data.catalog}
            ranges={data.ranges}
          />
          <Heading>Customers</Heading>
          <CustomersSection
            orders={data.ledgerOrders}
            ranges={data.ranges}
            now={data.now}
          />
          <Heading>Leads and carts</Heading>
          <PipelineSection
            deals={data.deals}
            changes={data.changes}
            checkouts={data.checkouts}
            ranges={data.ranges}
            now={data.now}
          />
          <Heading>Stock and shop capacity</Heading>
          <ShopSection
            catalog={data.catalog}
            orders={data.orders}
            appointments={data.appointments}
            ranges={data.ranges}
            now={data.now}
          />
        </>
      )}
      <OrderDrillSheet drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
};

NumbersPage.path = "/numbers";
