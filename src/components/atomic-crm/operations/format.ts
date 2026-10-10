import type { Contact } from "../types";

export const money = (value: number): string =>
  value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  });

export const contactName = (contact?: Contact): string =>
  contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
      "Customer"
    : "";

/** A link to a list page with its filter already applied (react-admin reads `?filter=`). */
export const listLink = (
  resource: string,
  filter: Record<string, unknown> = {},
): string =>
  Object.keys(filter).length
    ? `/${resource}?filter=${encodeURIComponent(JSON.stringify(filter))}`
    : `/${resource}`;
