import { useGetOne } from "ra-core";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { Contact, Deal, Vehicle, WorkStatus } from "../types";
import { vehicleLabel } from "../vehicles/vehicleModel";
import { TextCustomerMenu } from "./TextCustomerMenu";
import { useSetWorkStatus } from "./useSetWorkStatus";
import { daysInStatus, WORK_STATUS_LABEL } from "./workStatus";

const ORDER: WorkStatus[] = ["in_shop", "waiting_parts", "ready", "picked_up"];

/** The job's place on the shop floor, changeable in one tap, with the texts that fit. */
export const WorkStatusPanel = ({ deal }: { deal: Deal }) => {
  const { setStatus, isPending } = useSetWorkStatus();
  const contactId = deal.contact_ids?.[0];
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId },
    { enabled: contactId != null },
  );
  const { data: vehicle } = useGetOne<Vehicle>(
    "vehicles",
    { id: deal.vehicle_id! },
    { enabled: deal.vehicle_id != null },
  );
  const days = daysInStatus(deal);

  return (
    <div className="flex flex-col gap-2 my-4 sm:m-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground tracking-wide">
          Shop floor
        </span>
        {deal.work_status && days != null ? (
          <span className="text-xs text-muted-foreground">
            {WORK_STATUS_LABEL[deal.work_status]} for{" "}
            {days === 0
              ? "less than a day"
              : `${days} day${days === 1 ? "" : "s"}`}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={deal.work_status ?? ""}
          disabled={isPending}
          onValueChange={(value) =>
            setStatus(deal, (value || null) as WorkStatus | null)
          }
          aria-label="Shop floor status"
          className="flex-wrap"
        >
          {ORDER.map((status) => (
            <ToggleGroupItem
              key={status}
              value={status}
              className="px-3 min-h-9"
            >
              {WORK_STATUS_LABEL[status]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <TextCustomerMenu
          deal={deal}
          contact={contact}
          vehicle={vehicle ? vehicleLabel(vehicle) : null}
        />
      </div>
    </div>
  );
};
