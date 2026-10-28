import { useMutation } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useDataProvider } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { KpiTile } from "../operations/OperationsWidgets";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import type { CrmDataProvider } from "../providers/types";
import type { NumbersRanges } from "./periods";
import { TrafficDrillSheet, type TrafficDrill } from "./TrafficDrillSheet";
import {
  deviceKeyLabel,
  isFiltered,
  newestSync,
  percentChange,
  percentText,
  sourceKeyLabel,
  sourcesIn,
  TRAFFIC_METRICS,
  trafficBySource,
  trafficByDevice,
  type TrafficFilter,
  trafficFunnel,
  type TrafficGroup,
  trafficInBucket,
  type TrafficMetric,
  type TrafficRow,
  trafficTotals,
  trafficTrend,
} from "./trafficModel";
import { TrendChart } from "./TrendChart";
import type { Column } from "./widgets";
import { Delta, SectionCard, StatTable } from "./widgets";

// Copy again from Shopify when the numbers on hand are older than this
const STALE_MS = 6 * 60 * 60 * 1000;

const count = (n: number) => n.toLocaleString("en-CA");

const bucketTitle = (bucket: NumbersRanges["bucket"], label: string) =>
  bucket === "day"
    ? `Visits on ${label}`
    : bucket === "week"
      ? `Visits in the week of ${label}`
      : `Visits in ${label}`;

const groupColumns = (label: string): Array<Column<TrafficGroup>> => [
  { header: label, value: (r) => r.label },
  { header: "Sessions", value: (r) => r.sessions, numeric: true },
  {
    header: "Share",
    value: (r) => r.share,
    display: (r) => `${r.share}%`,
    numeric: true,
  },
  { header: "Carts", value: (r) => r.carts, numeric: true },
  { header: "Completed", value: (r) => r.completed, numeric: true },
  {
    header: "Conversion",
    value: (r) => r.conversion,
    display: (r) => percentText(r.conversion),
    numeric: true,
  },
  { header: "Before", value: (r) => r.previousSessions, numeric: true },
  {
    header: "Change",
    value: (r) => r.change,
    display: (r) => <Delta value={r.change} />,
    numeric: true,
  },
];

const FilterChips = ({
  filter,
  onSource,
  onDevice,
}: {
  filter: TrafficFilter;
  onSource: (key: string) => void;
  onDevice: (key: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2" role="status">
    <span className="text-sm text-muted-foreground">Showing</span>
    {filter.source ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSource(filter.source!)}
        aria-label={`Clear filter: ${sourceKeyLabel(filter.source)}`}
      >
        {sourceKeyLabel(filter.source)}
        <X />
      </Button>
    ) : null}
    {filter.device ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDevice(filter.device!)}
        aria-label={`Clear filter: ${deviceKeyLabel(filter.device)}`}
      >
        {deviceKeyLabel(filter.device)}
        <X />
      </Button>
    ) : null}
  </div>
);

/**
 * How many people visit the online store and how far they get, from Shopify's
 * reports (copied into the CRM by the traffic_sync function). Tap a figure to
 * chart it, a bar for its sources, a source or device row to filter.
 */
