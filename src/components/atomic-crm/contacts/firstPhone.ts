import type { Contact } from "../types";

/** The first phone number on file for a customer, or null. */
export const firstPhone = (c: Contact): string | null =>
  c.phone_jsonb?.find((p) => p.number?.trim())?.number?.trim() ?? null;
