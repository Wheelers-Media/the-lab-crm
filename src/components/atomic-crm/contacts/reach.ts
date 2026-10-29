import { MessageSquare, Phone } from "lucide-react";

import type { SheetAction } from "../misc/ActionSheet";
import type { Contact } from "../types";
import { firstPhone } from "./firstPhone";

/** Dialable form of a stored number: "307.520.9799 x4478" -> "3075209799". */
export const dial = (n: string): string =>
  n.split(/\s*[xX]\s*/)[0].replace(/[^\d+]/g, "");

/** Opens a tel:, sms: or mailto: link. */
export const go = (href: string): void => {
  window.location.href = href;
};

/**
 * Call and Text for whoever a row belongs to, for the hold menus on bookings,
 * jobs and orders. Left out when there is no customer or no number.
 */
export const reachActions = (contact?: Contact | null): SheetAction[] => {
  const phone = contact ? firstPhone(contact) : null;
  if (!phone) return [];
  return [
    {
      label: `Call ${phone}`,
      icon: Phone,
      onSelect: () => go(`tel:${dial(phone)}`),
    },
    {
      label: "Send a text",
      icon: MessageSquare,
      onSelect: () => go(`sms:${dial(phone)}`),
    },
  ];
};
