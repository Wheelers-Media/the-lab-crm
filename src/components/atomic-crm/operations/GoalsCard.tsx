import { Pencil, Target } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import {
  type MonthlyTargets,
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import { money } from "./format";
import type { GoalKey, GoalProgress } from "./goalsModel";
import { useInView } from "./useInView";

const GOALS: Array<{
  key: GoalKey;
  label: string;
  colour: string;
  isMoney: boolean;
}> = [
  { key: "revenue", label: "Revenue", colour: "var(--viz-1)", isMoney: true },
  {
    key: "orders",
    label: "Sales orders",
    colour: "var(--viz-2)",
    isMoney: false,
  },
  {
    key: "newCustomers",
    label: "New customers",
    colour: "var(--viz-4)",
    isMoney: false,
  },
];

const show = (n: number, isMoney: boolean) =>
  isMoney ? money(n) : Math.round(n).toLocaleString("en-CA");

const compact = (n: number, isMoney: boolean) =>
  isMoney && n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
    : show(n, isMoney);

const statusText = (goal: GoalProgress, isMoney: boolean): string => {
  if (goal.status === "done") return "Goal met";
  if (goal.status === "on-pace") return "On pace";
  const gap = compact(Math.abs(goal.vsPace), isMoney);
  return goal.status === "ahead"
    ? `${gap} ahead of pace`
    : `${gap} behind pace`;
};

const SIZE = 120;
const STROKE = 11;
const GAP = 3;

/**
 * Three goals as nested rings, like Activity on an iPhone: revenue on the
 * outside, sales orders, then new customers. A full ring is the goal for the
 * period; the small notch on each track is where the shop should be by now
 * to land on it.
 */
const Rings = ({
  goals,
  elapsed,
}: {
  goals: GoalProgress[];
  elapsed: number;
}) => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <div
      ref={ref}
      className="relative aspect-square w-full max-w-[9.5rem] shrink-0"
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
        {goals.map((goal, i) => {
          const r = SIZE / 2 - STROKE / 2 - i * (STROKE + GAP);
          const c = 2 * Math.PI * r;
          const filled = Math.min(1, goal.progress) * c;
          const colour = GOALS.find((g) => g.key === goal.key)!.colour;
          const notch = elapsed * 2 * Math.PI;
          return (
            <g key={goal.key}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                fill="none"
                stroke={colour}
                strokeOpacity={0.18}
                strokeWidth={STROKE}
              />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                fill="none"
                stroke={colour}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${inView ? filled : 0} ${c}`}
                className="transition-[stroke-dasharray] duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                style={{ transitionDelay: `${i * 140}ms` }}
              />
              {elapsed > 0 && elapsed < 1 ? (
                <circle
                  cx={SIZE / 2 + r * Math.cos(notch)}
                  cy={SIZE / 2 + r * Math.sin(notch)}
                  r={1.8}
                  fill="var(--foreground)"
                  opacity={0.85}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * The period's goals: how far along each one is, and whether the shop is on
 * pace to hit it. Unset goals start at a suggestion (last month plus ten
 * percent) until Eric sets his own.
 */
export const GoalsCard = ({
  goals,
  elapsed,
  periodLabel,
  isPending,
  monthly,
}: {
  goals: GoalProgress[];
  /** The monthly goal behind each ring, saved or suggested. */
  monthly: Record<GoalKey, number>;
  /** How far through the period we are, 0 to 1. */
  elapsed: number;
  /** "this month" */
  periodLabel: string;
  isPending: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const anySuggested = goals.some((g) => g.suggested);
  return (
    <Card className="p-4 gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Target
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Goals</h2>
            <p className="text-xs text-muted-foreground">
              {Math.round(elapsed * 100)}% through {periodLabel}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          className="-mr-2"
        >
          <Pencil className="size-4" aria-hidden />
          {anySuggested ? "Set goals" : "Edit"}
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-36 w-full" />
      ) : (
        <div className="flex items-center gap-4">
          <Rings goals={goals} elapsed={elapsed} />
          <ul className="flex min-w-0 flex-1 flex-col gap-3">
            {goals.map((goal) => {
              const meta = GOALS.find((g) => g.key === goal.key)!;
              return (
                <li key={goal.key} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: meta.colour }}
                      aria-hidden
                    />
                    {meta.label}
                  </p>
                  <p className="truncate text-base font-semibold leading-tight">
                    {compact(goal.current, meta.isMoney)}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      / {compact(goal.target, meta.isMoney)}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs",
                      goal.status === "behind"
                        ? "text-[var(--lab-neg)]"
                        : goal.status === "on-pace"
                          ? "text-muted-foreground"
                          : "text-[var(--lab-pos)]",
                    )}
                  >
                    {statusText(goal, meta.isMoney)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {anySuggested && !isPending ? (
        <p className="text-xs text-muted-foreground">
          Suggested from last month plus 10%. Tap Set goals to choose your own.
        </p>
      ) : null}
      {editing ? (
        <GoalsSheet
          open={editing}
          onOpenChange={setEditing}
          monthly={monthly}
        />
      ) : null}
    </Card>
  );
};

/** Set the monthly goals; week and day goals are worked out from them. */
const GoalsSheet = ({
  open,
  onOpenChange,
  monthly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthly: Record<GoalKey, number>;
}) => {
  const config = useConfigurationContext();
  const setConfig = useConfigurationUpdater();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<GoalKey, string>>({
    revenue: String(config.targets?.revenue ?? ""),
    orders: String(config.targets?.orders ?? ""),
    newCustomers: String(config.targets?.newCustomers ?? ""),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const targets: MonthlyTargets = {};
    for (const { key } of GOALS) {
      const n = Number(values[key].replace(/[^\d.]/g, ""));
      if (n > 0) targets[key] = Math.round(n);
    }
    setSaving(true);
    try {
      const saved = await dataProvider.updateConfiguration({
        ...config,
        targets,
      });
      setConfig({ ...config, ...saved, targets });
      notify("Goals saved");
      onOpenChange(false);
    } catch {
      notify("Could not save the goals. Try again.", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle>Monthly goals</SheetTitle>
            <SheetDescription>
              Week and day goals are worked out from these. Leave one empty to
              keep the suggestion.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            {GOALS.map((goal) => (
              <div key={goal.key} className="flex flex-col gap-2">
                <Label htmlFor={`goal-${goal.key}`}>
                  {goal.label} per month
                </Label>
                <Input
                  id={`goal-${goal.key}`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={`Suggested ${show(monthly[goal.key], goal.isMoney)}`}
                  value={values[goal.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [goal.key]: e.target.value }))
                  }
                  className="h-11 text-base"
                />
              </div>
            ))}
          </div>
          <SheetFooter className="flex-row justify-end gap-2 px-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save goals
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
