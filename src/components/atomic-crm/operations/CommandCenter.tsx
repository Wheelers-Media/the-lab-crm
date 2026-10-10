import { BellRing, CalendarCheck } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  activeAppointments,
  dayLoads,
  leadStats,
  needsAttention,
  openPipeline,
  orderRevenue,
  percentChange,
} from "./metrics";
import {
  AppointmentRow,
  AttentionRow,
  KpiTile,
  SectionTitle,
  WeekStrip,
} from "./OperationsWidgets";
import {
  addDays,
  formatShopDay,
  greetingFor,
  type Period,
  shopDayKey,
} from "./shopTime";
import { money } from "./format";
import { PipelineSnapshot } from "./PipelineSnapshot";
import { ShopifyMetrics } from "./ShopifyMetrics";
import { useOperationsData, useRunAutomations } from "./useOperationsData";

const PERIODS: Array<{ value: Period; label: string; vs: string }> = [
  { value: "today", label: "Today", vs: "vs yesterday" },
  { value: "week", label: "Week", vs: "vs last week" },
  { value: "month", label: "Month", vs: "vs last month" },
];

const usePeriod = (): [Period, (p: Period) => void] => {
  const [params, setParams] = useSearchParams();
  const value = params.get("period");
  const period: Period =
    value === "today" || value === "week" || value === "month"
      ? value
      : "month";
  const setPeriod = (p: Period) => {
    const next = new URLSearchParams(params);
    next.set("period", p);
    setParams(next, { replace: true });
  };
  return [period, setPeriod];
};

/** Home screen: the shop's numbers, today's schedule and what needs doing. */
export const CommandCenter = ({
  variant = "desktop",
}: {
  variant?: "desktop" | "phone";
}) => {
  useRunAutomations();
  const { identity } = useGetIdentity();
  const [period, setPeriod] = usePeriod();
  const data = useOperationsData(period);
  const { now, range, previous } = data;
  const todayKey = shopDayKey(now);
  const periodLabel = PERIODS.find((p) => p.value === period)!;

  const kpis = useMemo(() => {
    const revenue = orderRevenue(data.orders, range);
    const revenueBefore = orderRevenue(data.orders, previous);
    const leads = leadStats(data.deals, range);
    const pipeline = openPipeline(data.deals);
    return { revenue, revenueBefore, leads, pipeline };
  }, [data.orders, data.deals, range, previous]);

  const today = useMemo(
    () =>
      activeAppointments(data.appointments).filter(
        (a) => shopDayKey(a.start_at) === todayKey,
      ),
    [data.appointments, todayKey],
  );

  const attention = useMemo(
    () =>
      needsAttention({
        deals: data.deals,
        appointments: data.appointments,
        checkouts: data.checkouts,
        tasks: data.tasks,
        now,
      }),
    [data.deals, data.appointments, data.checkouts, data.tasks, now],
  );

  const weekKeys = useMemo(() => {
    const keys = Array.from({ length: 7 }, (_, i) =>
      addDays(data.weekStartKey, i),
    );
    const loads = dayLoads(data.appointments, keys);
    // The shop is open Monday to Friday; show weekend days only when booked
    return loads.filter((l, i) => i < 5 || l.bay + l.eric > 0);
  }, [data.appointments, data.weekStartKey]);

  const firstName = identity?.fullName?.split(" ")[0];

  const headerBlock = (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatShopDay(todayKey, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-2xl">
            {greetingFor(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          aria-label="Period"
        >
          {PERIODS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className="px-3">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  );
  const kpiBlock = (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Revenue (Shopify)"
          value={money(kpis.revenue)}
          trend={percentChange(kpis.revenue, kpis.revenueBefore)}
          detail={
            percentChange(kpis.revenue, kpis.revenueBefore) != null
              ? periodLabel.vs
              : `${money(kpis.revenueBefore)} ${periodLabel.vs.replace("vs ", "")}`
          }
        />
        <KpiTile
          label="New leads"
          value={String(kpis.leads.total)}
          detail={`${kpis.leads.website} from the website`}
        />
        <KpiTile
          label="Lead to booked"
          value={
            kpis.leads.conversion == null ? "-" : `${kpis.leads.conversion}%`
          }
          detail={`${kpis.leads.booked} of ${kpis.leads.total}`}
        />
        <KpiTile
          label="Open pipeline"
          value={money(kpis.pipeline.amount)}
          detail={`${kpis.pipeline.count} open jobs`}
        />
      </div>
    </>
  );
  const todayCard = (
    <>
      <Card className="p-4 gap-0">
        <SectionTitle
          icon={CalendarCheck}
          action={
            <Link
              to="/calendar"
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Calendar
            </Link>
          }
        >
          Today
        </SectionTitle>
        {today.length ? (
          <div className="divide-y divide-border">
            {today.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                contact={
                  a.contact_id != null
                    ? data.contactsById.get(a.contact_id)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No drop-offs or appointments today. Cal.com bookings appear here
            automatically.
          </p>
        )}
      </Card>
    </>
  );
  const attentionCard = (
    <>
      <Card className="p-4 gap-0">
        <SectionTitle icon={BellRing}>Needs attention</SectionTitle>
        {attention.length ? (
          <div className="divide-y divide-border">
            {attention.map((item) => (
              <AttentionRow key={item.kind} item={item} now={now} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            All caught up. New requests, waiting quotes, unpaid deposits and big
            abandoned carts show up here.
          </p>
        )}
      </Card>
    </>
  );
  const weekBlock = <WeekStrip loads={weekKeys} todayKey={todayKey} />;
  const shopifyBlock = (
    <ShopifyMetrics
      orders={data.orders}
      checkouts={data.checkouts}
      range={range}
      previous={previous}
      vs={periodLabel.vs}
      now={now}
    />
  );

  if (variant === "phone") {
    // Eric's phone: what needs him first, then today, then the numbers
    return (
      <div className="flex flex-col gap-4 mt-1">
        {headerBlock}
        {attentionCard}
        {todayCard}
        <PipelineSnapshot deals={data.deals} />
        {kpiBlock}
        {shopifyBlock}
        {weekBlock}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-1">
      {headerBlock}
      {kpiBlock}
      {shopifyBlock}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {todayCard}
        {attentionCard}
      </div>
      {weekBlock}
    </div>
  );
};
