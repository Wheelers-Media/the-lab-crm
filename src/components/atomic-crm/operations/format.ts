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
