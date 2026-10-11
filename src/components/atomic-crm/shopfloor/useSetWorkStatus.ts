import { useNotify, useUpdate } from "ra-core";

import type { Deal, WorkStatus } from "../types";
import { WORK_STATUS_LABEL } from "./workStatus";

/** Moves a vehicle to a new work status right away; the database stamps the time. */
export const useSetWorkStatus = () => {
  const [update, { isPending }] = useUpdate<Deal>();
  const notify = useNotify();

  const setStatus = (deal: Deal, status: WorkStatus | null) => {
    if ((deal.work_status ?? null) === status) return;
    update(
      "deals",
      {
        id: deal.id,
        data: {
          work_status: status,
          work_status_changed_at: status ? new Date().toISOString() : null,
        },
        previousData: deal,
      },
      {
        mutationMode: "optimistic",
        onSuccess: () =>
          notify(
            status
              ? `${deal.name}: ${WORK_STATUS_LABEL[status]}`
              : `${deal.name}: taken off the shop floor`,
          ),
      },
    );
  };

  return { setStatus, isPending };
};
