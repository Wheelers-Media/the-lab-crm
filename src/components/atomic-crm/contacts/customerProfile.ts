// THE LAB customer profile vocabulary. Lead source ids match what the
// connectors write: lead_intake "website", calcom_webhook "cal.com",
// shopify_webhook "shopify".
import type { Contact, Membership, PreferredContact } from "../types";

export const PREFERRED_CONTACT_CHOICES: Array<{
  id: PreferredContact;
  name: string;
}> = [
  { id: "text", name: "Text" },
  { id: "call", name: "Call" },
  { id: "email", name: "Email" },
];

export const LEAD_SOURCE_CHOICES = [
  { id: "website", name: "Website (thelabfsj.ca)" },
  { id: "facebook", name: "Facebook" },
  { id: "instagram", name: "Instagram" },
  { id: "google", name: "Google" },
  { id: "phone", name: "Phone call or text" },
  { id: "walk-in", name: "Walk-in" },
  { id: "referral", name: "Referral" },
  { id: "cal.com", name: "Cal.com booking" },
  { id: "shopify", name: "Shopify order" },
];

export const MEMBERSHIP_CHOICES: Array<{ id: Membership; name: string }> = [
  { id: "monthly-signature", name: "The Monthly Signature" },
  { id: "lab-syndicate", name: "The LAB Syndicate" },
];

export const PROVINCE_CHOICES = [
  "BC",
  "AB",
  "SK",
  "MB",
  "ON",
  "QC",
  "NB",
  "NS",
  "PE",
  "NL",
  "YT",
  "NT",
  "NU",
].map((p) => ({ id: p, name: p }));

const nameOf = (
  choices: Array<{ id: string; name: string }>,
  id?: string | null,
): string => (id ? (choices.find((c) => c.id === id)?.name ?? id) : "");

export const leadSourceName = (id?: string | null): string =>
  nameOf(LEAD_SOURCE_CHOICES, id);

export const membershipName = (id?: string | null): string =>
  nameOf(MEMBERSHIP_CHOICES, id);

export const preferredContactName = (id?: string | null): string =>
  nameOf(PREFERRED_CONTACT_CHOICES, id);

/** "Fort St. John, BC" or "" */
export const customerPlace = (
  contact: Pick<Contact, "city" | "province">,
): string => [contact.city, contact.province].filter(Boolean).join(", ");
