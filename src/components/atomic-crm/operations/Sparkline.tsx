import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** The figure over time, oldest first. */
  values: number[];
  /** The same stretch before, drawn as a faint dashed line to compare against. */
  compare?: number[];
  /** Total points the axis spans; more than `values` when the period is part way through. */
  slots?: number;
  /** A pace line: a figure to reach (drawn straight from nothing) or the exact points it should follow. */
  pace?: number | number[];
  /** What the graphic says, for screen readers. */
  label: string;
  className?: string;
  /** Colour of the line; defaults to the shop's blue. */
  colour?: string;
}

const W = 100;
const H = 32;
const PAD = 2;

/**
 * A tiny trend graphic for tiles: the line, a soft fill under it, a dot on the
 * latest point, optionally the period before as a dashed line and a pace line
 * to a goal. Drawn flat in SVG, no library, so a screen of tiles stays light.
 */
export const Sparkline = ({
  values,
  compare,
  slots,
  pace,
  label,
  className,
  colour = "var(--lab-blue-text)",
}: SparklineProps) => {
  const id = useId();
  const span = Math.max(slots ?? values.length, 2);
  const paceList = pace == null ? null : Array.isArray(pace) ? pace : [0, pace];
  const all = [...values, ...(compare ?? []), ...(paceList ?? [])];
  const max = Math.max(...all, 0);
  const min = paceList ? 0 : Math.min(...all, max);
  const range = max - min || 1;
  const x = (i: number) => PAD + (i / (span - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const line = (list: number[]) =>
    list
      .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
  if (!values.length) return null;
  const last = values.length - 1;
  const area = `${line(values)} L${x(last).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("h-8 w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.35" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      {paceList ? (
        <path
          d={
            Array.isArray(pace)
              ? line(pace)
              : `M${x(0)} ${y(0)} L${x(span - 1)} ${y(pace as number)}`
          }
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="2 2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {compare && compare.length > 1 ? (
        <path
          d={line(compare)}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {values.length > 1 ? <path d={area} fill={`url(#${id})`} /> : null}
      <path
        d={line(values)}
        fill="none"
        stroke={colour}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={x(last)}
        cy={y(values[last])}
        r="2.2"
        fill={colour}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

/** "from 12 to 20" for a graphic's label. */
export const sparkLabel = (name: string, values: number[]): string =>
  values.length > 1
    ? `${name}: from ${values[0]} to ${values[values.length - 1]} over ${values.length} points`
    : `${name}: ${values[0] ?? 0}`;
