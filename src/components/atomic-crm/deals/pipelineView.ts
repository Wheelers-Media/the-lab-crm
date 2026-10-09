// Keeps the job board readable as history piles up: closed stages
// (Converted, Not now) show recent jobs only, and every column shows a
// first page with "show more".
import type { Deal } from "../types";

export const CLOSED_STAGES = ["won", "lost"];
export const RECENT_CLOSED_DAYS = 30;
export const COLUMN_PAGE_SIZE = 20;

const DAY_MS = 86_400_000;

export const isClosedStage = (stage: string): boolean =>
  CLOSED_STAGES.includes(stage);

/** When the job last moved: stage change, else last update, else creation. */
export const lastMovedAt = (
  deal: Pick<Deal, "stage_changed_at" | "updated_at" | "created_at">,
): number =>
  new Date(
    deal.stage_changed_at ?? deal.updated_at ?? deal.created_at,
  ).getTime();

export interface ColumnView {
  visible: Deal[];
  /** Closed jobs older than the recent window, hidden until asked. */
  olderCount: number;
  /** Jobs past the first page, hidden until asked. */
  moreCount: number;
}

export const columnView = (
  deals: Deal[],
  stage: string,
  {
    now = new Date(),
    showOlder = false,
    showAll = false,
  }: { now?: Date; showOlder?: boolean; showAll?: boolean } = {},
): ColumnView => {
  const cutoff = now.getTime() - RECENT_CLOSED_DAYS * DAY_MS;
  const inWindow =
    isClosedStage(stage) && !showOlder
      ? deals.filter((d) => lastMovedAt(d) >= cutoff)
      : deals;
  const visible = showAll ? inWindow : inWindow.slice(0, COLUMN_PAGE_SIZE);
  return {
    visible,
    olderCount: deals.length - inWindow.length,
    moreCount: inWindow.length - visible.length,
  };
};

export const stageTotal = (deals: Pick<Deal, "amount">[]): number =>
  deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
