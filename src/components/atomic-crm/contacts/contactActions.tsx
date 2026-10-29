import {
  CalendarPlus,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { AppointmentCreateDialog } from "../calendar/AddAppointment";
import type { SheetAction } from "../misc/ActionSheet";
import { shopDayKey } from "../operations/shopTime";
import { useStartQuote } from "../packages/useStartQuote";
import type { Contact } from "../types";
import { firstPhone } from "./firstPhone";
import { dial, go } from "./reach";

const firstEmail = (c: Contact) =>
  c.email_jsonb?.find((e) => e.email?.trim())?.email?.trim() ?? null;
/** Call, text, email and quote a customer: the same actions everywhere. */
export const useContactActions = (contact: Contact) => {
  const navigate = useNavigate();
  const { startQuote, isStarting } = useStartQuote();
  const phone = firstPhone(contact);
  const email = firstEmail(contact);

  const quick: Array<SheetAction & { short: string }> = [
    {
      label: phone ? `Call ${phone}` : "No phone number",
      short: "Call",
      icon: Phone,
      disabled: !phone,
      onSelect: () => phone && go(`tel:${dial(phone)}`),
    },
    {
      label: phone ? "Send a text" : "No mobile number",
      short: "Text",
      icon: MessageSquare,
      disabled: !phone,
      onSelect: () => phone && go(`sms:${dial(phone)}`),
    },
    {
      label: email ? "Send an email" : "No email address",
      short: "Email",
      icon: Mail,
      disabled: !email,
      onSelect: () => email && go(`mailto:${email}`),
    },
    {
      label: "New quote",
      short: "Quote",
      icon: FileText,
      disabled: isStarting,
      onSelect: () => startQuote(contact),
    },
  ];

  const sheet: SheetAction[] = [
    ...quick,
    {
      label: "Open profile",
      icon: UserRound,
      onSelect: () => navigate(`/contacts/${contact.id}/show`),
    },
  ];

  return { quick, sheet };
};

/**
 * Round Call / Text / Email / Quote / Book buttons under a customer's name,
 * like iOS Contacts. Book opens the calendar's booking form for them.
 */
export const ContactQuickActions = ({ contact }: { contact: Contact }) => {
  const { quick } = useContactActions(contact);
  const [bookOpen, setBookOpen] = useState(false);
  const today = useMemo(() => shopDayKey(new Date()), []);
  const actions = [
    ...quick,
    {
      label: "Book an appointment",
      short: "Book",
      icon: CalendarPlus,
      disabled: false,
      onSelect: () => setBookOpen(true),
    },
  ];
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {actions.map((action) => {
          const Icon = action.icon!;
          return (
            <button
              key={action.short}
              type="button"
              disabled={action.disabled}
              onClick={action.onSelect}
              aria-label={action.label}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-card py-3 text-xs font-medium text-foreground transition-transform active:scale-[0.96] disabled:opacity-35"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              {action.short}
            </button>
          );
        })}
      </div>
      {bookOpen ? (
        <AppointmentCreateDialog
          open={bookOpen}
          onOpenChange={setBookOpen}
          defaults={{
            day: today,
            contact_id: contact.id,
            vehicle: contact.vehicle_label,
          }}
        />
      ) : null}
    </>
  );
};
