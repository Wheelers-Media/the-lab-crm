import { CarFront, Pencil, Plus } from "lucide-react";
import type { Identifier } from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCustomerHistory } from "../contacts/useCustomerHistory";
import { VehicleDialog, VehicleSummary } from "./ContactVehicles";
import { useContactVehicles } from "./useContactVehicles";
import { workDone } from "./workDone";

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
  });

/**
 * The customer's main vehicle at the top of their profile, with what the shop
 * has already done for them, so the next offer starts from what is on the truck.
 */
export const CustomerVehicleCard = ({
  contactId,
}: {
  contactId: Identifier;
}) => {
  const { vehicles, primary, isPending } = useContactVehicles(contactId);
  const history = useCustomerHistory(contactId);
  const done = useMemo(() => workDone(history.orders), [history.orders]);
  const [editing, setEditing] = useState<"primary" | "new" | null>(null);

  if (isPending) return <Skeleton className="h-24 w-full" />;

  return (
    <section
      aria-labelledby="vehicle-card"
      className="rounded-lg border border-border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="vehicle-card"
          className="flex items-center gap-2 text-base font-semibold normal-case leading-snug"
        >
          <CarFront className="size-4 text-muted-foreground" aria-hidden />
          {vehicles.length > 1 ? "Main vehicle" : "Vehicle"}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(primary ? "primary" : "new")}
        >
          {primary ? (
            <>
              <Pencil className="size-4" aria-hidden />
              Edit
            </>
          ) : (
            <>
              <Plus className="size-4" aria-hidden />
              Add vehicle
            </>
          )}
        </Button>
      </div>

      {primary ? (
        <div className="mt-2">
          <VehicleSummary vehicle={primary} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No vehicle on file. Add the year, make, model and engine so
          suggestions and quotes fit the truck.
        </p>
      )}

      <div className="mt-3 border-t border-border pt-3">
        <p className="lab-eyebrow text-[0.6875rem]">Done with us</p>
        {done.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {done.map((d) => (
              <li
                key={d.kind}
                className="lab-chip lab-chip-muted lab-num"
                title={`${d.label}: ${d.times} ${d.times === 1 ? "order" : "orders"}, last ${monthYear(d.last)}`}
              >
                {d.label}
                {d.times > 1 ? ` ×${d.times}` : ""}
                <span className="opacity-70">· {monthYear(d.last)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {history.isPending ? "Loading…" : "Nothing paid yet."}
          </p>
        )}
      </div>

      {vehicles.length > 1 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          +{vehicles.length - 1} more{" "}
          {vehicles.length === 2 ? "vehicle" : "vehicles"} under Vehicles.
        </p>
      ) : null}

      {editing ? (
        <VehicleDialog
          open
          onClose={() => setEditing(null)}
          contactId={contactId}
          vehicle={editing === "primary" ? (primary ?? undefined) : undefined}
          isFirst={vehicles.length === 0}
        />
      ) : null}
    </section>
  );
};
