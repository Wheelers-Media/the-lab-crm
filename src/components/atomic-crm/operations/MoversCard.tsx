import { ArrowDown, ArrowUp, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { money } from "./format";
import { SectionTitle } from "./OperationsWidgets";
import type { Mover } from "./trendsModel";

/**
 * The services and products selling more or less than in the period before,
 * by dollars. Each row shows both periods as two bars on one scale, so a
 * jump from $70 to $140 cannot look like a jump from $600 to $2,600.
 */
export const MoversCard = ({
  movers,
  isPending,
  thisPeriod,
  comparedWith,
}: {
  movers: Mover[];
  isPending: boolean;
  /** "this month" */
  thisPeriod: string;
  /** "last month" */
  comparedWith: string;
}) => {
  const top = Math.max(1, ...movers.flatMap((m) => [m.revenue, m.previous]));
  return (
    <Card className="p-4 gap-3 h-full">
      <SectionTitle
        icon={Flame}
        hint={`Sales ${thisPeriod} against ${comparedWith} at the same point, biggest change first.`}
      >
        What's moving
      </SectionTitle>
      {isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !movers.length ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nothing has changed much yet. Check back once a few more orders are
          in.
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {movers.map((m) => {
              const gain = m.revenue - m.previous;
              const up = gain > 0;
              return (
                <li key={m.name} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {m.name}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums",
                        up ? "text-[var(--lab-pos)]" : "text-[var(--lab-neg)]",
                      )}
                    >
                      {up ? (
                        <ArrowUp className="size-3" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="size-3" aria-hidden="true" />
                      )}
                      {money(Math.abs(gain))}
                      {m.change != null ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({up ? "+" : ""}
                          {m.change}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground"> (new)</span>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-this)]"
                        style={{ width: `${(m.revenue / top) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-foreground">
                      {money(m.revenue)}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-[var(--chart-compare)]"
                        style={{ width: `${(m.previous / top) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 text-right">{money(m.previous)}</span>
                  </div>
                  <span className="sr-only">
                    {money(m.revenue)} {thisPeriod}, {money(m.previous)}{" "}
                    {comparedWith}.
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-4 rounded-full bg-[var(--chart-this)]"
                aria-hidden="true"
              />
              {thisPeriod.charAt(0).toUpperCase() + thisPeriod.slice(1)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-4 rounded-full bg-[var(--chart-compare)]"
                aria-hidden="true"
              />
              {comparedWith.charAt(0).toUpperCase() + comparedWith.slice(1)}
            </span>
          </p>
        </>
      )}
    </Card>
  );
};
