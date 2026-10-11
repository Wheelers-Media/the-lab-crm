import { useCreate, useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useNavigate } from "react-router";

import type { Contact, Deal, Vehicle } from "../types";

const IN_TWO_WEEKS = () =>
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Starts a new quote job for a customer, on their main truck, and opens the
 * quote builder. Used by the customer page and the customer row's hold menu.
 */
export const useStartQuote = () => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const navigate = useNavigate();
  const notify = useNotify();
  const [create, { isPending }] = useCreate<Deal>();

  const startQuote = async (contact: Contact) => {
    const name = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");
    const { data: vehicles } = await dataProvider
      .getList<Vehicle>("vehicles", {
        filter: { contact_id: contact.id },
        sort: { field: "is_primary", order: "DESC" },
        pagination: { page: 1, perPage: 1 },
      })
      .catch(() => ({ data: [] as Vehicle[] }));
    create(
      "deals",
      {
        data: {
          name: `Quote - ${name || "customer"}`,
          contact_ids: [contact.id],
          company_id: contact.company_id ?? undefined,
          stage: "qualified",
          amount: 0,
          index: 0,
          sales_id: identity?.id,
          expected_closing_date: IN_TWO_WEEKS(),
          vehicle_id: vehicles[0]?.id ?? null,
          packages: [],
        },
      },
      {
        onSuccess: (deal) => navigate(`/quotes/${deal.id}`),
        onError: () =>
          notify("Could not start the quote. Try again.", { type: "error" }),
      },
    );
  };

  return { startQuote, isStarting: isPending };
};
