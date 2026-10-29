import {
  Car,
  Check,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  UserX,
} from "lucide-react";
import { type Identifier, useGetOne, useNotify, useUpdate } from "ra-core";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  leadSourceName,
  membershipName,
  preferredContactName,
} from "../contacts/customerProfile";
import { dial } from "../contacts/reach";
import { contactName } from "../operations/format";
import { DepositChip, ResourceChip } from "../operations/OperationsWidgets";
import {
  formatShopDay,
  formatShopTime,
  shopDayKey,
} from "../operations/shopTime";
import { quoteTotals } from "../packages/quoteModel";
import type { Appointment, Contact, Deal } from "../types";
import { appointmentSource } from "./appointmentSource";

const Row = ({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-2 text-sm">
    <Icon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 break-words">{children}</div>
  </div>
);

const CustomerBlock = ({ contact }: { contact?: Contact }) => {
  if (!contact)
    return (
      <p className="text-sm text-muted-foreground">
        No customer linked yet. A booking named after the customer links itself
        when they pay, or on the next calendar sync; a phone number in the notes
        links them too.
      </p>
    );
  const phone = contact.phone_jsonb?.[0]?.number;
  const email = contact.email_jsonb?.[0]?.email;
  const place = [contact.city, contact.province].filter(Boolean).join(", ");
  const rows = [
    phone ? (
      <Row icon={Phone} key="phone">
        <a href={`tel:${dial(phone)}`} className="hover:underline">
          {phone}
        </a>
      </Row>
    ) : null,
    email ? (
      <Row icon={Mail} key="email">
        <a href={`mailto:${email}`} className="hover:underline break-all">
          {email}
        </a>
      </Row>
    ) : null,
    place ? (
      <Row icon={MapPin} key="place">
        {place}
      </Row>
    ) : null,
    contact.membership ? (
      <p className="text-xs text-muted-foreground" key="member">
        {membershipName(contact.membership)}
      </p>
    ) : null,
    contact.lead_source ? (
      <p className="text-xs text-muted-foreground" key="lead">
        Came from {leadSourceName(contact.lead_source)}
        {contact.preferred_contact
          ? ` · prefers ${preferredContactName(contact.preferred_contact).toLowerCase()}`
          : ""}
      </p>
    ) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-1.5">
      <Link
        to={`/contacts/${contact.id}/show`}
        className="text-base font-medium hover:underline"
      >
        {contactName(contact)}
      </Link>
      {rows}
    </div>
  );
};

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

/** What is booked in: the lines on the booking's job, with a way to its quote. */
const BookedProducts = ({ dealId }: { dealId: Identifier }) => {
  const { data: deal } = useGetOne<Deal>("deals", { id: dealId });
  const lines = deal?.packages ?? [];
  if (!deal) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Products</p>
        <Link
          to={`/quotes/${deal.id}`}
          className="text-xs text-[var(--lab-blue-text)] hover:underline"
        >
          {lines.length ? "Open quote" : "Add products"}
        </Link>
      </div>
      {lines.length ? (
        <ul className="flex flex-col gap-1 rounded-md bg-muted/50 p-2 text-sm">
          {lines.map((line, i) => (
            <li
              key={`${line.package_id ?? "custom"}-${i}`}
              className="flex gap-2"
            >
              <span className="min-w-0 flex-1">
                {line.quantity > 1 ? `${line.quantity} x ` : ""}
                {line.title}
              </span>
              <span className="lab-num shrink-0">
                {money(line.price * line.quantity)}
              </span>
            </li>
          ))}
          <li className="flex justify-between border-t border-border pt-1 font-medium">
            <span>Total before tax</span>
            <span className="lab-num">{money(quoteTotals(lines).total)}</span>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No products on the job yet.
        </p>
      )}
    </div>
  );
};

const StatusActions = ({
  appointment,
  onChanged,
}: {
  appointment: Appointment;
  onChanged: () => void;
}) => {
  const [update, { isPending }] = useUpdate<Appointment>();
  const notify = useNotify();
  if (appointment.status !== "booked") return null;
  const set = (status: Appointment["status"], message: string) =>
    update(
      "appointments",
      { id: appointment.id, data: { status }, previousData: appointment },
      {
        onSuccess: () => {
          notify(message);
          onChanged();
        },
      },
    );
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => set("completed", "Marked done")}
      >
        <Check className="w-4 h-4" />
        Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => set("no_show", "Marked as no-show")}
      >
        <UserX className="w-4 h-4" />
        No-show
      </Button>
    </>
  );
};

/**
 * One appointment in full: the customer to call, the car, what was written in
 * Google, and a way back to that event.
 */
export const AppointmentDetail = ({
  appointment,
  contact,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  contact?: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const google = appointment.external_url;
  const notesLabel =
    appointment.source === "google" ? "Written in Google" : "Notes";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-9/10 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{appointment.title}</DialogTitle>
          <DialogDescription>
            {formatShopDay(shopDayKey(appointment.start_at), {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            , {formatShopTime(appointment.start_at)} to{" "}
            {formatShopTime(appointment.end_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1">
          <ResourceChip resource={appointment.resource} />
          {appointment.status === "completed" ? (
            <span className="lab-chip lab-chip-muted">Done</span>
          ) : appointment.status === "no_show" ? (
            <span className="lab-chip lab-chip-danger">No-show</span>
          ) : (
            <DepositChip appointment={appointment} />
          )}
          <span className="lab-chip lab-chip-muted">
            {appointmentSource(appointment)}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Customer
            </p>
            <CustomerBlock contact={contact} />
          </div>

          {appointment.vehicle ? (
            <Row icon={Car}>
              <span className="font-medium">{appointment.vehicle}</span>
            </Row>
          ) : null}

          {appointment.deal_id != null ? (
            <BookedProducts dealId={appointment.deal_id} />
          ) : null}

          {appointment.notes ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {notesLabel}
              </p>
              <p className="text-sm whitespace-pre-line rounded-md bg-muted/50 p-2">
                {appointment.notes}
              </p>
            </div>
          ) : null}

          {google ? (
            <Button asChild size="sm" variant="outline" className="self-start">
              <a href={google} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                Open in Google Calendar
              </a>
            </Button>
          ) : null}
        </div>

        <DialogFooter
          className={cn(
            "w-full",
            contact ? "sm:justify-between" : "sm:justify-end",
          )}
        >
          {contact ? (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/contacts/${contact.id}/show`}>
                Open customer profile
              </Link>
            </Button>
          ) : null}
          <div className="flex gap-2">
            <StatusActions
              appointment={appointment}
              onChanged={() => onOpenChange(false)}
            />
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
