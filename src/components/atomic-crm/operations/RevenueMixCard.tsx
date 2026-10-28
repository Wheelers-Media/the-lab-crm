import { Layers } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { money } from "./format";
import { SectionTitle } from "./OperationsWidgets";
import {
  MIX_GROUPS,
  type MixGroup,
  type MixWeek,
  mixTotals,
} from "./trendsModel";

/**
 * One colour per kind of work, following the shop's "two bays": blues for the
 * Boutique (detailing, tint, lighting), amber for the Parts Store. The tokens
 * swap to darker values in the light scheme.
 */
const MIX_COLOURS: Record<MixGroup, string> = {
  detail: "var(--lab-blue)",
  tint: "var(--chart-selected)",
  lighting: "var(--chart-pending)",
  parts: "var(--lab-amber)",
  other: "var(--chart-compare)",
};

const BAR_ORDER: MixGroup[] = ["parts", "lighting", "tint", "detail", "other"];

const compact = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : money(n);

/**
 * Sales by kind of work over twelve weeks. The stack shows where the money
 * comes from and whether the mix is shifting; the list under it gives each
 * kind's dollars and share, so nothing has to be read off a bar's height.
 */
export const RevenueMixCard = ({
  weeks,
  isPending,
}: {
  weeks: MixWeek[];
  isPending: boolean;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const totals = useMemo(() => mixTotals(weeks), [weeks]);
  const total = totals.reduce((s, g) => s + g.amount, 0);
  const done = weeks.filter((w) => !w.partial);
  const recent = done.slice(-4);
  const fourWeekAverage = recent.length
    ? recent.reduce((s, w) => s + w.total, 0) / recent.length
    : 0;
  const top = Math.max(1, ...weeks.map((w) => w.total));
  const shown = active != null ? weeks[active] : weeks[weeks.length - 1];

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: (active ?? -1) + 1,
      ArrowLeft: (active ?? weeks.length) - 1,
      Home: 0,
      End: weeks.length - 1,
    };
    const target = moves[event.key];
    if (target == null) return;
    event.preventDefault();
    setActive(Math.min(weeks.length - 1, Math.max(0, target)));
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
      ) : !total ? (
        <p className="py-6 text-sm text-muted-foreground">
          No sales in the last 12 weeks yet. Shopify orders fill this in as they
          come.
        </p>
      ) : (
        <>
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
            className="relative mt-1 h-40 touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="img"
            aria-label="Weekly sales stacked by kind of work. Use the arrow keys to read each week."
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2, 3].map((g) => (
                <span key={g} className="h-px w-full bg-border/60" />
              ))}
            </div>
            <span className="pointer-events-none absolute -top-0.5 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted-foreground">
              {compact(top)}
            </span>
            {fourWeekAverage > 0 ? (
              <span
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40"
                style={{ bottom: `${(fourWeekAverage / top) * 100}%` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
              {weeks.map((week, i) => (
                <div
                  key={week.key}
                  aria-hidden="true"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  className={cn(
                    "group relative flex h-full min-w-0 flex-1 flex-col justify-end",
                    active != null && active !== i && "opacity-45",
                    "transition-opacity duration-200",
                  )}
                >
                  <span
                    className="block w-full lab-bar-rise"
                    style={{
                      height: `${(week.total / top) * 100}%`,
                      animationDelay: `${i * 30}ms`,
                    }}
                  >
                    <span
                      className={cn(
                        "flex h-full w-full flex-col-reverse overflow-hidden rounded-t-[3px]",
                        week.partial && "opacity-55",
                      )}
                    >
                      {BAR_ORDER.map((group) =>
                        week.groups[group] > 0 ? (
                          <span
                            key={group}
                            className="block w-full border-t border-card/70 last:border-t-0"
                            style={{
                              height: `${(week.groups[group] / week.total) * 100}%`,
                              background: MIX_COLOURS[group],
                            }}
                          />
                        ) : null,
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 text-[10px] text-muted-foreground sm:gap-2">
            {weeks.map((week, i) => (
              <span
                key={week.key}
                className="min-w-0 flex-1 whitespace-nowrap text-center"
              >
                {i % 3 === 0 || i === weeks.length - 1
                  ? week.partial
                    ? "Now"
                    : week.label
                  : ""}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            <span
              className="mr-1.5 inline-block w-4 border-t border-dashed border-foreground/60 align-middle"
              aria-hidden="true"
            />
            4-week average
          </p>

          <ul className="mt-1 flex flex-col gap-2">
            {totals.map((g) => (
              <li
                key={g.key}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-sm"
              >
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ background: MIX_COLOURS[g.key] }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{g.label}</span>
                <span className="tabular-nums">
                  {money(g.amount)}
                  <span className="ml-2 inline-block w-9 text-right text-muted-foreground">
                    {g.share}%
                  </span>
                </span>
                <span
                  className="col-start-2 col-span-2 h-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${g.share}%`,
                      background: MIX_COLOURS[g.key],
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
};
