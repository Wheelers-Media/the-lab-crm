// A booking can be for someone who is not in the CRM yet: Eric takes a phone
// call, types the name and number, and the appointment saves the customer
// along with it. These helpers keep that customer in the shape ContactCreate
// saves, so a phone booking's profile looks like any other.
import type { Identifier } from "ra-core";

import { cleanupContactForCreate } from "../contacts/contactModel";
import type { Contact } from "../types";

export interface NewCustomerFields {
  /** True when the booking is for someone not in the CRM yet. */
  new_customer?: boolean;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
}

/** What the booking form starts with, so both modes have their fields. */
export const NEW_CUSTOMER_DEFAULTS: Required<NewCustomerFields> = {
  new_customer: false,
  customer_first_name: "",
  customer_last_name: "",
  customer_phone: "",
};

export const isNewCustomer = (values: NewCustomerFields): boolean =>
  values.new_customer === true;

/** Name errors for a new customer, in the form's own field names. */
export const bookingCustomerErrors = (
  values: NewCustomerFields,
): Record<string, string> => {
  if (!isNewCustomer(values)) return {};
  const errors: Record<string, string> = {};
  if (!values.customer_first_name?.trim()) {
    errors.customer_first_name = "Add the customer's first name";
  }
  if (!values.customer_last_name?.trim()) {
    errors.customer_last_name = "Add the customer's last name";
  }
  return errors;
};

/**
 * The customer a booking creates. A phone booking is text-first and in BC, and
 * carries no text consent: the customer has not said yes to job texts yet.
 */
export const contactForBooking = (
  values: NewCustomerFields,
  salesId?: Identifier,
): Partial<Contact> => {
  const phone = values.customer_phone?.trim();
  return cleanupContactForCreate({
    first_name: values.customer_first_name?.trim() ?? "",
    last_name: values.customer_last_name?.trim() ?? "",
    email_jsonb: [],
    phone_jsonb: phone ? [{ number: phone, type: "Work" as const }] : [],
    preferred_contact: "text",
    province: "BC",
    lead_source: "phone",
    sms_consent: false,
    sales_id: salesId,
  } as unknown as Contact) as Partial<Contact>;
};
