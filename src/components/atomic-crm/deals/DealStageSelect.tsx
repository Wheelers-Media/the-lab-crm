import { useNotify, useUpdate } from "ra-core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/** Move a job to another stage without dragging (the phone has no board). */
export const DealStageSelect = ({ deal }: { deal: Deal }) => {
  const { dealStages } = useConfigurationContext();
  const [update, { isPending }] = useUpdate<Deal>();
  const notify = useNotify();
  const onChange = (stage: string) => {
    if (stage === deal.stage) return;
    update(
      "deals",
      {
        id: deal.id,
        data: { stage, stage_changed_at: new Date().toISOString() },
        previousData: deal,
      },
      {
        onSuccess: () =>
          notify(
            `Moved to ${dealStages.find((s) => s.value === stage)?.label ?? stage}`,
          ),
        onError: () => notify("Could not move the job", { type: "error" }),
      },
    );
  };
  return (
    <Select value={deal.stage} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger size="sm" className="h-8 min-w-36" aria-label="Stage">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {dealStages.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
