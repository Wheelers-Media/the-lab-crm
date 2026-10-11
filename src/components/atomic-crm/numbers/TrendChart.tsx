import { ResponsiveBar } from "@nivo/bar";
import { useMemo } from "react";

import { money } from "../operations/format";
import type { TrendPoint } from "./salesModel";

const axisText = { ticks: { text: { fill: "var(--color-muted-foreground)" } } };

/** Net sales per day, week or month, with the previous period beside each bar. */
export const TrendChart = ({ points }: { points: TrendPoint[] }) => {
  // Show about eight labels along the bottom, however many bars there are
  const step = Math.max(1, Math.ceil(points.length / 8));
  const tickValues = useMemo(
    () => points.filter((_, i) => i % step === 0).map((p) => p.label),
    [points, step],
  );
  if (!points.length) return null;
  return (
    <div
      className="h-[280px]"
      role="img"
      aria-label="Net sales over time compared with the previous period"
    >
      <ResponsiveBar
        data={points as unknown as Array<Record<string, string | number>>}
        indexBy="label"
        keys={["previousNetSales", "netSales"]}
        groupMode="grouped"
        colors={["#6b7686", "#0066FF"]}
        margin={{ top: 10, right: 10, bottom: 30, left: 48 }}
        padding={0.25}
        innerPadding={1}
        enableLabel={false}
        enableGridY
        enableGridX={false}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: 5,
          format: (v) =>
            Number(v) >= 1000 ? `${Number(v) / 1000}k` : String(v),
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
              {id === "netSales" ? "this period" : "previous"}:{" "}
            </span>
            {money(Number(value))}
          </div>
        )}
      />
    </div>
  );
};
