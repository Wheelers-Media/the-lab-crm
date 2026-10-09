import { useWatch } from "react-hook-form";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import {
  ENGINES,
  normalizeVin,
  PLATFORM_CHOICES,
  SIZE_CLASS_CHOICES,
  validateVin,
} from "./vehicleModel";
import type { VehiclePlatform } from "../types";

const yearInRange = (value?: number | null) =>
  value == null || (value >= 1900 && value <= 2100)
    ? undefined
    : "Enter a model year like 2022";

/** Engine choices follow the platform, the same list the website uses. */
const EngineInput = () => {
  const platform = useWatch({ name: "platform" }) as VehiclePlatform | null;
  const engines = platform ? ENGINES[platform] : undefined;
  return engines ? (
    <SelectInput
      source="engine"
      label="Engine"
      choices={engines.map((e) => ({ id: e, name: e }))}
      helperText={false}
    />
  ) : (
    <TextInput
      source="engine"
      label="Engine"
      helperText={false}
      placeholder="5.7L Hemi"
    />
  );
};

export const VehicleInputs = () => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <NumberInput
        source="year"
        label="Year"
        helperText={false}
        validate={yearInRange}
        placeholder="2022"
      />
      <TextInput
        source="make"
        label="Make"
        helperText={false}
        placeholder="Ram"
      />
      <TextInput
        source="model"
        label="Model"
        helperText={false}
        placeholder="3500"
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextInput
        source="trim"
        label="Trim"
        helperText={false}
        placeholder="Laramie, crew cab"
      />
      <SelectInput
        source="size_class"
        label="Size (for detailing and tint pricing)"
        choices={SIZE_CLASS_CHOICES}
        helperText={false}
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SelectInput
        source="platform"
        label="Platform"
        choices={PLATFORM_CHOICES}
        helperText={false}
      />
      <EngineInput />
      <TextInput
        source="transmission"
        label="Transmission"
        helperText={false}
        placeholder="68RFE, Aisin, 10R140"
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <TextInput
        source="vin"
        label="VIN"
        helperText={false}
        validate={validateVin}
        parse={normalizeVin}
        maxLength={17}
      />
      <TextInput source="plate" label="Plate" helperText={false} />
      <TextInput
        source="colour"
        label="Colour"
        helperText={false}
        placeholder="Granite Crystal"
      />
    </div>
    <TextInput
      source="mods"
      label="Build and mods"
      multiline
      rows={3}
      helperText={false}
      placeholder="EZ LYNK tune, 5in Polar exhaust, Gridiron Prerunner, 18% ceramic tint"
    />
    <TextInput
      source="notes"
      label="Notes"
      multiline
      rows={2}
      helperText={false}
    />
    <BooleanInput source="is_primary" label="Main vehicle" />
  </div>
);
