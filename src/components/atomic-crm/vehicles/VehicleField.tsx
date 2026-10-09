import { ReferenceField } from "@/components/admin/reference-field";
import { useRecordContext } from "ra-core";

import type { Vehicle } from "../types";
import { VehicleSummary } from "./ContactVehicles";
import { vehicleLabel } from "./vehicleModel";

const VehicleLabel = () => {
  const vehicle = useRecordContext<Vehicle>();
  return vehicle ? <span>{vehicleLabel(vehicle)}</span> : null;
};

const VehicleDetail = () => {
  const vehicle = useRecordContext<Vehicle>();
  return vehicle ? <VehicleSummary vehicle={vehicle} /> : null;
};

/** The vehicle a job or appointment points at, as a one-line label. */
export const VehicleLabelField = ({ source = "vehicle_id" }) => (
  <ReferenceField
    source={source}
    reference="vehicles"
    link={false}
    empty={null}
  >
    <VehicleLabel />
  </ReferenceField>
);

/** The vehicle with platform, engine, VIN and build. */
export const VehicleDetailField = ({ source = "vehicle_id" }) => (
  <ReferenceField
    source={source}
    reference="vehicles"
    link={false}
    empty={null}
  >
    <VehicleDetail />
  </ReferenceField>
);
