import { CalendarDays } from "lucide-react";
import type { Identifier } from "ra-core";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { AppointmentDetail } from "../calendar/AppointmentDetail";
import { useAppointmentActions } from "../calendar/useAppointmentActions";
import { ActionRow } from "../misc/ActionRow";
import { DepositChip, ResourceChip } from "../operations/OperationsWidgets";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import type { Appointment, Contact } from "../types";
import { useCustomerHistory } from "./useCustomerHistory";

const STATUS: Partial<Record<Appointment["status"], [string, string]>> = {
  completed: ["Done", "lab-chip-muted"],
  no_show: ["No-show", "lab-chip-danger"],
  cancelled: ["Cancelled", "lab-chip-muted"],
  rescheduled: ["Rescheduled", "lab-chip-warn"],
};

const Row = ({
  appointment,
  contact,
}: {
  appointment: Appointment;
  contact: Contact;
}) => {
  const [open, setOpen] = useState(false);
  const day = shopDayKey(appointment.start_at);
  const status = STATUS[appointment.status];
  const { actions, swipeLeft, swipeRight } = useAppointmentActions({
    appointment,
    contact,
    onOpen: () => setOpen(true),
  });
  return (
    <li>
      <ActionRow
        title={appointment.title}
        subtitle={`${formatShopDay(day, { weekday: "short", month: "short", day: "numeric" })}, ${formatShopTime(appointment.start_at)}`}
        actions={actions}
        swipeLeft={swipeLeft}
        swipeRight={swipeRight}
        className="rounded-md"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-3 py-2.5 min-h-12 text-left transition-colors hover:bg-muted/50 rounded-md px-2",
            (appointment.status === "cancelled" ||
              appointment.status === "no_show") &&
              "opacity-70",
          )}
        >
          <span className="grid w-11 shrink-0 place-items-center rounded-md bg-muted py-1 text-center leading-none">
            <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {formatShopDay(day, { month: "short" })}
            </span>
            <span className="mt-0.5 text-base font-semibold tabular-nums">
              {formatShopDay(day, { day: "numeric" })}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {appointment.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatShopDay(day, { weekday: "short", year: "numeric" })}{" "}
              {formatShopTime(appointment.start_at)}
              {appointment.vehicle ? ` · ${appointment.vehicle}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <ResourceChip resource={appointment.resource} />
            {status ? (
              <span className={cn("lab-chip", status[1])}>{status[0]}</span>
            ) : (
              <DepositChip appointment={appointment} />
            )}
          </span>
        </button>
      </ActionRow>
      {open ? (
        <AppointmentDetail
          appointment={appointment}
          contact={contact}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </li>
  );
};

/**
 * Every appointment the customer has had or has coming: upcoming first, then
 * the past, newest first. A tap opens the booking, as on the Calendar.
 */
export const ContactAppointments = ({
  contact,
}: {
  contact: Contact & { id: Identifier };
}) => {
  const { appointments, isPending } = useCustomerHistory(contact.id);
  const now = useMemo(() => Date.now(), []);
  const [upcoming, past] = useMemo(() => {
    const later = appointments
      .filter(
        (a) =>
          new Date(a.start_at).getTime() > now &&
          (a.status === "booked" || a.status === "rescheduled"),
      )
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    const earlier = appointments
      .filter((a) => !later.includes(a))
      .sort((a, b) => b.start_at.localeCompare(a.start_at));
    return [later, earlier];
  }, [appointments, now]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!appointments.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted">
          <CalendarDays className="size-6 text-muted-foreground" />
        </span>
        <p className="font-medium">No appointments yet</p>
        <p className="max-w-64 text-sm text-muted-foreground">
          Cal.com bookings and ones added on the Calendar show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {upcoming.length ? (
        <section aria-label="Coming up">
          <h3 className="lab-eyebrow mb-1">Coming up</h3>
          <ul className="divide-y divide-border">
            {upcoming.map((a) => (
              <Row key={a.id} appointment={a} contact={contact} />
            ))}
          </ul>
        </section>
      ) : null}
      {past.length ? (
        <section aria-label="Past appointments">
          <h3 className="lab-eyebrow mb-1">Past</h3>
          <ul className="divide-y divide-border">
            {past.map((a) => (
              <Row key={a.id} appointment={a} contact={contact} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
