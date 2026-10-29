// @vitest-environment node
// A booking typed into Google Calendar ("Cory Langdon") and the customer
// Shopify makes when he pays: the two records find each other by name, and no
// second customer is made when one is already on the booking.
import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestDb as TestDbType } from "./testDb";

const state = vi.hoisted(() => ({ db: undefined as unknown as TestDbType }));
vi.mock("../supabaseAdmin.ts", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get: (_target, prop) => {
        const value = (state.db as unknown as Record<string, unknown>)[
          prop as string
        ];
        return typeof value === "function" ? value.bind(state.db) : value;
      },
    },
  ),
}));
vi.mock("jsr:@supabase/functions-js/edge-runtime.d.ts", () => ({}));

import { TestDb } from "./testDb";

const SHOPIFY_SECRET = "shopify-test-secret";

type Handler = (req: Request) => Promise<Response>;
let shopify: Handler;

beforeAll(async () => {
  const env: Record<string, string> = {
    SHOPIFY_WEBHOOK_SECRET: SHOPIFY_SECRET,
  };
  let serve: Handler | undefined;
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (handler: Handler) => {
      serve = handler;
    },
  });
  await import("../../shopify_webhook/index.ts");
  shopify = serve!;
});

beforeEach(() => {
  state.db = new TestDb();
  state.db.add("sales", {
    email: "info@luxxautomotiveboutique.com",
    administrator: true,
    disabled: false,
  });
});

let webhookSeq = 0;
const postShopify = (topic: string, body: unknown) => {
  const raw = JSON.stringify(body);
  return shopify(
    new Request("https://x.test/shopify_webhook", {
      method: "POST",
      headers: {
        "x-shopify-hmac-sha256": createHmac("sha256", SHOPIFY_SECRET)
          .update(raw)
          .digest("base64"),
        "x-shopify-topic": topic,
        "x-shopify-webhook-id": `hook-${(webhookSeq += 1)}`,
      },
      body: raw,
    }),
  );
};

// The booking and the payment are on the same shop day
const soon = (minutes = 1) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

const paidOrder = ({
  id,
  number,
  first,
  last,
  email,
  item = "Signature Detail",
  price = "420.00",
}: {
  id: number;
  number: string;
  first: string;
  last: string;
  email: string;
  item?: string;
  price?: string;
}) => ({
  id,
  name: number,
  email,
  financial_status: "paid",
  subtotal_price: price,
  total_price: price,
  currency: "CAD",
  source_name: "web",
  processed_at: new Date().toISOString(),
  customer: { first_name: first, last_name: last, email },
  line_items: [{ name: item, quantity: 1, price }],
});

const booking = (
  db: TestDbType,
  {
    id,
    title,
    contactId = null,
    at = soon(),
  }: { id: number; title: string; contactId?: number | null; at?: string },
) =>
  db.add("appointments", {
    id,
    external_id: `google:${id}`,
    source: "google",
    contact_id: contactId,
    title,
    resource: "detailing-bay",
    start_at: at,
    end_at: new Date(new Date(at).getTime() + 3_600_000).toISOString(),
    status: "booked",
    deposit_paid: false,
  });

const customer = (
  db: TestDbType,
  {
    id,
    first,
    last,
    email,
    phone,
  }: {
    id: number;
    first: string;
    last: string;
    email?: string;
    phone?: string;
  },
) =>
  db.add("contacts", {
    id,
    first_name: first,
    last_name: last,
    email_jsonb: email ? [{ email, type: "Home" }] : [],
    phone_jsonb: phone ? [{ number: phone, type: "Home" }] : [],
    tags: [],
    first_seen: null,
    last_seen: null,
  });

