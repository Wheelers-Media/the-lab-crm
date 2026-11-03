import { describe, expect, it } from "vitest";

import {
  bookingCustomerErrors,
  contactForBooking,
  isNewCustomer,
  NEW_CUSTOMER_DEFAULTS,
} from "./bookingContact";

describe("isNewCustomer", () => {
  it("is off unless the form says the customer is new", () => {
    expect(isNewCustomer(NEW_CUSTOMER_DEFAULTS)).toBe(false);
    expect(isNewCustomer({ contact_id: 7 } as never)).toBe(false);
    expect(isNewCustomer({ new_customer: true })).toBe(true);
  });
});

describe("bookingCustomerErrors", () => {
  it("asks for the name only when the customer is new", () => {
    expect(bookingCustomerErrors({ new_customer: false })).toEqual({});
    expect(
      bookingCustomerErrors({
        new_customer: true,
        customer_first_name: "  ",
        customer_last_name: "",
      }),
    ).toEqual({
      customer_first_name: "Add the customer's first name",
      customer_last_name: "Add the customer's last name",
    });
  });

  it("is happy with just a first and last name", () => {
    expect(
      bookingCustomerErrors({
        new_customer: true,
        customer_first_name: "Sam",
        customer_last_name: "Wheeler",
        customer_phone: "",
      }),
    ).toEqual({});
  });
});

describe("contactForBooking", () => {
  it("saves the name and number Eric typed", () => {
    const contact = contactForBooking(
      {
        new_customer: true,
        customer_first_name: " Sam ",
        customer_last_name: "Wheeler",
        customer_phone: " 250-555-0134 ",
      },
      3,
    );

    expect(contact).toMatchObject({
      first_name: "Sam",
      last_name: "Wheeler",
      phone_jsonb: [{ number: "250-555-0134", type: "Work" }],
      preferred_contact: "text",
      province: "BC",
      lead_source: "phone",
      sms_consent: false,
      sales_id: 3,
    });
    expect(contact.email_jsonb).toBeNull();
    expect(contact.sms_consent_at).toBeNull();
  });

  it("copes with a booking taken without a number", () => {
    const contact = contactForBooking({
      new_customer: true,
      customer_first_name: "Sam",
      customer_last_name: "Wheeler",
      customer_phone: "   ",
    });

    expect(contact.phone_jsonb).toBeNull();
  });
});
