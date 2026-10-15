import { ResponsiveBar } from "@nivo/bar";
import { useMemo } from "react";

import { money } from "../operations/format";
import type { MetricPoint } from "./insightsModel";

const axisText = { ticks: { text: { fill: "var(--color-muted-foreground)" } } };

/**
 * The chosen metric per day, week or month, with the previous period beside
 * each bar. Click a bar for the orders behind it; the picked bar stays lit.
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
  const data = useMemo(
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
  return (
    <div
      className={onSelect ? "h-[280px] [&_rect]:cursor-pointer" : "h-[280px]"}
      role="img"
      aria-label={`${label} over time compared with the previous period`}
    >
      <ResponsiveBar
        data={data}
        indexBy="label"
        keys={compare ? ["previous", "value"] : ["value"]}
        groupMode="grouped"
        colors={(bar) =>
          bar.id === "previous"
            ? "#6b7686"
            : bar.data.key === selectedKey
              ? "#5c9dff"
              : "#0066FF"
        }
        margin={{ top: 10, right: 10, bottom: 30, left: 48 }}
        padding={0.25}
        innerPadding={1}
        enableLabel={false}
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
        tooltip={({ id, value, indexValue }) => (
          <div className="px-2 py-1 bg-secondary rounded shadow text-secondary-foreground text-sm">
            <strong>{indexValue}</strong>
            <span className="text-muted-foreground">
              {" "}
              {id === "value" ? "this period" : "previous"}:{" "}
            </span>
            {show(Number(value))}
            {onSelect && id === "value" ? (
              <span className="block text-xs text-muted-foreground">
                {clickHint}
              </span>
            ) : null}
          </div>
        )}
      />
    </div>
  );
};
