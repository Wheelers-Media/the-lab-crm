import { type Identifier, useGetList } from "ra-core";

import type { Vehicle } from "../types";

/**
 * A customer's vehicles, main one first. One query key everywhere, so the
 * profile's vehicle card, its suggestions and the Details tab share a request.
 */
export const useContactVehicles = (contactId: Identifier) => {
  const { data = [], isPending } = useGetList<Vehicle>("vehicles", {
    filter: { contact_id: contactId },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "is_primary", order: "DESC" },
  });
  return { vehicles: data, primary: data[0] ?? null, isPending };
};
