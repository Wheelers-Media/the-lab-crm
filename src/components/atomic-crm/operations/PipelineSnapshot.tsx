import { KanbanSquare } from "lucide-react";
import { useStore } from "ra-core";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Card } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { money } from "./format";
import { OPEN_STAGES } from "./metrics";
import { SectionTitle } from "./OperationsWidgets";

/** Open jobs per stage; tap a stage to open it on the Jobs page. */
export const PipelineSnapshot = ({ deals }: { deals: Deal[] }) => {
  const { dealStages } = useConfigurationContext();
  const [, setStage] = useStore<string>("deals.mobile.stage");
  const navigate = useNavigate();
  const rows = useMemo(
    () =>
      dealStages
        .filter((s) => OPEN_STAGES.includes(s.value))
        .map((s) => {
          const inStage = deals.filter(
            (d) => d.stage === s.value && !d.archived_at,
          );
          return {
            ...s,
            count: inStage.length,
            amount: inStage.reduce((sum, d) => sum + (d.amount ?? 0), 0),
          };
        }),
    [deals, dealStages],
  );
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="p-4 gap-0">
      <SectionTitle icon={KanbanSquare}>Pipeline</SectionTitle>
      <div className="flex flex-col">
        {rows.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setStage(r.value);
              navigate("/deals");
            }}
            className="flex items-center gap-3 py-2.5 text-left border-b border-border last:border-0 min-h-12"
          >
            <span className="w-24 font-display uppercase tracking-wide text-sm">
              {r.label}
            </span>
            <span className="flex-1 h-2 rounded-sm bg-muted overflow-hidden">
              <span
                className="block h-full bg-primary"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="w-8 text-right lab-num">{r.count}</span>
            <span className="w-20 text-right text-xs text-muted-foreground lab-num">
              {money(r.amount)}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
};
