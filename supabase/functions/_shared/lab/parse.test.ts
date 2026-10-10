// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  categorizeLines,
  formatPhone,
  orderNoteText,
  parseAmount,
  parseCalBooking,
  parseShopifyCheckout,
  parseShopifyOrder,
  parseWebsiteLead,
  serviceToCategory,
  websiteDealName,
} from "./parse";

describe("formatPhone", () => {
  it("formats 10-digit and +1 numbers the same way", () => {
    expect(formatPhone("2502619502")).toBe("(250) 261-9502");
    expect(formatPhone("+1 250-261-9502")).toBe("(250) 261-9502");
  });

  it("returns empty for numbers that are not North American", () => {
    expect(formatPhone("12345")).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});

describe("parseAmount", () => {
  it("reads estimate strings with currency and thousands separators", () => {
    expect(parseAmount("$1,240.50 CAD")).toBe(1240.5);
    expect(parseAmount("from $850")).toBe(850);
    expect(parseAmount("")).toBe(0);
  });
});

describe("parseWebsiteLead", () => {
  const base = {
    form: "boutique",
    intent: "quote",
    service: "Window Tinting",
    first: "jamie",
    last: "croft",
    email: "Jamie@Example.com ",
    phone: "250 555 0123",
    year: "2022",
    make: "Ford",
    model: "F-350",
    estimate: { total: "$850 CAD" },
    sms_consent: true,
  };

  it("keeps the vehicle's year, make and model apart for the customer's profile", () => {
    const result = parseWebsiteLead({
      ...base,
      make: "ram",
      model: "3500 Laramie",
      vin: "3c63r3hl1ng123456",
    });
    expect(result.ok && result.value.vehicleParts).toEqual({
      year: 2022,
      make: "Ram",
      model: "3500 Laramie",
    });
    expect(result.ok && result.value.vin).toBe("3C63R3HL1NG123456");
    expect(result.ok && result.value.vehicle).toBe("2022 Ram 3500 Laramie");
  });

  it("keeps the priced lines, choices and summary of the website quote", () => {
    const result = parseWebsiteLead({
      ...base,
      estimate: {
        total: "$440 CAD",
        lines: [
          { label: "Ceramic front roll-ups", price: "$260" },
          { label: "Windshield brow (1-piece)", price: "$180" },
          { label: "", price: "$5" },
        ],
      },
      details:
        "Tint Shade Preference: 18%\nWindow Tint Preference: Premium Ceramic",
      summary: "Ceramic fronts and a brow",
      source: "quote",
    });
    expect(result.ok && result.value.quote).toEqual({
      total: "$440 CAD",
      lines: [
        { label: "Ceramic front roll-ups", price: 260, priceText: "$260" },
        { label: "Windshield brow (1-piece)", price: 180, priceText: "$180" },
      ],
      choices: [
        { label: "Tint Shade Preference", value: "18%" },
        { label: "Window Tint Preference", value: "Premium Ceramic" },
      ],
      summary: "Ceramic fronts and a brow",
      source: "quote",
      page: "",
    });
  });

  it("still files requests from the older form with only a total", () => {
    const result = parseWebsiteLead(base);
    expect(result.ok && result.value.quote).toMatchObject({
      total: "$850 CAD",
      lines: [],
      source: "form",
    });
  });

  it("drops a year that is not a real model year", () => {
    const result = parseWebsiteLead({ ...base, year: "22" });
    expect(result.ok && result.value.vehicleParts.year).toBeNull();
  });

  it("normalizes contact details and maps the service to a deal category", () => {
    const result = parseWebsiteLead(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contact).toEqual({
      email: "jamie@example.com",
      phone: "(250) 555-0123",
      firstName: "Jamie",
      lastName: "Croft",
    });
    expect(result.value.category).toBe("window-tint");
    expect(result.value.estimateTotal).toBe(850);
    expect(websiteDealName(result.value)).toBe(
      "Window Tinting - 2022 Ford F-350",
    );
  });

  it("rejects submissions that filled the hidden honeypot field", () => {
    expect(parseWebsiteLead({ ...base, website: "spam.example" })).toEqual({
      ok: false,
      error: "Rejected",
    });
  });

  it("requires an email or phone number", () => {
    const result = parseWebsiteLead({
      ...base,
      email: "not-an-email",
      phone: "",
    });
    expect(result.ok).toBe(false);
  });

  it("treats parts and tuning requests as quotes even if they ask to book", () => {
    const result = parseWebsiteLead({
      ...base,
      form: "build",
      intent: "book",
      service: "Custom Tuning, Exhaust Systems",
    });
    expect(result.ok && result.value.intent).toBe("quote");
    expect(result.ok && result.value.category).toBe("tuning");
  });
});

describe("serviceToCategory", () => {
  it("maps each website service to a CRM category", () => {
    expect(serviceToCategory("Premium Detailing")).toBe("detailing");
    expect(serviceToCategory("Custom Lighting")).toBe("lighting");
    expect(serviceToCategory("Other / Custom Install")).toBe("install");
    expect(serviceToCategory("Exhaust Systems")).toBe("diesel-parts");
  });
});

describe("categorizeLines", () => {
  it("tags orders by what was bought and ignores supplies and shipping", () => {
    expect(
      categorizeLines([
        "Universal Fit - THE LAB - De-Luxx Interior Detail 5-6 Seater",
        "18% Suntek Carbon Tint",
        "Shop Supplies",
        "Shipping",
      ]),
    ).toEqual(["Detailing", "Tint"]);
  });

  it("sorts memberships, Signature packages and ozone into Detailing", () => {
    for (const name of [
      "THE LAB - The Monthly Signature Membership (1 Month)",
      "Standard Signature (Small SUV/Truck)",
      "Universal Fit - THE LAB - Odour Elimination (Ozone)",
    ]) {
      expect(categorizeLines([name])).toEqual(["Detailing"]);
    }
  });

  it("files a light truck tire rotation as Mechanical, not Lighting", () => {
    expect(
      categorizeLines([
        "Universal Fit - THE LAB - Light Truck tire rotation (LTR)",
      ]),
    ).toEqual(["Mechanical"]);
    expect(categorizeLines(["20 inch LED Light Bar - Combo beam"])).toEqual([
      "Lighting",
    ]);
  });
});

describe("parseShopifyOrder", () => {
  const payload = {
    id: 5550001,
    name: "#1801",
    email: "Pat@Example.com",
    financial_status: "paid",
    source_name: "web",
    total_price: "50.00",
    subtotal_price: "50.00",
    currency: "CAD",
    created_at: "2026-10-09T10:00:00-06:00",
    checkout_token: "abc",
    customer: { first_name: "pat", last_name: "lee", phone: "+12505550199" },
    line_items: [
      { name: "$50 Secure Booking Deposit", quantity: 1, price: "50.00" },
    ],
    refunds: [],
  };

  it("detects the booking deposit and reads the customer", () => {
    const result = parseShopifyOrder(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isDeposit).toBe(true);
    expect(result.value.total).toBe(50);
    expect(result.value.contact.email).toBe("pat@example.com");
    expect(result.value.contact.phone).toBe("(250) 555-0199");
    expect(orderNoteText(result.value)).toContain(
      "**Shopify order #1801** - Online store - $50.00 paid",
    );
  });

  it("adds up refunds", () => {
    const result = parseShopifyOrder({
      ...payload,
      refunds: [{ transactions: [{ amount: "20.00" }, { amount: "5" }] }],
    });
    expect(result.ok && result.value.refundedAmount).toBe(25);
  });
});

describe("parseShopifyCheckout", () => {
  it("needs a checkout token", () => {
    expect(parseShopifyCheckout({ total_price: "10" }).ok).toBe(false);
    const result = parseShopifyCheckout({
      token: "t1",
      total_price: "2640.00",
      email: "a@b.co",
    });
    expect(result.ok && result.value.total).toBe(2640);
  });
});

describe("parseCalBooking", () => {
  const body = {
    triggerEvent: "BOOKING_CREATED",
    payload: {
      uid: "uid-1",
      type: "detailing-drop-off",
      title: "Detailing Drop-off between Sam Doe and THE LAB",
      startTime: "2026-10-13T14:00:00Z",
      endTime: "2026-10-13T18:00:00Z",
      attendees: [{ email: "sam@example.com", name: "Sam Doe" }],
      responses: {
        name: { value: "sam doe" },
        email: { value: "Sam@Example.com" },
        attendeePhoneNumber: { value: "+1 250 555 0144" },
        notes: { value: "2019 Tahoe, heavy pet hair" },
      },
    },
  };

  it("puts detailing drop-offs in the detailing bay and reads the customer", () => {
    const result = parseCalBooking(body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resource).toBe("detailing-bay");
    expect(result.value.category).toBe("detailing");
    expect(result.value.contact).toEqual({
      email: "sam@example.com",
      phone: "(250) 555-0144",
      firstName: "Sam",
      lastName: "Doe",
    });
    expect(result.value.notes).toBe("2019 Tahoe, heavy pet hair");
  });

  it("sends other event types to Eric", () => {
    const result = parseCalBooking({
      ...body,
      payload: {
        ...body.payload,
        type: "eric-services",
        title: "Ceramic tint consult",
      },
    });
    expect(result.ok && result.value.resource).toBe("eric");
  });
});
