import { useRecordContext } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";

import type { Contact } from "../types";
import { contactDisplayName } from "./shopFormat";

const ContactName = () => {
  const contact = useRecordContext<Contact>();
  return contact ? (
    <span className="underline">{contactDisplayName(contact)}</span>
  ) : null;
};

/**
 * Links the current row's `contact_id` to the contact page, or shows
 * `fallback` (a name or email from Shopify) when no contact is linked.
 */
export const ContactLink = ({ fallback }: { fallback?: string | null }) => {
  const record = useRecordContext<{ contact_id?: unknown }>();
  if (record?.contact_id == null) {
    return <span className="text-muted-foreground">{fallback || "—"}</span>;
  }
  return (
    <ReferenceField source="contact_id" reference="contacts" link="show">
      <ContactName />
    </ReferenceField>
  );
};
