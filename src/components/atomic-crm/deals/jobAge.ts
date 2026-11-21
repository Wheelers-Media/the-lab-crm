// How long a job has sat in its stage, and whether that is fine, getting old
// or overdue. Plain records in, plain values out, so the limits can be read
// (and tested) without a database.
import { SHOP_TIME_ZONE } from "../operations/shopTime";
import type { Deal } from "../types";
import { isClosedStage } from "./pipelineView";

const DAY_MS = 86_400_000;

export type AgeTone = "fresh" | "aging" | "stale";

/**
 * Days in a stage before a job turns amber (`aging`) and red (`stale`).
 * Quoted matches the 3-day follow-up rule in contacts/nextSaleModel.ts.
 * Stages not listed here (Booked, and any added later) show their age with
 * no colour: a booked job waits on its appointment, not on us.
 */
export const STAGE_AGE_LIMITS: Record<
  string,
  { aging: number; stale: number }
> = {
  intake: { aging: 1, stale: 3 },
  qualified: { aging: 2, stale: 5 },
  quoted: { aging: 3, stale: 7 },
  parts_on_the_way: { aging: 7, stale: 14 },
  ready_to_book: { aging: 2, stale: 5 },
};

export interface JobAge {
  /** Whole days since the job entered its stage. */
  days: number;
  /** Null when the stage has no limits. */
  tone: AgeTone | null;
  /** When the job entered its stage (ISO). */
  since: string;
}

/** When the job entered its current stage: the stage change, else creation. */
export const stageEnteredAt = (
  deal: Pick<Deal, "stage_changed_at" | "created_at">,
): string => deal.stage_changed_at ?? deal.created_at;

export const toneFor = (stage: string, days: number): AgeTone | null => {
  const limits = STAGE_AGE_LIMITS[stage];
  if (!limits) return null;
  if (days >= limits.stale) return "stale";
  if (days >= limits.aging) return "aging";
  return "fresh";
};

/** The job's age in its stage, or null for closed jobs (Converted, Not now). */
export const jobAge = (
  deal: Pick<Deal, "stage" | "stage_changed_at" | "created_at">,
  now: Date = new Date(),
): JobAge | null => {
  if (isClosedStage(deal.stage)) return null;
  const since = stageEnteredAt(deal);
  const elapsed = now.getTime() - new Date(since).getTime();
  if (Number.isNaN(elapsed)) return null;
  const days = Math.max(0, Math.floor(elapsed / DAY_MS));
  return { days, tone: toneFor(deal.stage, days), since };
};

/** "Today", "1 day", "9 days". */
export const ageLabel = (days: number): string =>
  days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`;

/** "Today", "1d", "9d": short enough for a card corner. */
export const ageShort = (days: number): string =>
  days === 0 ? "Today" : `${days}d`;

/** The chip class for a tone (see .lab-chip-* in src/index.css). */
export const TONE_CHIP: Record<AgeTone | "none", string> = {
  fresh: "lab-chip-bay",
  aging: "lab-chip-warn",
  stale: "lab-chip-danger",
  none: "lab-chip-muted",
};

export interface ColumnAge {
  /** Days the oldest open job has sat here; null when the column is empty or closed. */
  oldestDays: number | null;
  aging: number;
  stale: number;
}

/** The numbers under a column's heading: oldest job and how many are late. */
export const columnAge = (
  deals: Array<Pick<Deal, "stage" | "stage_changed_at" | "created_at">>,
  now: Date = new Date(),
): ColumnAge =>
  deals.reduce<ColumnAge>(
    (acc, deal) => {
      const age = jobAge(deal, now);
      if (!age) return acc;
      return {
        oldestDays: Math.max(acc.oldestDays ?? 0, age.days),
        aging: acc.aging + (age.tone === "aging" ? 1 : 0),
        stale: acc.stale + (age.tone === "stale" ? 1 : 0),
      };
    },
    { oldestDays: null, aging: 0, stale: 0 },
  );

/** "Nov 17". */
export const shortDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: SHOP_TIME_ZONE,
  });
