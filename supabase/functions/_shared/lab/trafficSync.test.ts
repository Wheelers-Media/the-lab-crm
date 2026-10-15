// @vitest-environment node
// The traffic sync end to end: Shopify's report answers in, daily rows out,
// through the real function over an in-memory database.
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
vi.mock("../authentication.ts", () => ({
  AuthMiddleware: (req: Request, next: (r: Request) => Promise<Response>) =>
    next(req),
  UserMiddleware: (req: Request, next: (r: Request) => Promise<Response>) =>
    next(req),
}));
vi.mock("jsr:@supabase/functions-js/edge-runtime.d.ts", () => ({}));

import { TestDb } from "./testDb";

type Handler = (req: Request) => Promise<Response>;
let sync: Handler;
const env: Record<string, string> = { SHOPIFY_SHOP: "xr6pmx-y0" };
const SHOP = "xr6pmx-y0.myshopify.com";

beforeAll(async () => {
  let serve: Handler | undefined;
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (handler: Handler) => {
      serve = handler;
    },
  });
  await import("../../traffic_sync/index.ts");
  sync = serve!;
});

beforeEach(() => {
  state.db = new TestDb();
  state.db.add("shop_connections", { shop: SHOP, access_token: "test-token" });
});

const call = () =>
  sync(
    new Request("https://x.test/traffic_sync", { method: "POST", body: "{}" }),
  );

const columns = [
  "day",
  "referrer_source",
  "referrer_name",
  "session_device_type",
  "sessions",
  "sessions_with_cart_additions",
  "sessions_that_reached_checkout",
  "sessions_that_completed_checkout",
].map((name) => ({ name }));

const answer = (rows: unknown[][], parseErrors: string[] = []) => ({
  data: {
    shopifyqlQuery: {
      parseErrors,
      tableData: parseErrors.length ? null : { columns, rows },
    },
  },
});

const today = new Date().toISOString().slice(0, 10);

/** Stubs Shopify: each answer is given the ShopifyQL it was asked. */
const stubShopify = (reply: (query: string) => unknown) => {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const { variables } = JSON.parse(init.body);
      asked.push(variables.q);
      return new Response(JSON.stringify(reply(variables.q)), { status: 200 });
    }),
  );
  return asked;
};

describe("traffic_sync", () => {
  it("reaches back two years the first time and saves each day, referrer and device", async () => {
    const asked = stubShopify((query) =>
      query.includes("UNTIL today")
        ? answer([
            [today, "social", "facebook", "mobile", "3", "1", "1", "0"],
            [today, "direct", "", "desktop", "5", "2", "1", "1"],
          ])
        : answer([]),
    );

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ synced: 2, days: 760 });
    expect(asked).toHaveLength(9);
    expect(asked[0]).toContain("SINCE -91d UNTIL today");
    expect(asked[8]).toContain("SINCE -827d UNTIL -736d");
    const rows = state.db.table("shop_traffic_daily");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.referrer_name === "facebook")).toMatchObject({
      day: today,
      device_type: "mobile",
      sessions: 3,
      cart_sessions: 1,
      checkout_sessions: 1,
      completed_sessions: 0,
      synced_at: expect.any(String),
    });
  });

  it("only asks for the recent days once traffic is held, and updates rather than repeats", async () => {
    const asked = stubShopify(() =>
      answer([[today, "direct", "", "mobile", "7", "1", "1", "1"]]),
    );

    await call();
    asked.length = 0;
    const second = await call();

    expect(await second.json()).toEqual({ synced: 1, days: 8 });
    expect(asked).toHaveLength(1);
    expect(state.db.table("shop_traffic_daily")).toHaveLength(1);
  });

  it("asks for the next page when a page comes back full", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => [
      today,
      "unknown",
      `site-${i}`,
      "mobile",
      "1",
      "0",
      "0",
      "0",
    ]);
    state.db.add("shop_traffic_daily", { day: today });
    const asked = stubShopify((query) =>
      query.includes("OFFSET 0") ? answer(full) : answer([]),
    );

    const res = await call();

    expect(await res.json()).toMatchObject({ synced: 1000 });
    expect(asked.map((q) => q.match(/OFFSET (\d+)/)![1])).toEqual([
      "0",
      "1000",
    ]);
  });

  it("says what to do when the saved approval has no report access, without asking Shopify", async () => {
    state.db = new TestDb();
    state.db.add("shop_connections", {
      shop: SHOP,
      access_token: "test-token",
      scope: "write_draft_orders,read_products,read_customers",
    });
    const asked = stubShopify(() => answer([]));

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "needs_scope" });
    expect(asked).toHaveLength(0);
  });

  it("goes ahead when the saved approval includes report access", async () => {
    state.db = new TestDb();
    state.db.add("shop_connections", {
      shop: SHOP,
      access_token: "test-token",
      scope: "read_products,read_reports",
    });
    stubShopify(() => answer([]));

    const res = await call();

    expect(res.status).toBe(200);
  });

  it("reports a report Shopify cannot read in words a person can act on", async () => {
    stubShopify(() => answer([], ["Column Not Found: Column 'sessionz'"]));

    const res = await call();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).toContain(
      "Shopify could not read the traffic report",
    );
  });

  it("names the missing permission when Shopify refuses the query", async () => {
    stubShopify(() => ({
      errors: [
        {
          message:
            "Access denied for shopifyqlQuery field. Required access: `read_reports` access scope.",
        },
      ],
    }));

    const res = await call();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).toContain("read_reports");
  });

  it("asks to connect Shopify first when the CRM has no token", async () => {
    state.db = new TestDb();
    stubShopify(() => answer([]));

    const res = await call();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "not_connected" });
  });
});
