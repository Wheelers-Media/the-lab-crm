import {
  Copy,
  ExternalLink,
  MessageSquare,
  Phone,
  UserRound,
} from "lucide-react";
import { type Identifier, useGetManyAggregate, useNotify } from "ra-core";
import { useNavigate } from "react-router";

import { dial, reachActions } from "../contacts/reach";
import type { SheetAction } from "../misc/ActionSheet";
import type { SwipeAction } from "../misc/SwipeRow";
import type { Contact, Order, ShopifyCheckout } from "../types";
import { SHOPIFY_ADMIN } from "./shopFormat";

/** The linked customer, batched with every other row on screen. */
const useLinkedContact = (id: Identifier | null): Contact | undefined => {
  const { data } = useGetManyAggregate<Contact>(
    "contacts",
    { ids: id != null ? [id] : [] },
    { enabled: id != null },
  );
  return data?.[0];
};

const useCopy = () => {
  const notify = useNotify();
  return async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${what} copied`, { type: "info" });
    } catch {
      notify("Could not copy. Select the text instead.", { type: "warning" });
    }
  };
};

/** Customer, Shopify and copy actions for one order. */
export const useOrderActions = (order: Order): SheetAction[] => {
  const navigate = useNavigate();
  const copy = useCopy();
  const contact = useLinkedContact(order.contact_id);
  const number = order.order_number.replace(/^#/, "");
  // Imported orders can lack the Shopify id; only link a real one
  const shopifyId = /^\d+$/.test(order.shopify_order_id ?? "")
    ? order.shopify_order_id
    : null;
  return [
    {
      label: "Open customer",
      icon: UserRound,
      hidden: order.contact_id == null,
      onSelect: () => navigate(`/contacts/${order.contact_id}/show`),
    },
    ...reachActions(contact),
    {
      label: "Open in Shopify",
      icon: ExternalLink,
      hidden: !shopifyId,
      onSelect: () =>
        window.open(
          `${SHOPIFY_ADMIN}/orders/${shopifyId}`,
          "_blank",
          "noopener,noreferrer",
        ),
    },
    {
      label: `Copy order #${number}`,
      icon: Copy,
      onSelect: () => void copy(number, "Order number"),
    },
  ];
};

/**
 * Follow-up for one abandoned cart: hold for everything, swipe left to call
 * and right to text, as on the customer list.
 */
export const useCartActions = (
  checkout: ShopifyCheckout,
): {
  actions: SheetAction[];
  swipeLeft?: SwipeAction;
  swipeRight?: SwipeAction;
} => {
  const navigate = useNavigate();
  const copy = useCopy();
  const contact = useLinkedContact(checkout.contact_id);
  const phone = checkout.phone?.trim() ? dial(checkout.phone) : null;
  const recovery =
    checkout.recovery_url && /^https:\/\//i.test(checkout.recovery_url)
      ? checkout.recovery_url
      : null;
  const go = (href: string) => {
    window.location.href = href;
  };
  // The number Shopify took at checkout first, the profile's after
  const reach: SheetAction[] = phone
    ? [
        {
          label: `Call ${checkout.phone}`,
          icon: Phone,
          onSelect: () => go(`tel:${phone}`),
        },
        {
          label: "Send a text",
          icon: MessageSquare,
          onSelect: () => go(`sms:${phone}`),
        },
      ]
    : reachActions(contact);
  const callable = reach.length > 0;
  const tap = (action: SheetAction) => () =>
    action.onSelect({} as React.MouseEvent);
  return {
    actions: [
      ...reach,
      {
        label: "Open cart",
        icon: ExternalLink,
        hidden: !recovery,
        onSelect: () =>
          recovery && window.open(recovery, "_blank", "noopener,noreferrer"),
      },
      {
        label: "Open customer",
        icon: UserRound,
        hidden: checkout.contact_id == null,
        onSelect: () => navigate(`/contacts/${checkout.contact_id}/show`),
      },
      {
        label: "Copy email",
        icon: Copy,
        hidden: !checkout.email,
        onSelect: () => checkout.email && void copy(checkout.email, "Email"),
      },
    ],
    swipeLeft: callable
      ? {
          label: "Call",
          icon: Phone,
          tone: "good",
          onTrigger: tap(reach[0]),
        }
      : undefined,
    swipeRight: callable
      ? {
          label: "Text",
          icon: MessageSquare,
          tone: "primary",
          onTrigger: tap(reach[1]),
        }
      : undefined,
  };
};
