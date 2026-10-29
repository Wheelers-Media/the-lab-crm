import {
  ArrowRight,
  CarFront,
  CircleSlash,
  KanbanSquare,
  UserRound,
  Wrench,
} from "lucide-react";
import { useGetList, useGetMany } from "ra-core";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { reachActions } from "../contacts/reach";
import { ActionRow } from "../misc/ActionRow";
import type { SheetAction } from "../misc/ActionSheet";
import { contactName } from "../operations/format";
import { ResourceChip } from "../operations/OperationsWidgets";
import { formatShopTime, shopDayKey } from "../operations/shopTime";
import { useAppointments } from "../operations/useOperationsData";
import type { Appointment, Contact, Deal, Vehicle } from "../types";
import { vehicleLabel } from "../vehicles/vehicleModel";
import { TextCustomerMenu } from "./TextCustomerMenu";
import { useSetWorkStatus } from "./useSetWorkStatus";
import {
  actionLabel,
  daysInStatus,
  floorColumns,
  needsChasing,
  NEXT_STATUSES,
  WORK_STATUS_LABEL,
} from "./workStatus";

const ids = (values: Array<number | string | null | undefined>) => [
  ...new Set(values.filter((v): v is number | string => v != null)),
];

const useFloorData = () => {
  const { data: deals = [], isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "work_status_changed_at", order: "ASC" },
    // Has a status and has not left: the board hides picked-up vehicles
    filter: { "work_status@not.is": null, "work_status@neq": "picked_up" },
  });
  // Today's drop-offs that have not been marked arrived yet
  const today = shopDayKey(new Date());
  const { appointments } = useAppointments(
    today,
    shopDayKey(new Date(Date.now() + 86_400_000)),
  );
  const dealIds = useMemo(
    () => ids(appointments.map((a) => a.deal_id)),
    [appointments],
  );
  const { data: arrivingDeals = [] } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0 },
  );
  const contactIds = useMemo(
    () => ids([...deals, ...arrivingDeals].map((d) => d.contact_ids?.[0])),
    [deals, arrivingDeals],
  );
  const vehicleIds = useMemo(
    () => ids([...deals, ...arrivingDeals].map((d) => d.vehicle_id)),
    [deals, arrivingDeals],
  );
  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );
  const { data: vehicles = [] } = useGetMany<Vehicle>(
    "vehicles",
    { ids: vehicleIds },
    { enabled: vehicleIds.length > 0 },
  );
  return {
    deals,
    isPending,
    arriving: appointments
      .filter((a) => a.status === "booked")
      .map((a) => ({
        appointment: a,
        deal: arrivingDeals.find((d) => d.id === a.deal_id),
      }))
      .filter(
        (x): x is { appointment: Appointment; deal: Deal } =>
          x.deal != null && !x.deal.work_status && !x.deal.archived_at,
      ),
    contactsById: new Map(contacts.map((c) => [c.id, c])),
    vehiclesById: new Map(vehicles.map((v) => [v.id, v])),
  };
};

