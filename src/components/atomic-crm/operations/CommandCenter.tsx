import { BellRing, CalendarCheck } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  activeAppointments,
  dayLoads,
  needsAttention,
  openPipeline,
  orderRevenue,
} from "./metrics";
import { MoversCard } from "./MoversCard";
import {
  AppointmentRow,
  AttentionRow,
  SectionTitle,
  WeekStrip,
} from "./OperationsWidgets";
import { Reveal } from "./Reveal";
import { RevenueMixCard } from "./RevenueMixCard";
import { TrendTiles } from "./TrendTiles";
import { movers, trends, weeklyMix } from "./trendsModel";
import { useTrendsData } from "./useTrendsData";
import {
  addDays,
  formatShopDay,
  greetingFor,
  type Period,
  shopDayKey,
} from "./shopTime";

import { ShopFloorSummary } from "../shopfloor/ShopFloorSummary";
import { PipelineSnapshot } from "./PipelineSnapshot";
import { RevenueCard } from "./RevenueCard";
import { useOperationsData, useRunAutomations } from "./useOperationsData";

const PERIODS: Array<{
  value: Period;
  label: string;
  /** "this month" — titles the cards */
  thisPeriod: string;
  /** "last month" — the phrase inside a sentence */
  comparedWith: string;
  vs: string;
}> = [
  {
    value: "today",
    label: "Today",
    thisPeriod: "today",
    comparedWith: "yesterday",
    vs: "vs yesterday",
  },
  {
    value: "week",
    label: "Week",
    thisPeriod: "this week",
    comparedWith: "last week",
    vs: "vs last week",
  },
  {
    value: "month",
    label: "Month",
    thisPeriod: "this month",
    comparedWith: "last month",
    vs: "vs last month",
  },
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
    const pipeline = openPipeline(data.deals);
    return { revenue, revenueBefore, pipeline };
  }, [data.orders, data.deals, range, previous]);

  // Longer history for the trend lines, the revenue mix and the movers
  const history = useTrendsData(period, now);
  const trend = useMemo(
    () =>
      trends(
        {
          orders: history.orders,
          ledgerOrders: history.ledgerOrders,
          deals: data.deals,
          appointments: history.appointments,
        },
        period,
        now,
      ),
    [
      history.orders,
      history.ledgerOrders,
      history.appointments,
      data.deals,
      period,
      now,
    ],
  );
  const mix = useMemo(
    () => weeklyMix(history.orders, now),
    [history.orders, now],
  );
  const moving = useMemo(
    () => movers(history.orders, range, previous),
    [history.orders, range, previous],
  );

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
  const revenueCard = (
    <RevenueCard
      orders={data.orders}
      revenue={kpis.revenue}
      previousRevenue={kpis.revenueBefore}
      range={range}
      previous={previous}
      now={now}
      thisPeriod={periodLabel.thisPeriod}
      comparedWith={periodLabel.comparedWith}
      vs={periodLabel.vs}
      size={period === "today" ? "hour" : "day"}
    />
  );
  const trendBlock = (
    <TrendTiles
      trends={trend}
      isPending={history.isPending || data.isPending}
      vs={periodLabel.vs}
      pipeline={kpis.pipeline}
    />
  );
  const mixCard = <RevenueMixCard weeks={mix} isPending={history.isPending} />;
  const moversCard = (
    <MoversCard
      movers={moving}
      isPending={history.isPending}
      thisPeriod={periodLabel.thisPeriod}
      comparedWith={periodLabel.comparedWith}
    />
  );
  const todayCard = (
    <>
      <Card className="p-4 gap-0">
        <SectionTitle
          icon={CalendarCheck}
          hint="Drop-offs and appointments on the shop clock."
          action={
            <Link
              to="/calendar"
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Calendar
            </Link>
          }
        >
          Today at the bay
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
        <SectionTitle icon={BellRing} hint="What costs money if it waits.">
          Needs attention
        </SectionTitle>
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
  const floorCard = <ShopFloorSummary deals={data.deals} now={now} />;

  if (variant === "phone") {
    // Eric's phone: the money, the numbers under it, then what needs him.
    // Each block rises in as it scrolls into view.
    return (
      <div className="flex flex-col gap-4 mt-1">
        {headerBlock}
        {revenueCard}
        <Reveal>{trendBlock}</Reveal>
        <Reveal>{attentionCard}</Reveal>
        <Reveal>{todayCard}</Reveal>
        <Reveal>{mixCard}</Reveal>
        <Reveal>{moversCard}</Reveal>
        <Reveal>{floorCard}</Reveal>
        <Reveal>
          <PipelineSnapshot deals={data.deals} />
        </Reveal>
        <Reveal>{weekBlock}</Reveal>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-1">
      {headerBlock}
      {revenueCard}
      <Reveal>{trendBlock}</Reveal>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Reveal>{mixCard}</Reveal>
        <Reveal delay={120}>{moversCard}</Reveal>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Reveal>{todayCard}</Reveal>
        <Reveal delay={120}>{attentionCard}</Reveal>
      </div>
      <Reveal>{floorCard}</Reveal>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Reveal>{weekBlock}</Reveal>
        <Reveal delay={120}>
          <PipelineSnapshot deals={data.deals} />
        </Reveal>
      </div>
    </div>
  );
};
