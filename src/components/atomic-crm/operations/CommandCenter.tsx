import { CalendarCheck } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  activeAppointments,
  dayLoads,
  openPipeline,
  depositsHeld,
  orderRevenue,
} from "./metrics";
import { AttentionCard } from "./AttentionCard";
import { bookingsToCheck, needsAttention } from "./attentionModel";
import { LoadError } from "./LoadError";
import { MoversCard } from "./MoversCard";
import { AppointmentRow, SectionTitle, WeekStrip } from "./OperationsWidgets";
import { Reveal } from "./Reveal";
import { RevenueMixCard } from "./RevenueMixCard";
import { GoalsCard } from "./GoalsCard";
import { elapsedShare, goalProgress, monthlyTargets } from "./goalsModel";
import { useConfigurationContext } from "../root/ConfigurationContext";
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
    const deposits = depositsHeld(data.orders, range);
    const pipeline = openPipeline(data.deals);
    return { revenue, revenueBefore, deposits, pipeline };
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
  // Last month's figures, for goals nobody has set yet
  const config = useConfigurationContext();
  const goals = useMemo(() => {
    const lastMonth = trends(
      {
        orders: history.orders,
        ledgerOrders: history.ledgerOrders,
        deals: data.deals,
        appointments: history.appointments,
      },
      "month",
      now,
      2,
    ).series[0];
    const monthly = monthlyTargets(config.targets, {
      revenue: lastMonth.revenue,
      orders: lastMonth.salesOrders,
      newCustomers: lastMonth.newCustomers,
    });
    const elapsed = elapsedShare(range, now);
    const current = trend.current;
    return {
      elapsed,
      monthly: {
        revenue: monthly.revenue.value,
        orders: monthly.orders.value,
        newCustomers: monthly.newCustomers.value,
      },
      list: [
        goalProgress(
          "revenue",
          current.revenue,
          monthly.revenue.value,
          period,
          elapsed,
          monthly.revenue.suggested,
        ),
        goalProgress(
          "orders",
          current.salesOrders,
          monthly.orders.value,
          period,
          elapsed,
          monthly.orders.suggested,
        ),
        goalProgress(
          "newCustomers",
          current.newCustomers,
          monthly.newCustomers.value,
          period,
          elapsed,
          monthly.newCustomers.suggested,
        ),
      ],
    };
  }, [
    history.orders,
    history.ledgerOrders,
    history.appointments,
    data.deals,
    config.targets,
    range,
    now,
    period,
    trend,
  ]);

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

  const toCheck = useMemo(
    () => bookingsToCheck(data.appointments, now),
    [data.appointments, now],
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
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
          className="grid w-full grid-cols-3 sm:flex sm:w-auto"
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
      deposits={kpis.deposits}
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
  const goalsCard = (
    <GoalsCard
      goals={goals.list}
      monthly={goals.monthly}
      elapsed={goals.elapsed}
      periodLabel={periodLabel.thisPeriod}
      isPending={history.isPending || data.isPending}
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
    <AttentionCard
      items={attention}
      now={now}
      toCheck={toCheck}
      contactsById={data.contactsById}
    />
  );
  const weekBlock = <WeekStrip loads={weekKeys} todayKey={todayKey} />;
  const floorCard = <ShopFloorSummary deals={data.deals} now={now} />;

  const loadError = data.error ?? history.error;
  if (loadError) {
    return (
      <div className="flex flex-col gap-4 mt-1">
        {headerBlock}
        <LoadError
          onRetry={() => {
            data.retry();
            history.retry();
          }}
        />
      </div>
    );
  }

  if (variant === "phone") {
    // Eric's phone: the money, the numbers under it, then what needs him.
    // Each block rises in as it scrolls into view.
    return (
      <div className="flex flex-col gap-4 mt-1">
        {headerBlock}
        {revenueCard}
        {goalsCard}
        <Reveal>{attentionCard}</Reveal>
        <Reveal>{todayCard}</Reveal>
        <Reveal>{trendBlock}</Reveal>
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
      {/* What needs doing sits in a rail beside the numbers on a wide screen and
          above them on a narrow one, so the order follows the window. */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <aside
          aria-label="Today and what needs attention"
          className="order-1 grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:order-2 xl:flex xl:flex-col xl:items-stretch"
        >
          <Reveal>{attentionCard}</Reveal>
          <Reveal delay={120}>{todayCard}</Reveal>
          <div className="lg:col-span-2 xl:col-span-1">
            <Reveal>{floorCard}</Reveal>
          </div>
        </aside>
        <div className="order-2 flex min-w-0 flex-col gap-4 xl:order-1">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            {revenueCard}
            {goalsCard}
          </div>
          <Reveal>{trendBlock}</Reveal>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Reveal>{mixCard}</Reveal>
            <Reveal delay={120}>{moversCard}</Reveal>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Reveal>{weekBlock}</Reveal>
            <Reveal delay={120}>
              <PipelineSnapshot deals={data.deals} />
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
};
