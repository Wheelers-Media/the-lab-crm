// @vitest-environment node
// End to end: a $50 Shopify deposit and a Cal.com booking find each other, in
// either order, through the real webhook handlers over an in-memory database.
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
const CAL_SECRET = "cal-test-secret";

type Handler = (req: Request) => Promise<Response>;
let shopify: Handler;
let calcom: Handler;

beforeAll(async () => {
  const env: Record<string, string> = {
    SHOPIFY_WEBHOOK_SECRET: SHOPIFY_SECRET,
    CALCOM_WEBHOOK_SECRET: CAL_SECRET,
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
  await import("../../calcom_webhook/index.ts");
  calcom = serve!;
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
        "x-shopify-webhook-id": `hook-${++webhookSeq}`,
      },
      body: raw,
    }),
  );
};
const postCal = (triggerEvent: string, payload: Record<string, unknown>) => {
  const raw = JSON.stringify({ triggerEvent, payload });
  return calcom(
    new Request("https://x.test/calcom_webhook", {
      method: "POST",
      headers: {
        "x-cal-signature-256": createHmac("sha256", CAL_SECRET)
          .update(raw)
          .digest("hex"),
      },
      body: raw,
    }),
  );
};

const inDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString();

const depositOrder = (first: string, last: string, email: string) => ({
  id: 9001,
  name: "#1001",
  email,
  financial_status: "paid",
  subtotal_price: "50.00",
  total_price: "50.00",
  currency: "CAD",
  source_name: "web",
  processed_at: new Date().toISOString(),
  customer: { first_name: first, last_name: last, email },
  line_items: [{ name: "Secure Booking Deposit", quantity: 1, price: "50.00" }],
});

const calBooking = (uid: string, name: string, email: string, extra = {}) => ({
  uid,
  type: "detailing-drop-off",
  title: `Detailing Drop-off between ${name} and THE LAB`,
  startTime: inDays(5),
  endTime: inDays(5),
  attendees: [{ email, name }],
  responses: { name: { value: name }, email: { value: email } },
  ...extra,
});

const customer = (db: TestDbType, id: number, name: string, email: string) => {
  const [first_name, ...rest] = name.split(" ");
  return db.add("contacts", {
    id,
    first_name,
    last_name: rest.join(" "),
    email_jsonb: [{ email, type: "Home" }],
    phone_jsonb: [],
    tags: [],
  });
};

/** A customer with a booked, unpaid appointment on a job in Booked. */
const bookedCustomer = (
  db: TestDbType,
  {
    id,
    name,
    email,
    dealId,
  }: { id: number; name: string; email: string; dealId: number },
) => {
  customer(db, id, name, email);
  db.add("deals", {
    id: dealId,
    name: "Detailing",
    stage: "booked",
    contact_ids: [id],
    archived_at: null,
  });
  return db.add("appointments", {
    id: dealId,
    contact_id: id,
    deal_id: dealId,
    status: "booked",
    deposit_paid: false,
    start_at: inDays(3),
  });
};

describe("a Shopify deposit arrives for a booking", () => {
  it("marks the customer's own booking paid and moves its job to Converted", async () => {
    const db = state.db;
    bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });

    const res = await postShopify(
      "orders/paid",
      depositOrder("Sam", "Doe", "sam@x.com"),
    );

    expect(res.status).toBe(200);
    expect(db.table("appointments")[0].deposit_paid).toBe(true);
    expect(db.table("deals")[0].stage).toBe("won");
    expect(db.table("orders")[0]).toMatchObject({
      appointment_id: db.table("appointments")[0].id,
      deal_id: 5,
      contact_id: 1,
    });
    expect(db.table("tasks")).toHaveLength(0);
  });

  it("finds the booking by name when the deposit was paid with another email, without making a second customer", async () => {
    const db = state.db;
    bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });

    await postShopify(
      "orders/paid",
      depositOrder("sam", "doe", "sam.work@y.com"),
    );

    expect(db.table("contacts")).toHaveLength(1);
    expect(db.table("contacts")[0].email_jsonb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: "sam.work@y.com" }),
      ]),
    );
    expect(db.table("appointments")[0].deposit_paid).toBe(true);
    expect(db.table("orders")[0]).toMatchObject({
      appointment_id: db.table("appointments")[0].id,
      contact_id: 1,
    });
    const note = db
      .table("deal_notes")
      .map((n) => String(n.text))
      .join("\n");
    expect(note).toContain("by the customer's name");
  });

  it("asks a person when nobody booked under that name", async () => {
    const db = state.db;
    bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });

    await postShopify("orders/paid", depositOrder("Pat", "Lee", "pat@z.com"));

    expect(db.table("appointments")[0].deposit_paid).toBe(false);
    expect(db.table("orders")[0].appointment_id).toBeUndefined();
    expect(db.table("tasks")).toHaveLength(1);
    expect(String(db.table("tasks")[0].text)).toContain(
      "Deposit paid (order #1001) by Pat Lee, but no booking matched",
    );
  });

  it("asks a person when two different customers booked under the same name", async () => {
    const db = state.db;
    bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });
    bookedCustomer(db, {
      id: 2,
      name: "Sam Doe",
      email: "samuel@q.com",
      dealId: 6,
    });

    await postShopify("orders/paid", depositOrder("Sam", "Doe", "payer@z.com"));

    expect(
      db.table("appointments").every((a) => a.deposit_paid === false),
    ).toBe(true);
    expect(String(db.table("tasks")[0].text)).toContain(
      "several bookings share that name",
    );
  });

  it("leaves bookings alone for an order that is not a deposit", async () => {
    const db = state.db;
    bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });
    const order = depositOrder("Sam", "Doe", "sam@x.com");
    order.line_items = [
      { name: "The Lab Gift Card", quantity: 1, price: "50.00" },
    ];

    await postShopify("orders/paid", order);

    expect(db.table("appointments")[0].deposit_paid).toBe(false);
    expect(db.table("deals")[0].stage).toBe("booked");
  });
});

