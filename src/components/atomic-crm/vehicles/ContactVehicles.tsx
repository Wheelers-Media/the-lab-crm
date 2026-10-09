import { Pencil, Plus, Star } from "lucide-react";
import {
  CreateBase,
  EditBase,
  Form,
  type Identifier,
  useDataProvider,
  useGetList,
  useNotify,
} from "ra-core";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Vehicle } from "../types";
import { VehicleInputs } from "./VehicleInputs";
import {
  DIESEL_PLATFORMS,
  platformName,
  sizeClassName,
  vehicleLabel,
} from "./vehicleModel";

/** Only one main vehicle per customer: clear the flag on the others. */
const useKeepOnePrimary = (contactId: Identifier) => {
  const dataProvider = useDataProvider();
  return async (saved: Vehicle) => {
    if (!saved.is_primary) return;
    const { data } = await dataProvider.getList<Vehicle>("vehicles", {
      filter: { contact_id: contactId, is_primary: true },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    await Promise.all(
      data
        .filter((v) => v.id !== saved.id)
        .map((v) =>
          dataProvider.update("vehicles", {
            id: v.id,
            data: { is_primary: false },
            previousData: v,
          }),
        ),
    );
  };
};

const VehicleDialog = ({
  open,
  onClose,
  contactId,
  vehicle,
  isFirst,
}: {
  open: boolean;
  onClose: () => void;
  contactId: Identifier;
  vehicle?: Vehicle;
  isFirst: boolean;
}) => {
  const notify = useNotify();
  const keepOnePrimary = useKeepOnePrimary(contactId);
  const onSuccess = async (saved: Vehicle) => {
    await keepOnePrimary(saved);
    onClose();
    notify(vehicle ? "Vehicle updated" : "Vehicle added");
  };
  const body = (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="lg:max-w-2xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        <Form className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {vehicle ? "Edit vehicle" : "Add vehicle"}
            </DialogTitle>
            <DialogDescription>
              Platform and engine use the same list as the website's truck
              selector.
            </DialogDescription>
          </DialogHeader>
          <VehicleInputs />
          <DialogFooter className="w-full justify-end">
            <SaveButton label={vehicle ? "Save vehicle" : "Add vehicle"} />
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
  return vehicle ? (
    <EditBase
      resource="vehicles"
      id={vehicle.id}
      redirect={false}
      mutationMode="pessimistic"
      mutationOptions={{ onSuccess }}
    >
      {body}
    </EditBase>
  ) : (
    <CreateBase
      resource="vehicles"
      record={{ contact_id: contactId, is_primary: isFirst }}
      redirect={false}
      mutationOptions={{ onSuccess }}
    >
      {body}
    </CreateBase>
  );
};

export const VehicleSummary = ({ vehicle }: { vehicle: Vehicle }) => {
  const isDiesel = vehicle.platform
    ? DIESEL_PLATFORMS.includes(vehicle.platform)
    : false;
  const detail = [vehicle.engine, vehicle.transmission]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <p className="text-sm font-medium flex items-center gap-1">
        {vehicle.is_primary ? (
          <Star
            className="w-3.5 h-3.5 shrink-0 text-[var(--lab-amber)]"
            aria-label="Main vehicle"
          />
        ) : null}
        <span className="truncate">{vehicleLabel(vehicle)}</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {vehicle.platform ? (
          <span
            className={`lab-chip ${isDiesel ? "lab-chip-parts" : "lab-chip-boutique"}`}
          >
            {platformName(vehicle.platform)}
          </span>
        ) : null}
        {vehicle.size_class && vehicle.size_class !== vehicle.platform ? (
          <span className="lab-chip lab-chip-muted">
            {sizeClassName(vehicle.size_class)}
          </span>
        ) : null}
      </div>
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
      {vehicle.vin || vehicle.plate || vehicle.colour ? (
        <p className="text-xs text-muted-foreground lab-num break-all">
          {[
            vehicle.vin && `VIN ${vehicle.vin}`,
            vehicle.plate && `Plate ${vehicle.plate}`,
            vehicle.colour,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {vehicle.mods ? (
        <p className="text-xs text-muted-foreground whitespace-pre-line">
          {vehicle.mods}
        </p>
      ) : null}
    </div>
  );
};

/** The customer's vehicles, main one first, with add and edit. */
export const ContactVehicles = ({ contactId }: { contactId: Identifier }) => {
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const { data: vehicles = [], isPending } = useGetList<Vehicle>("vehicles", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "is_primary", order: "DESC" },
  });
  return (
    <div className="flex flex-col gap-3">
      {!isPending && !vehicles.length ? (
        <p className="text-sm text-muted-foreground">
          No vehicles yet. Website requests add them automatically.
        </p>
      ) : null}
      {vehicles.map((v) => (
        <div key={v.id} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <VehicleSummary vehicle={v} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={`Edit ${vehicleLabel(v)}`}
            onClick={() => setEditing(v)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => setEditing("new")}
        >
          <Plus className="w-4 h-4" />
          Add vehicle
        </Button>
      </div>
      {editing ? (
        <VehicleDialog
          open
          onClose={() => setEditing(null)}
          contactId={contactId}
          vehicle={editing === "new" ? undefined : editing}
          isFirst={vehicles.length === 0}
        />
      ) : null}
    </div>
  );
};
