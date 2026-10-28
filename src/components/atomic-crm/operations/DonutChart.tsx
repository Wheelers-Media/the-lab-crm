import { useState } from "react";
import { cn } from "@/lib/utils";

import { useInView } from "./useInView";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  /** A categorical colour token, e.g. "var(--viz-1)". */
  colour: string;
}

const SIZE = 100;
const RADIUS = 40;
const RING = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface-coloured gap between slices, in viewBox units (about 2px). */
const GAP = 1.2;

/**
 * Part of a whole, as a ring: each slice sweeps in when the chart scrolls
 * into view. Tap or hover a slice (or its legend row) to read it in the
 * middle; the legend always shows every value, so nothing hides behind the
 * hover. Best for six slices or fewer; fold the rest into "Other" first.
 */
export const DonutChart = ({
  slices,
  format,
  centreLabel,
  onSelect,
  selectedKey,
  className,
}: {
  slices: DonutSlice[];
  format: (value: number) => string;
  /** What the total in the middle is: "net sales", "sessions". */
  centreLabel: string;
  /** Makes each slice and legend row a button. */
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  className?: string;
}) => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [active, setActive] = useState<string | null>(null);
  const shown = slices.filter((s) => s.value > 0);
  const total = shown.reduce((sum, s) => sum + s.value, 0);
  if (!total) {
    return (
      <p className="py-4 text-sm text-muted-foreground">Nothing to show yet.</p>
    );
  }

  const percent = (v: number) => Math.round((v / total) * 100);
  const focus = active ?? selectedKey ?? null;
  const focused = shown.find((s) => s.key === focus) ?? null;

  let start = 0;
  const arcs = shown.map((slice, i) => {
    const length = (slice.value / total) * CIRCUMFERENCE;
    const arc = {
      ...slice,
      offset: start,
      // A sliver keeps at least a hairline so it can still be seen and tapped
      length: Math.max(0.6, length - (shown.length > 1 ? GAP : 0)),
      index: i,
    };
    start += length;
    return arc;
  });

  const summary = shown
    .map((s) => `${s.label} ${format(s.value)} (${percent(s.value)}%)`)
    .join(", ");

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]",
        className,
      )}
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[11rem]"
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`${format(total)} ${centreLabel}: ${summary}`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={RING}
          />
          {arcs.map((arc) => {
            const dim = focus != null && focus !== arc.key;
            return (
              <circle
                key={arc.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.colour}
                strokeWidth={focus === arc.key ? RING + 3 : RING}
                strokeDasharray={`${inView ? arc.length : 0} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arc.offset}
                className={cn(
                  "transition-[stroke-dasharray,stroke-width,opacity] motion-reduce:transition-none",
                  onSelect && "cursor-pointer",
                )}
                style={{
                  opacity: dim ? 0.35 : 1,
                  transitionDuration: "900ms, 200ms, 200ms",
                  transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  transitionDelay: `${arc.index * 90}ms, 0ms, 0ms`,
                }}
                onPointerEnter={() => setActive(arc.key)}
                onPointerDown={() => setActive(arc.key)}
                onClick={onSelect ? () => onSelect(arc.key) : undefined}
              />
            );
          })}
        </svg>
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center text-center"
          aria-live="polite"
        >
          <div className="max-w-[70%]">
            <p className="truncate text-[11px] text-muted-foreground">
              {focused ? focused.label : centreLabel}
            </p>
            <p className="text-lg font-semibold leading-tight">
              {format(focused ? focused.value : total)}
            </p>
            {focused ? (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {percent(focused.value)}% of {format(total)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ul className="flex min-w-0 flex-col">
        {shown.map((slice) => {
          const row = (
            <>
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.colour }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {slice.label}
              </span>
              <span className="tabular-nums">{format(slice.value)}</span>
              <span className="w-10 text-right tabular-nums text-muted-foreground">
                {percent(slice.value)}%
              </span>
            </>
          );
          const rowClass = cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
            focus === slice.key && "bg-muted",
          );
          return (
            <li
              key={slice.key}
              onPointerEnter={() => setActive(slice.key)}
              onPointerLeave={() => setActive(null)}
            >
              {onSelect ? (
                <button
                  type="button"
                  className={cn(rowClass, "hover:bg-muted")}
                  aria-pressed={selectedKey === slice.key}
                  onClick={() => onSelect(slice.key)}
                  onFocus={() => setActive(slice.key)}
                  onBlur={() => setActive(null)}
                >
                  {row}
                </button>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