describe("a customer pays on the day of a booking typed into Google", () => {
  it("links the booking to the new customer and the order to the booking", async () => {
    const db = state.db;
    const booked = booking(db, { id: 7, title: "Cory Langdon" });

    const res = await postShopify(
      "orders/paid",
      paidOrder({
        id: 9001,
        number: "#1001",
        first: "Cory",
        last: "Langdon",
        email: "cory@x.com",
      }),
    );

    expect(res.status).toBe(200);
    expect(db.table("contacts")).toHaveLength(1);
    const contact = db.table("contacts")[0];
    expect(contact).toMatchObject({ first_name: "Cory", last_name: "Langdon" });
    expect(db.table("appointments")[0].contact_id).toBe(contact.id);
    expect(db.table("orders")[0]).toMatchObject({
      contact_id: contact.id,
      appointment_id: booked.id,
    });
  });

  it("reads the name out of a title with the job written after it", async () => {
    const db = state.db;
    const booked = booking(db, {
      id: 7,
      title: "Cory Langdon — ceramic coating",
    });

    await postShopify(
      "orders/paid",
      paidOrder({
        id: 9002,
        number: "#1002",
        first: "cory",
        last: "LANGDON",
        email: "cory@x.com",
      }),
    );

    expect(db.table("appointments")[0].contact_id).toBe(
      db.table("contacts")[0].id,
    );
    expect(db.table("orders")[0].appointment_id).toBe(booked.id);
  });

  it("adds a new email to the customer already on the booking instead of making a second one", async () => {
    const db = state.db;
    customer(db, {
      id: 1,
      first: "Cory",
      last: "Langdon",
      email: "cory@old.com",
    });
    const booked = booking(db, { id: 7, title: "Cory Langdon", contactId: 1 });

    await postShopify(
      "orders/paid",
      paidOrder({
        id: 9003,
        number: "#1003",
        first: "Cory",
        last: "Langdon",
        email: "cory@new.com",
      }),
    );

    expect(db.table("contacts")).toHaveLength(1);
    expect(db.table("contacts")[0].email_jsonb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "cory@new.com" }),
      ]),
    );
    expect(db.table("orders")[0]).toMatchObject({
      contact_id: 1,
      appointment_id: booked.id,
    });
  });

  it("marks a deposit paid when it is paid on the day of an unlinked booking", async () => {
    const db = state.db;
    const booked = booking(db, { id: 7, title: "Cory Langdon" });

    await postShopify(
      "orders/paid",
      paidOrder({
        id: 9006,
        number: "#1006",
        first: "Cory",
        last: "Langdon",
        email: "cory@x.com",
        item: "Secure Booking Deposit",
        price: "50.00",
      }),
    );

    expect(db.table("appointments")[0]).toMatchObject({
      contact_id: db.table("contacts")[0].id,
      deposit_paid: true,
    });
    expect(db.table("orders")[0].appointment_id).toBe(booked.id);
    expect(db.table("tasks")).toHaveLength(0);
  });

  it("leaves two bookings under one name alone, but still records the sale", async () => {
    const db = state.db;
    booking(db, { id: 7, title: "Cory Langdon", at: soon(1) });
    booking(db, { id: 8, title: "Cory Langdon", at: soon(2) });

    await postShopify(
      "orders/paid",
      paidOrder({
        id: 9004,
        number: "#1004",
        first: "Cory",
        last: "Langdon",
        email: "cory@x.com",
      }),
    );

    expect(db.table("contacts")).toHaveLength(1);
    expect(db.table("appointments").map((a) => a.contact_id)).toEqual([
      null,
      null,
    ]);
    expect(db.table("orders")[0].appointment_id).toBeUndefined();
  });

  it("does not link a booking on another day", async () => {
    const db = state.db;
    booking(db, {
      id: 7,
      title: "Cory Langdon",
      at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });

    await postShopify(
      "orders/paid",
      paidOrder({
        id: 9005,
        number: "#1005",
        first: "Cory",
        last: "Langdon",
        email: "cory@x.com",
      }),
    );

    expect(db.table("appointments")[0].contact_id).toBeNull();
    expect(db.table("orders")[0].appointment_id).toBeUndefined();
  });
});

