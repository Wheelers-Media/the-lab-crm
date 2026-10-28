import { type KeyboardEvent, useId, useState } from "react";

import { smoothPath } from "./chartGeometry";
import { money } from "./format";
import type { RevenueLinePoint } from "./metrics";

/**
 * Running revenue as a line, with the same stretch of the period before as a
 * dashed line behind it. A cumulative line starts at zero and only ever climbs,
 * so the two curves answer one question — ahead or behind, and by how much —
 * that bars per day cannot answer without mental arithmetic.
 */
export const RevenueChart = ({
  points,
  thisPeriod,
  lastPeriod,
}: {
  points: RevenueLinePoint[];
  /** "This month" — the solid line and the legend's first entry. */
  thisPeriod: string;
  /** "Last month" — the dashed line. */
  lastPeriod: string;
}) => {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return null;

  const last = points[points.length - 1];
  const top = Math.max(1, ...points.map((p) => Math.max(p.value, p.previous)));

  // One point has no run between two ends, so park it mid-chart
  const x = (i: number) =>
    points.length === 1 ? 50 : (i / (points.length - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  // Smooth but never overshooting, so a running total never seems to dip
  const line = (get: (p: RevenueLinePoint) => number) =>
    smoothPath(points.map((p, i) => [x(i), y(get(p))] as const));
  const area = `${line((p) => p.value)} L100,100 L0,100 Z`;

  const shown = (active != null ? points[active] : null) ?? last;
  const focused = active != null ? points[active] : null;
  // Round to the nearest point, so a tap on a phone reads like a hover
  const fromPointer = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const fraction = rect.width ? (clientX - rect.left) / rect.width : 0;
    setActive(
      Math.min(
        points.length - 1,
        Math.max(0, Math.round(fraction * (points.length - 1))),
      ),
    );
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: (active ?? -1) + 1,
      ArrowLeft: (active ?? points.length) - 1,
      Home: 0,
      End: points.length - 1,
    };
    const target = moves[event.key];
    if (target == null) return;
    event.preventDefault();
    setActive(Math.min(points.length - 1, Math.max(0, target)));
  };

  // About six labels along the bottom, however many steps there are
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  const gap = last.value - last.previous;
  const summary =
    `${thisPeriod}: ${money(last.value)} from ${points.length} ` +
    `${points.length === 1 ? "step" : "steps"}, against ${money(last.previous)} ` +
    `${lastPeriod.toLowerCase()} at the same point. ` +
    (last.previous === 0
      ? "Nothing to compare with yet."
      : gap === 0
        ? "Level with that point."
        : `${money(Math.abs(gap))} ${gap > 0 ? "ahead of" : "behind"} ${lastPeriod.toLowerCase()}.`);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{summary}</figcaption>

      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-[2px] w-4 rounded-full bg-[var(--lab-blue)]"
            aria-hidden="true"
          />
          {thisPeriod}
          <span className="lab-num text-foreground">{money(last.value)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-4 border-t-2 border-dashed border-muted-foreground"
            aria-hidden="true"
          />
          {lastPeriod}
          <span className="lab-num text-foreground/70">
            {money(last.previous)}
          </span>
        </span>
      </div>

      {/* The figures for the point under the finger; quiet until touched,
          since the legend above already gives the totals */}
      <p
        className="mb-1 min-h-5 text-xs tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {focused ? (
          <>
            <span className="text-foreground">{shown.label}</span>
            {" · "}
            {money(shown.value)}
            <span className="text-muted-foreground"> this period, </span>
            {money(shown.previous)}
            <span className="text-muted-foreground">
              {" "}
              {lastPeriod.toLowerCase()}
            </span>
          </>
        ) : (
          <span className="sm:hidden">Touch the chart to read a day.</span>
        )}
      </p>

      <div
        className="relative h-28 touch-pan-y rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        role="img"
        aria-label={`${thisPeriod} against ${lastPeriod}, step by step. Use the arrow keys to read each point.`}
        tabIndex={0}
        onPointerMove={(event) =>
          fromPointer(event.clientX, event.currentTarget)
        }
        onPointerDown={(event) =>
          fromPointer(event.clientX, event.currentTarget)
        }
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {/* Faint gridlines give the line a scale without an axis */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2].map((gridline) => (
            <span key={gridline} className="h-px w-full bg-border/70" />
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--lab-blue)"
                stopOpacity="0.32"
              />
              <stop
                offset="100%"
                stopColor="var(--lab-blue)"
                stopOpacity="0.02"
              />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} className="lab-fade" />
          <path
            d={line((p) => p.previous)}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={line((p) => p.value)}
            fill="none"
            stroke="var(--lab-blue)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            vectorEffect="non-scaling-stroke"
            className="lab-draw"
          />
        </svg>
        {focused ? (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-muted-foreground/40"
              style={{ left: `${x(active ?? 0)}%` }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-compare)] ring-2 ring-card"
              style={{
                left: `${x(active ?? 0)}%`,
                top: `${y(focused.previous)}%`,
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-this)] ring-2 ring-card"
              style={{
                left: `${x(active ?? 0)}%`,
                top: `${y(focused.value)}%`,
              }}
              aria-hidden="true"
            />
          </>
        ) : (
          <span
            className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-this)] ring-2 ring-card"
            style={{
              left: `${x(points.length - 1)}%`,
              top: `${y(last.value)}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-1 flex text-xs text-muted-foreground">
        {points.map((p, i) => (
          <span key={p.key} className="flex-1 text-center">
            {(i % labelStep === 0 &&
              // keep clear of the last label so the two never collide
              points.length - 1 - i >= labelStep / 2) ||
            i === points.length - 1
              ? p.label
              : ""}
          </span>
        ))}
      </div>
    </figure>
  );
};
