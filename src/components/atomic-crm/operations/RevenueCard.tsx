import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { money } from "./format";
import { dailyRevenue, percentChange } from "./metrics";
import { formatShopDay } from "./shopTime";
import type { Order } from "../types";

/**
 * The shop's revenue for the chosen period, with the last two weeks beside it
 * so a slow Tuesday stands out at a glance. The bars are decorative: the
 * figcaption carries the same numbers for screen readers.
 */
export const RevenueCard = ({
  orders,
  todayKey,
  revenue,
  previousRevenue,
  periodLabel,
  vs,
}: {
  orders: Order[];
  todayKey: string;
  revenue: number;
  previousRevenue: number;
  periodLabel: string;
  vs: string;
}) => {
  const points = dailyRevenue(orders, todayKey, 14);
  const max = Math.max(1, ...points.map((p) => p.value));
  const today = points[points.length - 1]?.value ?? 0;
  const yesterday = points[points.length - 2]?.value ?? 0;
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const best = points.reduce((top, p) => (p.value > top.value ? p : top));
  const trend = percentChange(revenue, previousRevenue);
  const todayTrend = percentChange(today, yesterday);

  const summary =
    `Revenue ${periodLabel}: ${money(revenue)}. ${vs} ${money(previousRevenue)}. ` +
    `Today ${money(today)}, yesterday ${money(yesterday)}. ` +
    `Last 14 days: ${money(total)}, best day ${formatShopDay(best.key)} at ${money(best.value)}.`;

  return (
    <Card className="p-4 gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="lab-eyebrow">Revenue · {periodLabel}</h2>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {money(revenue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            <span
              className={cn(
                "mr-1 font-medium",
                trend == null
                  ? "text-muted-foreground"
                  : trend >= 0
                    ? "text-[#3fb27f]"
                    : "text-[#e5484d]",
              )}
            >
              {trend == null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}
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

      <figure className="m-0">
        <figcaption className="sr-only">{summary}</figcaption>
        <p className="mb-2 text-xs text-muted-foreground tabular-nums">
          Today{" "}
          <span className="font-medium text-foreground">{money(today)}</span>
          {todayTrend != null && today > 0 ? (
            <>
              {" "}
              <span
                className={
                  todayTrend >= 0 ? "text-[#3fb27f]" : "text-[#e5484d]"
                }
              >
                {todayTrend > 0 ? "+" : ""}
                {todayTrend}%
              </span>
            </>
          ) : null}
          <span className="mx-1.5 text-border">|</span>
          Yesterday{" "}
          <span className="font-medium text-foreground">
            {money(yesterday)}
          </span>
        </p>

        <div aria-hidden="true">
          <div className="flex h-24 items-end gap-[3px] border-b border-border">
            {points.map((point) => {
              const isToday = point.key === todayKey;
              const height = Math.round((point.value / max) * 100);
              return (
                <div
                  key={point.key}
                  title={`${formatShopDay(point.key)}: ${money(point.value)}`}
                  className={cn(
                    "flex-1 rounded-t-[3px]",
                    point.value === 0
                      ? "bg-border"
                      : isToday
                        ? "bg-primary"
                        : "bg-[var(--lab-blue)]/40",
                  )}
                  style={{
                    height: point.value === 0 ? 2 : `${Math.max(4, height)}%`,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground tabular-nums">
            {points.map((point, i) => (
              <span key={point.key} className="flex-1 text-center">
                {i % 3 === 0 || point.key === todayKey ? point.label : ""}
              </span>
            ))}
          </div>
        </div>
      </figure>
    </Card>
  );
};