const FloorCard = ({
  deal,
  contact,
  vehicle,
}: {
  deal: Deal;
  contact?: Contact;
  vehicle?: Vehicle;
}) => {
  const { setStatus, isPending } = useSetWorkStatus();
  const days = daysInStatus(deal);
  const chase = needsChasing(deal);
  const label = vehicle ? vehicleLabel(vehicle) : "";
  const navigate = useNavigate();
  const nexts = NEXT_STATUSES[deal.work_status ?? "none"];
  const first = nexts[0];
  const actions: SheetAction[] = [
    ...nexts.map((next) => ({
      label: actionLabel(deal.work_status, next),
      icon: next === "picked_up" ? CarFront : ArrowRight,
      onSelect: () => setStatus(deal, next),
    })),
    {
      label: "Open job",
      icon: KanbanSquare,
      onSelect: () => navigate(`/deals/${deal.id}/show`),
    },
    ...reachActions(contact),
    {
      label: "Open customer",
      icon: UserRound,
      hidden: !contact,
      onSelect: () => contact && navigate(`/contacts/${contact.id}/show`),
    },
    {
      label: "Take off the shop floor",
      icon: CircleSlash,
      destructive: true,
      onSelect: () => setStatus(deal, null),
    },
  ];
  return (
    <ActionRow
      title={deal.name}
      subtitle={
        deal.work_status ? WORK_STATUS_LABEL[deal.work_status] : undefined
      }
      actions={actions}
      swipeRight={
        first
          ? {
              label: actionLabel(deal.work_status, first),
              icon: ArrowRight,
              tone: "primary",
              onTrigger: () => setStatus(deal, first),
            }
          : undefined
      }
    >
      <Card className="p-3 gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/deals/${deal.id}/show`}
            className="lab-tap text-sm font-semibold leading-snug hover:underline"
          >
            {deal.name}
          </Link>
          {days != null ? (
            <span
              className={cn(
                "lab-chip shrink-0",
                chase ? "lab-chip-warn" : "lab-chip-muted",
              )}
            >
              {days === 0 ? "Today" : `${days} d`}
            </span>
          ) : null}
        </div>
        {contact ? (
          <Link
            to={`/contacts/${contact.id}/show`}
            className="lab-tap self-start text-xs text-muted-foreground hover:underline"
          >
            {contactName(contact)}
          </Link>
        ) : null}
        {label ? (
          <p className="text-xs text-muted-foreground">{label}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {NEXT_STATUSES[deal.work_status ?? "none"].map((next) => (
            <Button
              key={next}
              size="sm"
              variant={
                next === "picked_up" || next === "ready" ? "default" : "outline"
              }
              disabled={isPending}
              className="min-h-9"
              onClick={() => setStatus(deal, next)}
            >
              {actionLabel(deal.work_status, next)}
            </Button>
          ))}
          <TextCustomerMenu deal={deal} contact={contact} vehicle={label} />
        </div>
      </Card>
    </ActionRow>
  );
};

const Arriving = ({
  items,
  contactsById,
}: {
  items: Array<{ appointment: Appointment; deal: Deal }>;
  contactsById: Map<unknown, Contact>;
}) => {
  const { setStatus, isPending } = useSetWorkStatus();
  if (!items.length) return null;
  return (
    <Card className="p-4 gap-1">
      <h2 className="text-lg font-semibold text-muted-foreground">
        Dropping off today
      </h2>
      <div className="divide-y divide-border">
        {items.map(({ appointment, deal }) => (
          <div key={appointment.id} className="flex items-center gap-3 py-2">
            <span className="text-sm text-muted-foreground w-16 shrink-0 lab-num">
              {formatShopTime(appointment.start_at)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {appointment.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {contactName(contactsById.get(deal.contact_ids?.[0]))}
              </p>
            </div>
            <ResourceChip resource={appointment.resource} />
            <Button
              size="sm"
              disabled={isPending}
              className="min-h-9"
              onClick={() => setStatus(deal, "in_shop")}
            >
              Arrived
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

/** Every vehicle on the floor, by where it is, with the next step one tap away. */
export const ShopFloorPage = () => {
  const data = useFloorData();
  const columns = useMemo(() => floorColumns(data.deals), [data.deals]);
  const total = columns.reduce((sum, c) => sum + c.deals.length, 0);

  return (
    <div className="flex flex-col gap-4 mt-2 max-w-screen-xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display uppercase tracking-wide">
            Shop floor
          </h1>
          <p className="text-sm text-muted-foreground">
            {total
              ? `${total} vehicle${total === 1 ? "" : "s"} here now`
              : "Nothing on the floor"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/calendar">Open calendar</Link>
        </Button>
      </div>

      <Arriving items={data.arriving} contactsById={data.contactsById} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <section key={column.status} className="flex flex-col gap-2 min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {WORK_STATUS_LABEL[column.status]}
              <span className="lab-chip lab-chip-muted">
                {column.deals.length}
              </span>
            </h2>
            {column.deals.map((deal) => (
              <FloorCard
                key={deal.id}
                deal={deal}
                contact={data.contactsById.get(deal.contact_ids?.[0])}
                vehicle={
                  deal.vehicle_id
                    ? data.vehiclesById.get(deal.vehicle_id)
                    : undefined
                }
              />
            ))}
            {!column.deals.length ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                {data.isPending ? "Loading..." : "None"}
              </p>
            ) : null}
          </section>
        ))}
      </div>

      {!total && !data.arriving.length && !data.isPending ? (
        <Card className="p-4 gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wrench className="size-5" />
            <h2 className="text-lg font-semibold">How it works</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Tap Arrived on a drop-off, or set the shop status on any job. Move
            vehicles to Waiting on parts and Ready for pickup, and text the
            customer in one tap. The CRM reminds you about vehicles waiting too
            long and asks for a review after pickup.
          </p>
        </Card>
      ) : null}
    </div>
  );
};

ShopFloorPage.path = "/shop-floor";
