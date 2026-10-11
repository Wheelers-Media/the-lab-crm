import { FileText, Mail, MessageSquare, Phone, UserRound } from "lucide-react";
import { useNavigate } from "react-router";

import type { SheetAction } from "../misc/ActionSheet";
import { useStartQuote } from "../packages/useStartQuote";
import type { Contact } from "../types";

const firstPhone = (c: Contact) =>
  c.phone_jsonb?.find((p) => p.number?.trim())?.number?.trim() ?? null;
const firstEmail = (c: Contact) =>
  c.email_jsonb?.find((e) => e.email?.trim())?.email?.trim() ?? null;
const dial = (n: string) => n.replace(/[^\d+]/g, "");

/** Call, text, email and quote a customer: the same actions everywhere. */
export const useContactActions = (contact: Contact) => {
  const navigate = useNavigate();
  const { startQuote, isStarting } = useStartQuote();
  const phone = firstPhone(contact);
  const email = firstEmail(contact);
  const go = (href: string) => {
    window.location.href = href;
  };

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

/** Round Call / Text / Email / Quote buttons under a customer's name, like iOS Contacts. */
export const ContactQuickActions = ({ contact }: { contact: Contact }) => {
  const { quick } = useContactActions(contact);
  return (
    <div className="grid grid-cols-4 gap-2">
      {quick.map((action) => {
        const Icon = action.icon!;
        return (
          <button
            key={action.short}
            type="button"
            disabled={action.disabled}
            onClick={action.onSelect}
            aria-label={action.label}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-card py-3 text-xs font-medium text-foreground disabled:opacity-35"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            {action.short}
          </button>
        );
      })}
    </div>
  );
};
