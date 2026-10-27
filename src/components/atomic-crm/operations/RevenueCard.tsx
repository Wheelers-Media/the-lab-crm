import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { money } from "./format";
import { cumulativeRevenue, percentChange } from "./metrics";
import { RevenueChart } from "./RevenueChart";
import { addDays, shopDayKey, type DateRange } from "./shopTime";
import type { Order } from "../types";

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const netOf = (order: Order) =>
  Math.max(0, Number(order.total) - Number(order.refunded_amount ?? 0));

/**
 * What the shop has taken so far, against the same point in the period before.
 * The line answers "are we ahead?" at a glance and the sentence under it says
 * by how much — a percentage alone leaves you doing the subtraction yourself.
 */
export const RevenueCard = ({
  orders,
  revenue,
  previousRevenue,
  range,
  previous,
  now,
  thisPeriod,
  comparedWith,
  vs,
  size = "day",
}: {
  orders: Order[];
  revenue: number;
  previousRevenue: number;
  range: DateRange;
  previous: DateRange;
  now: Date;
  /** "this month" — titles the card and names the solid line. */
  thisPeriod: string;
  /** "last month" — the phrase inside the sentence, and the dashed line. */
  comparedWith: string;
  /** "vs last month", beside the percentage. */
  vs: string;
  size?: "hour" | "day";
}) => {
  const points = cumulativeRevenue(orders, range, previous, now, size);
  const last = points[points.length - 1];
  const gap = revenue - previousRevenue;
  // Math.round gives -0 for a tiny drop, which would point the arrow the
  // wrong way against a sentence that says "behind"
  const change = percentChange(revenue, previousRevenue);
  const trend = change === 0 ? 0 : change;

  const onDay = (key: string) =>
    orders
      .filter((o) => !o.cancelled_at && shopDayKey(o.ordered_at) === key)
      .reduce((sum, o) => sum + netOf(o), 0);
  const todayKey = shopDayKey(now);
  const today = onDay(todayKey);
  const yesterday = onDay(addDays(todayKey, -1));
  const todayTrend = percentChange(today, yesterday);

  return (
    <Card className="p-4 gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="lab-eyebrow">Revenue · {thisPeriod}</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {money(revenue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            <span
              className={cn(
                "mr-1 font-medium",
                trend == null || trend === 0
                  ? "text-muted-foreground"
                  : trend > 0
                    ? "text-[var(--lab-pos)]"
                    : "text-[var(--lab-neg)]",
              )}
            >
              {trend == null ? (
                "—"
              ) : (
                <>
                  {trend > 0 ? (
                    <ArrowUp className="inline size-3" aria-hidden="true" />
                  ) : trend < 0 ? (
                    <ArrowDown className="inline size-3" aria-hidden="true" />
                  ) : null}
                  {Math.abs(trend)}%
                </>
              )}
            </span>{" "}
            {vs}
          </p>
        </div>
        <Link
          to="/numbers"
          className="-my-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Numbers
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground tabular-nums">
          Today{" "}
          <span className="font-medium text-foreground">{money(today)}</span>
          {todayTrend != null && today > 0 ? (
            <>
              {" "}
              <span
                className={
                  todayTrend > 0
                    ? "text-[var(--lab-pos)]"
                    : "text-[var(--lab-neg)]"
                }
              >
                {todayTrend >= 0 ? (
                  <ArrowUp className="inline size-3" aria-hidden="true" />
                ) : (
                  <ArrowDown className="inline size-3" aria-hidden="true" />
                )}
                {Math.abs(todayTrend)}%
              </span>
            </>
          ) : null}
          <span className="mx-1.5 text-border">|</span>
          Yesterday{" "}
          <span className="font-medium text-foreground">
            {money(yesterday)}
          </span>
        </p>

        <RevenueChart
          points={points}
          thisPeriod={`${capitalise(thisPeriod)} so far`}
          lastPeriod={capitalise(comparedWith)}
        />

        {last ? (
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {last.previous === 0 ? (
              <>Nothing to compare with — {comparedWith} had no sales.</>
            ) : gap === 0 ? (
              <>Level with {comparedWith} at this point.</>
            ) : (
              <>
                <span
                  className={
                    gap > 0 ? "text-[var(--lab-pos)]" : "text-[var(--lab-neg)]"
                  }
                >
                  {money(Math.abs(gap))} {gap > 0 ? "ahead of" : "behind"}
                </span>{" "}
                {comparedWith} at this point.
              </>
            )}
          </p>
        ) : null}
      </div>
    </Card>
  );
};