export const TrafficSection = ({
  traffic,
  ranges,
  vs,
  metric,
  onMetric,
  filter,
  onSource,
  onDevice,
}: {
  traffic: {
    rows: TrafficRow[];
    isPending: boolean;
    error: unknown;
    refetch: () => Promise<unknown>;
  };
  ranges: NumbersRanges;
  vs: string;
  metric: TrafficMetric;
  onMetric: (metric: TrafficMetric) => void;
  filter: TrafficFilter;
  /** Picks a source key; picking the one already on clears it. */
  onSource: (key: string) => void;
  onDevice: (key: string) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { rows, isPending, error, refetch } = traffic;
  const [compare, setCompare] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drill, setDrill] = useState<TrafficDrill | null>(null);

  const sync = useMutation({
    mutationFn: () => dataProvider.syncTraffic(),
    onSuccess: () => {
      void refetch();
    },
  });
  const { mutate: syncNow } = sync;
  const syncedAt = useMemo(() => newestSync(rows), [rows]);

  // Bring the copy up to date once per visit when it is missing or old. A
  // failed try is shown below instead of being retried in a loop.
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (tried || isPending || error) return;
    const stale = !syncedAt || Date.now() - Date.parse(syncedAt) > STALE_MS;
    if (!stale) return;
    setTried(true);
    syncNow();
  }, [tried, isPending, error, syncedAt, syncNow]);

  const data = useMemo(
    () => ({
      current: trafficTotals(rows, ranges.current, filter),
      previous: trafficTotals(rows, ranges.previous, filter),
      sources: trafficBySource(rows, ranges, filter),
      devices: trafficByDevice(rows, ranges, filter),
    }),
    [rows, ranges, filter],
  );
  const points = useMemo(
    () => trafficTrend(rows, ranges, metric, filter),
    [rows, ranges, metric, filter],
  );
  const funnel = useMemo(() => trafficFunnel(data.current), [data]);
  const meta = TRAFFIC_METRICS.find((m) => m.value === metric)!;
  const { current: c, previous: p } = data;

  const openBucket = (key: string) => {
    const point = points.find((pt) => pt.key === key);
    if (!point) return;
    setSelectedKey(key);
    setDrill({
      title: bucketTitle(ranges.bucket, point.label),
      sources: sourcesIn(trafficInBucket(rows, ranges, key, filter)),
    });
  };

  const updated = syncedAt
    ? `${formatShopDay(shopDayKey(syncedAt), { month: "short", day: "numeric" })}, ${formatShopTime(syncedAt)}`
    : null;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Visits as Shopify counts them in its reports.{" "}
        {updated ? `Updated ${updated}` : "Not copied from Shopify yet"} · The
        order filter above does not apply here.
      </p>
      {error ? null : (
        <Button
          variant="outline"
          size="sm"
          disabled={sync.isPending}
          onClick={() => syncNow()}
        >
          <RefreshCw
            className={sync.isPending ? "size-4 animate-spin" : "size-4"}
          />
          Update
        </Button>
      )}
    </div>
  );

  if (error) {
    return (
      <>
        {header}
        <p className="text-sm text-destructive">
          Could not load traffic. If this version was only just released, the
          database update for it may not have gone out yet.
        </p>
      </>
    );
  }
  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <>
      {header}
      {sync.error ? (
        <p className="text-sm text-destructive" role="alert">
          {sync.error.message}
        </p>
      ) : null}
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">
          {sync.isPending
            ? "Copying traffic from Shopify. This takes a moment the first time."
            : "No traffic copied yet. Press Update to copy it from Shopify."}
        </p>
      ) : (
        <>
          {isFiltered(filter) ? (
            <FilterChips
              filter={filter}
              onSource={onSource}
              onDevice={onDevice}
            />
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <KpiTile
              label="Sessions"
              value={count(c.sessions)}
              trend={percentChange(c.sessions, p.sessions)}
              detail={vs}
              onSelect={() => onMetric("sessions")}
              selected={metric === "sessions"}
            />
            <KpiTile
              label="Conversion rate"
              value={percentText(c.conversion)}
              detail={`${count(c.completed)} completed · was ${percentText(p.conversion)}`}
              onSelect={() => onMetric("conversion")}
              selected={metric === "conversion"}
            />
            <KpiTile
              label="Added to cart"
              value={count(c.carts)}
              trend={percentChange(c.carts, p.carts)}
              detail={`${percentText(funnel[1].share)} of sessions`}
              onSelect={() => onMetric("carts")}
              selected={metric === "carts"}
            />
            <KpiTile
              label="Reached checkout"
              value={count(c.checkouts)}
              trend={percentChange(c.checkouts, p.checkouts)}
              detail={`${percentText(funnel[2].share)} of sessions`}
              onSelect={() => onMetric("checkouts")}
              selected={metric === "checkouts"}
            />
            <KpiTile
              label="Completed checkout"
              value={count(c.completed)}
              trend={percentChange(c.completed, p.completed)}
              detail={`${percentText(funnel[3].share)} of sessions`}
              onSelect={() => onMetric("completed")}
              selected={metric === "completed"}
            />
          </div>

          <SectionCard
            title={`${meta.label} over time`}
            hint="Bars are this period; the line across each bar is the same stretch before. Tap a figure above to chart it; tap a bar to see where those visits came from."
            actions={
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="traffic-compare"
                  checked={compare}
                  onCheckedChange={setCompare}
                />
                <Label htmlFor="traffic-compare">Compare</Label>
              </div>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={metric}
                onValueChange={(v) => v && onMetric(v as TrafficMetric)}
                aria-label="Traffic chart metric"
                className="lab-scroll-x"
              >
                {TRAFFIC_METRICS.map((m) => (
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
                  <SelectValue placeholder="See sources for…" />
                </SelectTrigger>
                <SelectContent>
                  {points
                    .filter((pt) => pt.sessions > 0)
                    .map((pt) => (
                      <SelectItem key={pt.key} value={pt.key}>
                        {pt.label}, {count(pt.sessions)}{" "}
                        {pt.sessions === 1 ? "session" : "sessions"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <TrendChart
              points={points}
              isMoney={false}
              percent={meta.percent}
              compare={compare}
              selectedKey={selectedKey}
              onSelect={openBucket}
              clickHint="Click to see where the visits came from"
              label={meta.label}
            />
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <SectionCard
              title="Path to a purchase"
              hint="Each step against all sessions. A visit can go straight to checkout, so a step can be bigger than the one above. Tap a step to chart it."
            >
              <ul className="flex flex-col gap-1">
                {funnel.map((step) => (
                  <li key={step.key}>
                    <button
                      type="button"
                      onClick={() => onMetric(step.key)}
                      aria-pressed={metric === step.key}
                      className="w-full rounded-md px-1 py-1.5 text-left hover:bg-muted"
                    >
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span
                          className={metric === step.key ? "font-medium" : ""}
                        >
                          {step.label}
                        </span>
                        <span className="lab-num text-muted-foreground">
                          {count(step.count)}, {percentText(step.share)}
                        </span>
                      </span>
                      <span className="mt-1 block h-2 rounded-full bg-muted">
                        <span
                          className="block h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, step.share ?? 0)}%`,
                          }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard
              title="By device"
              hint="Tap a row to filter the traffic section to it."
            >
              <StatTable
                rows={data.devices}
                rowKey={(r) => r.key}
                columns={groupColumns("Device")}
                filename="traffic-by-device.csv"
                onRowClick={(r) => onDevice(r.key)}
                isSelected={(r) => filter.device === r.key}
                empty="No visits in this period."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Where visitors come from"
            hint="Tap a row to filter the traffic section to that source. thelabfsj.ca is visits that came from the website."
          >
            <StatTable
              rows={data.sources}
              rowKey={(r) => r.key}
              columns={[
                { header: "Source", value: (r) => r.label },
                { header: "Type", value: (r) => r.kind },
                ...groupColumns("Source").slice(1),
              ]}
              filename="traffic-by-source.csv"
              onRowClick={(r) => onSource(r.key)}
              isSelected={(r) => filter.source === r.key}
              empty="No visits in this period."
            />
          </SectionCard>
        </>
      )}
      <TrafficDrillSheet
        drill={drill}
        onPick={(key) => {
          if (filter.source !== key) onSource(key);
        }}
        onClose={() => {
          setDrill(null);
          setSelectedKey(null);
        }}
      />
    </>
  );
};
