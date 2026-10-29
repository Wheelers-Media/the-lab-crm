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
import { type NumbersSection, SectionNav } from "./SectionNav";
import { ShopSection } from "./ShopSection";
import { SearchSection } from "./SearchSection";
import { TrafficSection } from "./TrafficSection";
import { isTrafficMetric, type TrafficMetric } from "./trafficModel";
import { useNumbersData } from "./useNumbersData";

const isPeriod = (value: string | null): value is NumbersPeriod =>
  NUMBERS_PERIODS.some((p) => p.value === value);

const SECTIONS: NumbersSection[] = [
  { id: "sales", label: "Sales" },
  { id: "traffic", label: "Traffic & search" },
  { id: "patterns", label: "Patterns" },
  { id: "products", label: "Products" },
  { id: "customers", label: "Customers" },
  { id: "leads", label: "Leads" },
  { id: "stock", label: "Stock" },
];

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
  const requestedTraffic = params.get("traffic");
  const trafficMetric: TrafficMetric = isTrafficMetric(requestedTraffic)
    ? requestedTraffic
    : "sessions";
  const sourceParam = params.get("source");
  const deviceParam = params.get("device");
  const trafficFilter = useMemo(
    () => ({ source: sourceParam || null, device: deviceParam || null }),
    [sourceParam, deviceParam],
  );

  const requestedSection = params.get("section");
  const section = SECTIONS.some((x) => x.id === requestedSection)
    ? requestedSection!
    : "sales";

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
  // The traffic source and device work the same way
  const pickTraffic = (name: string, current: string | null, next: string) =>
    setParam(name, current === next ? null : next);

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
            {label.label}, {label.vs}.
            <span className="hidden sm:inline">
              {" "}
              From Shopify orders and traffic, Google Search Console and the
              CRM. Tap a figure, bar or row to dig in.
            </span>
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
          className="lab-scroll-x"
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
            Sales, patterns and products follow this filter. Customers, leads,
            stock and traffic always show everything.
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
          <SectionNav
            sections={SECTIONS}
            current={section}
            onPick={(id) => setParam("section", id === "sales" ? null : id)}
          />
          <h2 className="sr-only">
            {SECTIONS.find((x) => x.id === section)!.label}
          </h2>
          {section === "sales" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <SalesSection
                orders={filtered}
                breakdownOrders={data.orders}
                ranges={data.ranges}
                vs={label.vs}
                metric={metric}
                onMetric={(m) =>
                  setParam("metric", m === "netSales" ? null : m)
                }
                segment={segment}
                onSegment={pickSegment}
                onDrill={setDrill}
              />
            </div>
          ) : null}
          {section === "traffic" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <SearchSection ranges={data.ranges} vs={label.vs} />
              <h2 className="mt-4 text-xl font-semibold">
                Online store visits
              </h2>
              <TrafficSection
                traffic={data.traffic}
                ranges={data.ranges}
                vs={label.vs}
                metric={trafficMetric}
                onMetric={(m) =>
                  setParam("traffic", m === "sessions" ? null : m)
                }
                filter={trafficFilter}
                onSource={(key) =>
                  pickTraffic("source", trafficFilter.source, key)
                }
                onDevice={(key) =>
                  pickTraffic("device", trafficFilter.device, key)
                }
              />
            </div>
          ) : null}
          {section === "patterns" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <InsightsSection
                orders={filtered}
                ledgerOrders={data.ledgerOrders}
                ranges={data.ranges}
                period={period}
                now={data.now}
                segmentActive={segment != null}
                onDrill={setDrill}
              />
            </div>
          ) : null}
          {section === "products" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <ProductsSection
                orders={filtered}
                catalog={data.catalog}
                ranges={data.ranges}
              />
            </div>
          ) : null}
          {section === "customers" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <CustomersSection
                orders={data.ledgerOrders}
                ranges={data.ranges}
                now={data.now}
              />
            </div>
          ) : null}
          {section === "leads" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <PipelineSection
                deals={data.deals}
                changes={data.changes}
                checkouts={data.checkouts}
                ranges={data.ranges}
                now={data.now}
              />
            </div>
          ) : null}
          {section === "stock" ? (
            <div className="flex flex-col gap-4" role="tabpanel">
              <ShopSection
                catalog={data.catalog}
                orders={data.orders}
                appointments={data.appointments}
                ranges={data.ranges}
                now={data.now}
              />
            </div>
          ) : null}
        </>
      )}
      <OrderDrillSheet drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
};

NumbersPage.path = "/numbers";