describe("a Cal.com booking is made after the deposit was paid", () => {
  const paidEarlier = (
    db: TestDbType,
    { dealId }: { dealId: number | null },
  ) => {
    customer(db, 2, "Sam Doe", "sam.pay@y.com");
    db.add("orders", {
      id: 1,
      order_number: "#1001",
      contact_id: 2,
      deal_id: dealId,
      is_deposit: true,
      appointment_id: null,
      cancelled_at: null,
      ordered_at: new Date().toISOString(),
    });
    db.add("tasks", {
      contact_id: 2,
      type: "deposit",
      text: "Deposit paid (order #1001) by Sam Doe, but no booking matched. Check which booking it belongs to.",
      done_date: null,
    });
  };

  it("claims the deposit by name: the booking starts paid and the check-it task closes", async () => {
    const db = state.db;
    paidEarlier(db, { dealId: null });

    const res = await postCal(
      "BOOKING_CREATED",
      calBooking("uid-1", "Sam Doe", "sam@x.com"),
    );

    expect(res.status).toBe(200);
    expect(db.table("appointments")[0].deposit_paid).toBe(true);
    expect(db.table("orders")[0].appointment_id).toBe(
      db.table("appointments")[0].id,
    );
    expect(db.table("deals")).toHaveLength(1);
    expect(db.table("deals")[0].stage).toBe("won");
    const orphan = db
      .table("tasks")
      .find((t) => String(t.text).startsWith("Deposit paid"));
    expect(orphan?.done_date).toEqual(expect.any(String));
  });

  it("puts the booking on the job the deposit already converted instead of starting a second job", async () => {
    const db = state.db;
    db.add("deals", {
      id: 7,
      name: "Detailing",
      stage: "won",
      contact_ids: [2],
      archived_at: null,
    });
    paidEarlier(db, { dealId: 7 });

    await postCal(
      "BOOKING_CREATED",
      calBooking("uid-1", "Sam Doe", "sam@x.com"),
    );

    expect(db.table("deals")).toHaveLength(1);
    expect(db.table("appointments")[0]).toMatchObject({
      deal_id: 7,
      deposit_paid: true,
    });
  });

  it("starts a booking unpaid when no deposit is waiting", async () => {
    const db = state.db;

    await postCal(
      "BOOKING_CREATED",
      calBooking("uid-1", "Sam Doe", "sam@x.com"),
    );

    expect(db.table("appointments")[0].deposit_paid).toBe(false);
    expect(db.table("deals")[0].stage).toBe("booked");
  });

  it("does not hand one deposit to a second booking", async () => {
    const db = state.db;
    paidEarlier(db, { dealId: null });

    await postCal(
      "BOOKING_CREATED",
      calBooking("uid-1", "Sam Doe", "sam@x.com"),
    );
    await postCal(
      "BOOKING_CREATED",
      calBooking("uid-2", "Sam Doe", "sam@x.com"),
    );

    const paid = db
      .table("appointments")
      .filter((a) => a.deposit_paid === true);
    expect(db.table("appointments")).toHaveLength(2);
    expect(paid).toHaveLength(1);
  });
});

describe("a paid booking is rescheduled", () => {
  it("keeps the deposit paid on the new time", async () => {
    const db = state.db;
    const old = bookedCustomer(db, {
      id: 1,
      name: "Sam Doe",
      email: "sam@x.com",
      dealId: 5,
    });
    Object.assign(old, { external_id: "uid-1", deposit_paid: true });

    await postCal("BOOKING_RESCHEDULED", {
      ...calBooking("uid-2", "Sam Doe", "sam@x.com"),
      rescheduleUid: "uid-1",
    });

    const rows = db.table("appointments");
    expect(rows.find((a) => a.external_id === "uid-1")?.status).toBe(
      "rescheduled",
    );
    expect(rows.find((a) => a.external_id === "uid-2")).toMatchObject({
      status: "booked",
      deposit_paid: true,
    });
  });
});
