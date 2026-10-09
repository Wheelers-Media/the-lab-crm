import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { useWatch } from "react-hook-form";
import type { Identifier } from "ra-core";

import type { Vehicle } from "../types";
import { vehicleLabel } from "./vehicleModel";

/** Pick one of the first customer's vehicles for this job. */
export const DealVehicleInput = () => {
  const contactIds = useWatch({ name: "contact_ids" }) as
    | Identifier[]
    | undefined;
  const contactId = contactIds?.[0];
  if (contactId == null) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a customer to pick their vehicle.
      </p>
    );
  }
  return (
    <ReferenceInput
      source="vehicle_id"
      reference="vehicles"
      filter={{ contact_id: contactId }}
      sort={{ field: "is_primary", order: "DESC" }}
    >
      <SelectInput
        label="Vehicle"
        optionText={(v: Vehicle) => vehicleLabel(v)}
        helperText={false}
        emptyText="No vehicle"
      />
    </ReferenceInput>
  );
};
