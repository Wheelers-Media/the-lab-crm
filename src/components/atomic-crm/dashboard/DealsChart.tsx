import { ResponsiveBar } from "@nivo/bar";
import { format, startOfMonth } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { findDealLabel } from "../deals/dealUtils";
import {
  useChartPalette,
  usePrefersReducedMotion,
} from "../operations/chartTheme";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/** How much of an open deal is likely to land, by stage. */
const multiplier: Record<string, number> = {
  intake: 0.1,
  qualified: 0.3,
  quoted: 0.5,
  booked: 0.8,
};

const MONTHS_SHOWN = 6;

const DEFAULT_LOCALE = "en-CA";

/** Midnight on the first of the month, this many months back. */
const startOfWindow = (months: number): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
};

export const DealsChart = memo(() => {
  const translate = useTranslate();
  const palette = useChartPalette();
  const reducedMotion = usePrefersReducedMotion();
  const { dealStages, currency } = useConfigurationContext();
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];
  const locale = acceptedLanguages.at(0) ?? DEFAULT_LOCALE;
  const wonLabel = findDealLabel(dealStages, "won") ?? "Won";
  const lostLabel = findDealLabel(dealStages, "lost") ?? "Lost";

  const money = (value: number) =>
    value.toLocaleString(locale, { style: "currency", currency });

  // The window moves with the calendar: a screen left open across a month
  // boundary still asks for the right six months
  const since = startOfWindow(MONTHS_SHOWN).toISOString();

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 2000, page: 1 },
    sort: {
      field: "created_at",
      order: "ASC",
    },
    filter: {
      "created_at@gte": since,
    },
  });

  const months = useMemo(() => {
    if (!data) return [];
    const dealsByMonth = data.reduce(
      (acc, deal) => {
        const month = startOfMonth(
          deal.created_at ?? new Date(),
        ).toISOString();
        (acc[month] ??= []).push(deal);
        return acc;
      },
      {} as Record<string, Deal[]>,
    );

    // Every month in the window, in order, even the quiet ones
    return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
      const date = startOfWindow(MONTHS_SHOWN);
      date.setMonth(date.getMonth() + i);
      const month = startOfMonth(date).toISOString();
      const deals = dealsByMonth[month] ?? [];
      return {
        date: format(date, "MMM"),
        won: deals
          .filter((deal: Deal) => deal.stage === "won")
          .reduce((acc: number, deal: Deal) => acc + deal.amount, 0),
        pending: deals
          .filter((deal: Deal) => !["won", "lost"].includes(deal.stage))
          .reduce(
            (acc: number, deal: Deal) =>
              acc + deal.amount * (multiplier[deal.stage] ?? 0),
            0,
          ),
        // Negative, and signed on the axis, so a loss never reads as income
        lost: deals
          .filter((deal: Deal) => deal.stage === "lost")
          .reduce((acc: number, deal: Deal) => acc - deal.amount, 0),
      };
    });
  }, [data]);

  if (isPending)
    return <Skeleton className="h-[340px] w-full rounded-lg" />;

  const range = months.reduce(
    (acc, month) => {
      acc.min = Math.min(acc.min, month.lost);
      acc.max = Math.max(acc.max, month.won + month.pending);
      return acc;
    },
    { min: 0, max: 0 },
  );
  const total = (key: "won" | "pending" | "lost") =>
    months.reduce((sum, month) => sum + month[key], 0);
  const summary =
    `${translate("crm.dashboard.deals_chart")}, the last ${MONTHS_SHOWN} months. ` +
    `${money(total("won"))} ${wonLabel.toLowerCase()}, ` +
    `${money(Math.abs(total("lost")))} ${lostLabel.toLowerCase()}, and ` +
    `${money(total("pending"))} of open work weighted by stage.`;

  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="text-muted-foreground w-5 h-5" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-muted-foreground">
          {translate("crm.dashboard.deals_chart")}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {[
          { label: wonLabel, color: palette.thisPeriod },
          { label: "Open, weighted", color: palette.pending },
          { label: lostLabel, color: palette.lost },
        ].map((series) => (
          <span key={series.label} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: series.color }}
              aria-hidden="true"
            />
            {series.label}
          </span>
        ))}
      </div>
      <figure className="m-0">
        <figcaption className="sr-only">{summary}</figcaption>
        <div className="h-[340px]" role="img" aria-label={summary}>
          <ResponsiveBar
            data={months}
            indexBy="date"
            keys={["won", "pending", "lost"]}
            colors={[palette.thisPeriod, palette.pending, palette.lost]}
            margin={{ top: 8, right: 50, bottom: 30, left: 0 }}
            padding={0.3}
            valueScale={{
              type: "linear",
              min: range.min * 1.2,
              max: range.max * 1.2,
            }}
            indexScale={{ type: "band", round: true }}
            animate={!reducedMotion}
            enableGridX={true}
            enableGridY={false}
            enableLabel={false}
            tooltip={({ value, indexValue }) => (
              <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground text-sm">
                <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
                {money(Number(value))}
              </div>
            )}
            axisTop={null}
            axisBottom={{
              tickSize: 0,
              tickPadding: 12,
              style: {
                ticks: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
              },
            }}
            axisLeft={null}
            axisRight={{
              // Whole thousands only from 1k up, so the ticks never repeat
              format: (v) => {
                const value = Number(v);
                return Math.abs(value) >= 1000
                  ? `${Math.round(value / 1000)}k`
                  : String(Math.round(value));
              },
              tickValues: 6,
              style: {
                ticks: {
                  text: {
                    fill: "var(--color-muted-foreground)",
                  },
                },
              },
            }}
          />
        </div>
        <table className="sr-only">
          <caption>{translate("crm.dashboard.deals_chart")}</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">{wonLabel}</th>
              <th scope="col">Open, weighted</th>
              <th scope="col">{lostLabel}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.date}>
                <th scope="row">{month.date}</th>
                <td>{money(month.won)}</td>
                <td>{money(month.pending)}</td>
                <td>{money(month.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </Card>
  );
});
