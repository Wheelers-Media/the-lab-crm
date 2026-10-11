// Lead funnel: where requests come from and how far they get, from the jobs
// created in the period and the log of their stage changes.
import type { Identifier } from "ra-core";

import { type DateRange, inRange } from "../operations/shopTime";
import type { Deal } from "../types";

/** The path a job takes; "lost" (Not now) is a side exit, not a step. */
export const FUNNEL_STAGES = [
  "intake",
  "qualified",
  "quoted",
  "booked",
  "won",
] as const;

export interface StageChange {
  deal_id: Identifier;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const stageIndex = (stage: string): number =>
  (FUNNEL_STAGES as readonly string[]).indexOf(stage);

/**
 * How far along the path the job ever got. A job that went straight from a
 * booking to Booked skipped Quoted, but is still past it. Jobs with no logged
 * changes (older than the log) are placed by where they are now.
 */
export const furthestStage = (deal: Deal, changes: StageChange[]): number => {
  let furthest = stageIndex(deal.stage);
  for (const c of changes) {
    if (c.deal_id === deal.id)
      furthest = Math.max(furthest, stageIndex(c.to_stage));
  }
  return Math.max(furthest, 0);
};

export interface SourceRow {
  source: string;
  leads: number;
  quoted: number;
  booked: number;
  converted: number;
  lost: number;
  /** Converted as a whole percent of leads. */
  conversion: number | null;
  /** Amount on the converted jobs. */
  value: number;
}

const SOURCE_NAMES: Record<string, string> = {
  website: "Website",
  "cal.com": "Cal.com booking",
  phone: "Phone",
  "walk-in": "Walk-in",
  facebook: "Facebook",
  instagram: "Instagram",
};

const sourceName = (source: string | null | undefined): string =>
  source ? (SOURCE_NAMES[source] ?? source) : "Not recorded";

const emptyRow = (source: string): SourceRow => ({
  source,
  leads: 0,
  quoted: 0,
  booked: 0,
  converted: 0,
  lost: 0,
  conversion: null,
  value: 0,
});

/** Leads created in the period by source, biggest first, with a total row last. */
export const leadFunnel = (
  deals: Deal[],
  changes: StageChange[],
  range: DateRange,
): { rows: SourceRow[]; total: SourceRow } => {
  const byDeal = new Map<Identifier, StageChange[]>();
  for (const c of changes)
    byDeal.set(c.deal_id, [...(byDeal.get(c.deal_id) ?? []), c]);
  const rows = new Map<string, SourceRow>();
  const total = emptyRow("All sources");
  for (const deal of deals.filter((d) => inRange(d.created_at, range))) {
    const reached = furthestStage(deal, byDeal.get(deal.id) ?? []);
    const row =
      rows.get(sourceName(deal.lead_source)) ??
      emptyRow(sourceName(deal.lead_source));
    for (const target of [row, total]) {
      target.leads += 1;
      if (reached >= stageIndex("quoted")) target.quoted += 1;
      if (reached >= stageIndex("booked")) target.booked += 1;
      if (deal.stage === "won") {
        target.converted += 1;
        target.value += Number(deal.amount) || 0;
      }
      if (deal.stage === "lost") target.lost += 1;
    }
    rows.set(row.source, row);
  }
  const withRate = (r: SourceRow): SourceRow => ({
    ...r,
    conversion: r.leads ? Math.round((r.converted / r.leads) * 100) : null,
  });
  return {
    rows: [...rows.values()]
      .map(withRate)
      .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source)),
    total: withRate(total),
  };
};

export interface ResponseSpeed {
  /** Median hours from a request arriving to its quote going out. */
  quoteHours: number | null;
  quotedCount: number;
  /** Median days from a request arriving to the job converting. */
  convertDays: number | null;
  convertedCount: number;
}

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** How fast the shop quotes and converts, from the logged stage changes of the period's leads. */
export const responseSpeed = (
  deals: Deal[],
  changes: StageChange[],
  range: DateRange,
): ResponseSpeed => {
  const quoteHours: number[] = [];
  const convertDays: number[] = [];
  for (const deal of deals.filter((d) => inRange(d.created_at, range))) {
    const created = new Date(deal.created_at).getTime();
    // Changes made after creation only: the row logged at creation is not a move
    const mine = changes
      .filter((c) => c.deal_id === deal.id && c.from_stage != null)
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    const quoted = mine.find((c) => c.to_stage === "quoted");
    if (quoted)
      quoteHours.push(
        Math.max(0, new Date(quoted.changed_at).getTime() - created) / HOUR_MS,
      );
    const won = mine.find((c) => c.to_stage === "won");
    if (won)
      convertDays.push(
        Math.max(0, new Date(won.changed_at).getTime() - created) / DAY_MS,
      );
  }
  return {
    quoteHours: median(quoteHours),
    quotedCount: quoteHours.length,
    convertDays: median(convertDays),
    convertedCount: convertDays.length,
  };
};
