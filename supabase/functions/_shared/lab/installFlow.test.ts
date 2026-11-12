// @vitest-environment node
// End to end: a paid power package order that ships to the shop opens a job in
// "Parts on the way", and the customer's Cal.com install booking moves it on.
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

const installOrder = (attributes: Array<{ name: string; value: string }>) => ({
  id: 7001,
  name: "#2001",
  email: "sam@x.com",
  financial_status: "paid",
  subtotal_price: "5200.00",
  total_price: "5200.00",
  currency: "CAD",
  source_name: "web",
  processed_at: new Date().toISOString(),
  customer: { first_name: "Sam", last_name: "Doe", email: "sam@x.com" },
  line_items: [
    { name: "Downpipe", quantity: 1, price: "1200.00" },
    { name: "Tuner", quantity: 2, price: "2000.00" },
  ],
  note_attributes: attributes,
});

const INSTALL = [
  { name: "Fulfilment", value: "Ship to THE LAB, install at THE LAB" },
  { name: "Build", value: "2023-2026 Powerstroke" },
  { name: "VIN", value: "1ftfw1e50nfa00001" },
];

describe("a power package order that ships to the shop", () => {
  it("opens a job in Parts on the way with the build, VIN and parts", async () => {
    const db = state.db;

    const res = await postShopify("orders/paid", installOrder(INSTALL));

    expect(res.status).toBe(200);
    expect(db.table("deals")).toHaveLength(1);
    const deal = db.table("deals")[0];
    expect(deal.stage).toBe("parts_on_the_way");
    expect(deal.name).toBe("Install: 2023-2026 Powerstroke");
    const description = String(deal.description);
    expect(description).toContain("VIN: 1FTFW1E50NFA00001");
    expect(description).toContain("- Downpipe");
    expect(description).toContain("- 2 x Tuner");
    expect(db.table("orders")[0].deal_id).toBe(deal.id);
  });

  it("asks for no deposit", async () => {
    const db = state.db;

    await postShopify("orders/paid", installOrder(INSTALL));

    expect(db.table("tasks")).toHaveLength(0);
  });

  it("does not open an install job for an order shipping to the customer", async () => {
    const db = state.db;

    await postShopify(
      "orders/paid",
      installOrder([{ name: "Fulfilment", value: "Ship to customer" }]),
    );

    expect(db.table("deals")).toHaveLength(0);
  });

  it("opens one job when Shopify delivers the same order twice", async () => {
    const db = state.db;

    await postShopify("orders/paid", installOrder(INSTALL));
    await postShopify("orders/create", installOrder(INSTALL));

    expect(db.table("deals")).toHaveLength(1);
  });

  it("moves to Booked when the customer picks an install day", async () => {
    const db = state.db;
    await postShopify("orders/paid", installOrder(INSTALL));
    db.table("deals")[0].stage = "ready_to_book";

    const res = await postCal("BOOKING_CREATED", {
      uid: "uid-install",
      type: "eric-services",
      title: "Install between Sam Doe and THE LAB",
      startTime: inDays(6),
      endTime: inDays(7),
      attendees: [{ email: "sam@x.com", name: "Sam Doe" }],
      responses: { name: { value: "Sam Doe" }, email: { value: "sam@x.com" } },
    });

    expect(res.status).toBe(200);
    expect(db.table("deals")).toHaveLength(1);
    expect(db.table("deals")[0].stage).toBe("booked");
  });
});
