import { useMemo } from "react";

import type { Contact } from "../types";
import { useContactVehicles } from "../vehicles/useContactVehicles";
import { customerSnapshot, nextSales } from "./nextSaleModel";
import { suggestionText } from "./suggestionTexts";
import { useCustomerHistory, useMembershipPrice } from "./useCustomerHistory";

/**
 * A customer's headline numbers and what to offer them next, each suggestion
 * with its ready-to-send text. Every query is shared with the rest of the
 * profile, so calling this twice costs no extra requests.
 */
export const useNextSales = (contact: Contact) => {
  const now = useMemo(() => new Date(), []);
  const history = useCustomerHistory(contact.id);
  const membershipPrice = useMembershipPrice();
  const { primary: vehicle, isPending: vehiclePending } = useContactVehicles(
    contact.id,
  );

  const snapshot = useMemo(
    () => customerSnapshot(history.orders, history.appointments, now),
    [history.orders, history.appointments, now],
  );
  const suggestions = useMemo(
    () =>
      nextSales({
        orders: history.orders,
        appointments: history.appointments,
        deals: history.deals,
        membership: contact.membership,
        membershipPrice,
        vehicle,
        now,
      }).map((sale) => ({
        ...sale,
        text: suggestionText(sale, {
          firstName: contact.first_name,
          vehicle,
          membershipPrice,
        }),
      })),
    [
      history.orders,
      history.appointments,
      history.deals,
      contact.membership,
      contact.first_name,
      membershipPrice,
      vehicle,
      now,
    ],
  );

  return {
    now,
    snapshot,
    suggestions,
    vehicle,
    isPending: history.isPending || vehiclePending,
  };
};

export type SuggestionWithText = ReturnType<
  typeof useNextSales
>["suggestions"][number];
