import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";

const cameInAt = (deal: Pick<Deal, "created_at">): number => {
  const t = new Date(deal.created_at).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Newest job first; ties fall back to the higher id so the order is stable. */
export const newestFirst = (a: Deal, b: Deal): number =>
  cameInAt(b) - cameInAt(a) || Number(b.id) - Number(a.id);

export type DealsByStage = Record<Deal["stage"], Deal[]>;

export const getDealsByStage = (
  unorderedDeals: Deal[],
  dealStages: ConfigurationContextValue["dealStages"],
) => {
  if (!dealStages) return {};
  const dealsByStage: Record<Deal["stage"], Deal[]> = unorderedDeals.reduce(
    (acc, deal) => {
      // if deal has a stage that does not exist in configuration, assign it to the first stage
      const stage = dealStages.find((s) => s.value === deal.stage)
        ? deal.stage
        : dealStages[0].value;
      acc[stage].push(deal);
      return acc;
    },
    dealStages.reduce(
      (obj, stage) => ({ ...obj, [stage.value]: [] }),
      {} as Record<Deal["stage"], Deal[]>,
    ),
  );
  // Every column runs newest to oldest by when the job came in, so a glance
  // down any column shows what is fresh and what has gone stale.
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(newestFirst);
  });
  return dealsByStage;
};

/** The two stages only install jobs (parts shipped to the shop) pass through. */
export const INSTALL_STAGES = ["parts_on_the_way", "ready_to_book"];

/**
 * The stage a job moves to next. Ordinary jobs skip the install stages
 * (Quoted goes straight to Booked); install jobs step through them.
 */
export const nextStage = (
  dealStages: ConfigurationContextValue["dealStages"],
  stage: string,
) => {
  const path = INSTALL_STAGES.includes(stage)
    ? dealStages
    : dealStages.filter((s) => !INSTALL_STAGES.includes(s.value));
  const at = path.findIndex((s) => s.value === stage);
  return at === -1 ? undefined : path[at + 1];
};
