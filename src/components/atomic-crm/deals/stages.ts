import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { isClosedStage, lastMovedAt } from "./pipelineView";

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
  // order open columns by index; closed ones newest first, so the board can
  // show only recent closed jobs as the start of the column
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(
      isClosedStage(stage.value)
        ? (a: Deal, b: Deal) => lastMovedAt(b) - lastMovedAt(a)
        : (recordA: Deal, recordB: Deal) => recordA.index - recordB.index,
    );
  });
  return dealsByStage;
};
