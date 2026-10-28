import { Layers } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { type Point, smoothBand, smoothPath } from "./chartGeometry";
import { DonutChart } from "./DonutChart";
import { money } from "./format";
import { SectionTitle } from "./OperationsWidgets";
import {
  MIX_GROUPS,
  type MixGroup,
  type MixWeek,
  mixTotals,
} from "./trendsModel";
import { useInView } from "./useInView";

/**
 * One validated colour per kind of work (see --viz-* in index.css). Distinct
 * hues rather than shades of one blue, so tint and detailing never blur.
 */
const MIX_COLOURS: Record<MixGroup, string> = {
  detail: "var(--viz-1)",
  tint: "var(--viz-2)",
  lighting: "var(--viz-3)",
  parts: "var(--viz-4)",
  other: "var(--chart-compare)",
};

/** Bottom of the stack first. */
const STACK: MixGroup[] = ["detail", "tint", "lighting", "parts", "other"];

const W = 600;
const H = 180;
const TOP_PAD = 8;

const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : money(n);

/**
 * Sales by kind of work over the last finished weeks, as smooth stacked
 * bands: how big each week was, and how its mix shifts. The week in
 * progress is left off the curve (half a week would read as a slump) and
 * given in figures above. The donut under it adds up the whole stretch.
 */
export const RevenueMixCard = ({
  weeks,
  isPending,
}: {
  weeks: MixWeek[];
  isPending: boolean;
}) => {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const [active, setActive] = useState<number | null>(null);
  const done = useMemo(() => weeks.filter((w) => !w.partial), [weeks]);
  const thisWeek = weeks.find((w) => w.partial) ?? null;
  const totals = useMemo(() => mixTotals(weeks), [weeks]);
  const total = totals.reduce((s, g) => s + g.amount, 0);
  const recent = done.slice(-4);
  const fourWeekAverage = recent.length
    ? recent.reduce((s, w) => s + w.total, 0) / recent.length
    : 0;
  const top = Math.max(1, ...done.map((w) => w.total));

  const x = (i: number) =>
    done.length < 2 ? W / 2 : (i / (done.length - 1)) * W;
  const y = (v: number) => H - (v / top) * (H - TOP_PAD);

  // Each layer's upper edge is the running sum of the layers under it
  const bands = useMemo(() => {
    const running = done.map(() => 0);
    return STACK.map((group) => {
      const lower: Point[] = done.map((_, i) => [x(i), y(running[i])]);
      done.forEach((w, i) => {
        running[i] += w.groups[group];
      });
      const upper: Point[] = done.map((_, i) => [x(i), y(running[i])]);
      return { group, path: smoothBand(upper, lower), edge: smoothPath(upper) };
    }).filter((band) => done.some((w) => w.groups[band.group] > 0));
    // x and y only change with `done`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, top]);

  const shown =
    active != null ? done[active] : (thisWeek ?? done[done.length - 1]);

  const fromPointer = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const fraction = rect.width ? (clientX - rect.left) / rect.width : 0;
    setActive(
      Math.min(
        done.length - 1,
        Math.max(0, Math.round(fraction * (done.length - 1))),
      ),
    );
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: (active ?? -1) + 1,
      ArrowLeft: (active ?? done.length) - 1,
      Home: 0,
      End: done.length - 1,
    };
    const target = moves[event.key];
    if (target == null) return;
    event.preventDefault();
    setActive(Math.min(done.length - 1, Math.max(0, target)));
  };

  return (
    <Card className="p-4 gap-3 h-full">
      <SectionTitle
        icon={Layers}
        hint="Sales by kind of work, last 12 weeks. Deposits are counted on the final invoice."
      >
        Where the money comes from
      </SectionTitle>

      {isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : !total || done.length < 2 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Not enough sales yet. Shopify orders fill this in as they come.
        </p>
      ) : (
        <div ref={ref} className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="lab-eyebrow">12 weeks</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {money(total)}
              </dd>
            </div>
            <div>
              <dt className="lab-eyebrow">Weekly average</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {money(fourWeekAverage)}
              </dd>
              <dd className="text-xs text-muted-foreground">Last 4 weeks</dd>
            </div>
            <div className="col-span-2 sm:col-span-1" aria-live="polite">
              <dt className="lab-eyebrow">
                Week of {shown.label}
                {shown.partial ? " (so far)" : ""}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {money(shown.total)}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">
                {MIX_GROUPS.filter((g) => shown.groups[g.key] > 0)
                  .map((g) => `${g.label} ${compact(shown.groups[g.key])}`)
                  .join(" · ") || "No sales"}
              </dd>
            </div>
          </dl>

          <div
            className="relative mt-1 h-44 touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="img"
            aria-label={`Weekly sales by kind of work, ${done[0].label} to ${done[done.length - 1].label}. Use the arrow keys to read each week.`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={(e) => fromPointer(e.clientX, e.currentTarget)}
            onPointerDown={(e) => fromPointer(e.clientX, e.currentTarget)}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((g) => (
                <span key={g} className="h-px w-full bg-border/60" />
              ))}
            </div>
            <span className="pointer-events-none absolute -top-0.5 right-0 z-[1] bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
              {compact(top)}
            </span>
            {/* The bands sweep in from the left the first time they scroll into view */}
            <div
              className="absolute inset-0 transition-[clip-path] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{
                clipPath: inView ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-full w-full"
                aria-hidden="true"
              >
                {bands.map((band) => (
                  <path
                    key={band.group}
                    d={band.path}
                    fill={MIX_COLOURS[band.group]}
                    fillOpacity={0.88}
                  />
                ))}
                {/* A surface-coloured seam between layers, instead of an outline */}
                {bands.map((band) => (
                  <path
                    key={`${band.group}-edge`}
                    d={band.edge}
                    fill="none"
                    stroke="var(--card)"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </div>
            {active != null ? (
              <span
                className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/70"
                style={{ left: `${(x(active) / W) * 100}%` }}
                aria-hidden="true"
              />
            ) : null}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {done.map((week, i) => (
              <span
                key={week.key}
                className={cn(
                  "whitespace-nowrap",
                  i % 3 !== 0 && i !== done.length - 1 && "invisible",
                )}
              >
                {week.label}
              </span>
            ))}
          </div>

          <DonutChart
            className="mt-2"
            centreLabel="12 weeks"
            format={money}
            slices={totals.map((g) => ({
              key: g.key,
              label: g.label,
              value: g.amount,
              colour: MIX_COLOURS[g.key],
            }))}
          />
        </div>
      )}
    </Card>
  );
};
