import { type BarCustomLayerProps, ResponsiveBar } from "@nivo/bar";
import { type KeyboardEvent, useMemo, useState } from "react";

import { money } from "../operations/format";
import {
  useChartPalette,
  usePrefersReducedMotion,
} from "../operations/chartTheme";
import type { MetricPoint } from "./insightsModel";

const axisText = { ticks: { text: { fill: "var(--color-muted-foreground)" } } };

type Datum = { key: string; label: string; value: number; previous: number };

/**
 * The period before, as a short line across each bar at its value, instead
 * of a second bar beside it. One bar per day keeps a month readable on a
 * phone; the marker answers "more or less than last time?" at a glance.
 */
const PreviousMarkers = ({
  bars,
  yScale,
  colour,
}: BarCustomLayerProps<Datum> & { colour: string }) => (
  <g aria-hidden="true">
    {bars.map((bar) => {
      const previous = bar.data.data.previous;
      if (!previous) return null;
      const y = (yScale as unknown as (v: number) => number)(previous);
      const overhang = Math.min(4, bar.width * 0.25);
      return (
        <line
          key={bar.key}
          x1={bar.x - overhang}
          x2={bar.x + bar.width + overhang}
          y1={y}
          y2={y}
          stroke={colour}
          strokeWidth={2}
          strokeLinecap="round"
        />
      );
    })}
  </g>
);

/**
 * The chosen metric per day, week or month, one bar each, with the period
 * before marked as a line across the bar. Click a bar for the orders behind
 * it; the picked bar stays lit.
 * The bars are drawn for the eye only: the same numbers are in the table below
 * for a screen reader, and the chart can be driven with the arrow keys.
 */
export const TrendChart = ({
  points,
  isMoney,
  percent = false,
  compare = true,
  selectedKey,
  onSelect,
  clickHint = "Click to see the orders",
  label,
}: {
  points: Array<Pick<MetricPoint, "key" | "label" | "value" | "previous">>;
  isMoney: boolean;
  /** The values are percentages, such as a conversion rate. */
  percent?: boolean;
  compare?: boolean;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  /** What the tooltip says a click does. */
  clickHint?: string;
  label: string;
}) => {
  const palette = useChartPalette();
  const reducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const number = (v: number) =>
    v.toLocaleString("en-CA", { maximumFractionDigits: 1 });
  const show = (v: number) =>
    isMoney ? money(v) : percent ? `${number(v)}%` : number(v);
  // Show about eight labels along the bottom, however many bars there are
  const step = Math.max(1, Math.ceil(points.length / 8));
  const tickValues = useMemo(
    () => points.filter((_, i) => i % step === 0).map((p) => p.label),
    [points, step],
  );
  const data = useMemo<Datum[]>(
    () =>
      points.map((p) => ({
        key: p.key,
        label: p.label,
        value: p.value,
        previous: p.previous,
      })),
    [points],
  );

  if (!points.length) return null;

  const latest = points[points.length - 1];
  const focused = active != null ? (points[active] ?? null) : null;
  const summary =
    `${label}, ${points[0].label} to ${latest.label}. ` +
    `Latest ${show(latest.value)} this period against ${show(latest.previous)} the period before.`;
  const keyboardHint = onSelect
    ? " Left and right arrows pick a period, Enter opens it."
    : "";

  const pick = (index: number) => {
    const next = Math.min(points.length - 1, Math.max(0, index));
    setActive(next);
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: (active ?? -1) + 1,
      ArrowLeft: (active ?? points.length) - 1,
      Home: 0,
      End: points.length - 1,
    };
    const target = moves[event.key];
    if (target != null) {
      event.preventDefault();
      pick(target);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && focused) {
      event.preventDefault();
      onSelect?.(focused.key);
    }
  };

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {summary}
        {keyboardHint}
      </figcaption>
      <div
        className={
          onSelect
            ? "h-[280px] [&_rect]:cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            : "h-[280px]"
        }
        role={onSelect ? "group" : undefined}
        aria-label={onSelect ? `${label} by period` : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={onSelect ? onKey : undefined}
        onBlur={() => setActive(null)}
      >
        <ResponsiveBar
          data={data}
          indexBy="label"
          keys={["value"]}
          // The scale must reach the period before's peak too, or its
          // markers would be cut off above the tallest bar
          valueScale={{
            type: "linear",
            min: 0,
            max: Math.max(
              1,
              ...points.map((p) =>
                compare ? Math.max(p.value, p.previous) : p.value,
              ),
            ),
            nice: true,
          }}
          colors={(bar) =>
            bar.data.key === selectedKey ? palette.selected : palette.thisPeriod
          }
          borderRadius={2}
          margin={{ top: 10, right: 10, bottom: 30, left: 48 }}
          padding={points.length > 20 ? 0.3 : 0.45}
          layers={[
            "grid",
            "axes",
            "bars",
            ...(compare
              ? [
                  (props: BarCustomLayerProps<Datum>) => (
                    <PreviousMarkers
                      {...props}
                      colour="var(--color-muted-foreground)"
                    />
                  ),
                ]
              : []),
            "markers",
            "legends",
          ]}
          enableLabel={false}
          // The bars still settle into place for anyone who has not asked for
          // less motion; the numbers are readable either way
          animate={!reducedMotion}
          enableGridY
          enableGridX={false}
          onClick={(bar) => onSelect?.(String(bar.data.key))}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: 5,
            format: (v) =>
              isMoney && Number(v) >= 1000
                ? `${Number(v) / 1000}k`
                : percent
                  ? `${Number(v)}%`
                  : String(Number(v)),
            style: axisText,
          }}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickValues,
            style: axisText,
          }}
          theme={{
            grid: { line: { stroke: "var(--color-border)", strokeWidth: 1 } },
          }}
          tooltip={({ value, indexValue, data: datum }) => (
            <div className="px-2.5 py-1.5 bg-popover border border-border rounded-md shadow-lg text-popover-foreground text-sm">
              <strong className="block">{indexValue}</strong>
              <span className="tabular-nums">{show(Number(value))}</span>
              <span className="text-muted-foreground"> this period</span>
              {compare ? (
                <span className="block tabular-nums text-muted-foreground">
                  {show(Number(datum.previous))} the period before
                </span>
              ) : null}
              {onSelect ? (
                <span className="block text-xs text-muted-foreground">
                  {clickHint}
                </span>
              ) : null}
            </div>
          )}
        />
      </div>
      {compare ? (
        <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2 rounded-[2px]"
              style={{ background: palette.thisPeriod }}
              aria-hidden="true"
            />
            This period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: palette.compare }}
              aria-hidden="true"
            />
            Same point, period before
          </span>
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {focused
          ? `${focused.label}: ${show(focused.value)} this period, ${show(focused.previous)} the period before.`
          : ""}
      </p>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">This period</th>
            <th scope="col">Previous period</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{show(p.value)}</td>
              <td>{show(p.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};