describe("a booking typed into Google finds its customer", () => {
  it("by the name in the title", async () => {
    const { resolveCustomerForBooking } = await import("./crm.ts");
    customer(state.db, { id: 1, first: "Cory", last: "Langdon" });

    const found = await resolveCustomerForBooking({
      title: "Cory Langdon",
      phone: null,
    });
    expect(found?.id).toBe(1);
  });

  it("by the phone in the notes when the title is just the job", async () => {
    const { resolveCustomerForBooking } = await import("./crm.ts");
    customer(state.db, {
      id: 1,
      first: "Pat",
      last: "Lee",
      phone: "(306) 555-0134",
    });

    const found = await resolveCustomerForBooking({
      title: "Ceramic coating",
      phone: "(306) 555-0134",
    });
    expect(found?.id).toBe(1);
  });

  it("by the phone when two customers share the name", async () => {
    const { resolveCustomerForBooking } = await import("./crm.ts");
    customer(state.db, { id: 1, first: "Cory", last: "Langdon" });
    customer(state.db, {
      id: 2,
      first: "Cory",
      last: "Langdon",
      phone: "(306) 555-0199",
    });

    expect(
      (await resolveCustomerForBooking({ title: "Cory Langdon", phone: null }))
        ?.id,
    ).toBeUndefined();
    expect(
      (
        await resolveCustomerForBooking({
          title: "Cory Langdon",
          phone: "(306) 555-0199",
        })
      )?.id,
    ).toBe(2);
  });

  it("leaves a first name on its own unlinked", async () => {
    const { resolveCustomerForBooking } = await import("./crm.ts");
    customer(state.db, { id: 1, first: "Cory", last: "Langdon" });

    expect(
      (await resolveCustomerForBooking({ title: "Cory", phone: null }))?.id,
    ).toBeUndefined();
  });
});

describe("a booking for someone the CRM has never seen", () => {
  const START = "2026-10-29T16:00:00Z";

  it("creates the customer from the title and the phone, with a note", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");

    const result = await customerForBooking({
      title: "Justin Beaudoin",
      phone: "(250) 219-5445",
      startAt: START,
    });

    expect(result.kind).toBe("created");
    const [created] = state.db.table("contacts");
    expect(created).toMatchObject({
      first_name: "Justin",
      last_name: "Beaudoin",
      phone_jsonb: [{ number: "(250) 219-5445", type: "Mobile" }],
    });
    expect(state.db.table("contact_notes")[0].text).toContain(
      "Google Calendar booking",
    );
  });

  it("creates the customer from a full name with no phone", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");
    const result = await customerForBooking({
      title: "Chris Burke PPF",
      phone: null,
      startAt: START,
    });
    expect(result.kind).toBe("created");
    expect(state.db.table("contacts")[0]).toMatchObject({
      first_name: "Chris",
      last_name: "Burke",
    });
  });

  it("uses the existing customer instead of making a second one", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");
    customer(state.db, { id: 7, first: "Chris", last: "Burke" });

    const result = await customerForBooking({
      title: "Chris Burke PPF",
      phone: null,
      startAt: START,
    });

    expect(result).toEqual({ kind: "found", id: 7 });
    expect(state.db.table("contacts")).toHaveLength(1);
  });

  it("makes no one when two customers share the name and nothing picks one", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");
    customer(state.db, { id: 1, first: "Cory", last: "Langdon" });
    customer(state.db, { id: 2, first: "Cory", last: "Langdon" });

    const result = await customerForBooking({
      title: "Cory Langdon",
      phone: null,
      startAt: START,
    });

    expect(result.kind).toBe("ambiguous");
    expect(state.db.table("contacts")).toHaveLength(2);
  });

  it("needs a phone before making a customer from a first name alone", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");

    expect(
      (await customerForBooking({ title: "Jude", phone: null, startAt: START }))
        .kind,
    ).toBe("none");
    expect(
      (
        await customerForBooking({
          title: "Jude",
          phone: "(250) 608-6984",
          startAt: START,
        })
      ).kind,
    ).toBe("created");
  });

  it("makes no one from a title that names the vehicle or the job", async () => {
    const { customerForBooking } = await import("./bookingCustomer.ts");
    expect(
      (
        await customerForBooking({
          title: "Dodge detail",
          phone: null,
          startAt: START,
        })
      ).kind,
    ).toBe("none");
  });
});
