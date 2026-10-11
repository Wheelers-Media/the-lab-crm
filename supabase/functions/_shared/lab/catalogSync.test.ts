// @vitest-environment node
// The catalog sync end to end: Shopify's real answers in, catalog rows out,
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

import { archivedBulbs, polarExhaust } from "./shopifyFixtures";
import { TestDb } from "./testDb";

type Handler = (req: Request) => Promise<Response>;
let sync: Handler;
const env: Record<string, string> = { SHOPIFY_SHOP: "xr6pmx-y0" };

beforeAll(async () => {
  let serve: Handler | undefined;
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (handler: Handler) => {
      serve = handler;
    },
  });
  await import("../../catalog_sync/index.ts");
  sync = serve!;
});

beforeEach(() => {
  state.db = new TestDb();
  state.db.add("shop_connections", {
    shop: "xr6pmx-y0.myshopify.com",
    access_token: "test-token",
  });
});

const call = () =>
  sync(
    new Request("https://x.test/catalog_sync", { method: "POST", body: "{}" }),
  );

/** Stubs Shopify: each answer is given the query it was asked and the cursor. */
const stubShopify = (
  answer: (query: string, cursor: string | null) => Record<string, unknown>,
) => {
  const asked: Array<{ query: string; cursor: string | null }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const { query, variables } = JSON.parse(init.body);
      asked.push({ query, cursor: variables.cursor });
      return new Response(JSON.stringify(answer(query, variables.cursor)), {
        status: 200,
      });
    }),
  );
  return asked;
};

const page = (nodes: unknown[], next: string | null) => ({
  data: {
    products: {
      pageInfo: { hasNextPage: next != null, endCursor: next },
      nodes,
    },
  },
});

describe("catalog_sync", () => {
  it("pages through the store and saves every product with its details, cost included", async () => {
    const asked = stubShopify((_q, cursor) =>
      cursor ? page([archivedBulbs], null) : page([polarExhaust], "page-2"),
    );

    const res = await call();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      synced: 2,
      costAvailable: true,
      withCost: 1,
    });
    expect(asked.map((a) => a.cursor)).toEqual([null, "page-2"]);
    const rows = state.db.table("packages");
    expect(rows).toHaveLength(2);
    const exhaust = rows.find((r) => r.shopify_product_id === "7466040983646")!;
    expect(String(exhaust.description)).toContain(
      "• Standard muffler included",
    );
    expect(exhaust.images).toHaveLength(2);
    expect(exhaust.tags).toContain("Shipping: Exhaust");
    expect(exhaust.synced_at).toEqual(expect.any(String));
  });

  it("updates what is already there instead of adding it twice", async () => {
    stubShopify(() => page([polarExhaust], null));

    await call();
    await call();

    expect(state.db.table("packages")).toHaveLength(1);
  });

  it("still syncs when the app may not read cost, and says so", async () => {
    const asked = stubShopify((query) =>
      query.includes("inventoryItem")
        ? {
            errors: [
              {
                message:
                  "Access denied for inventoryItem field. Required access: `read_inventory` access scope.",
              },
            ],
          }
        : page(
            [
              {
                ...polarExhaust,
                variants: {
                  nodes: [
                    {
                      ...polarExhaust.variants.nodes[0],
                      inventoryItem: undefined,
                    },
                  ],
                },
              },
            ],
            null,
          ),
    );

    const res = await call();

    expect(await res.json()).toEqual({
      synced: 1,
      costAvailable: false,
      withCost: 0,
    });
    expect(asked).toHaveLength(2);
    expect(asked[1].query).not.toContain("inventoryItem");
    expect(state.db.table("packages")[0].price).toBe(1083);
  });

  it("asks to connect Shopify first when the CRM has no token", async () => {
    state.db = new TestDb();
    stubShopify(() => page([], null));

    const res = await call();

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "not_connected" });
  });

  it("reports a Shopify failure in words a person can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: "Invalid API key" }), {
            status: 401,
          }),
      ),
    );

    const res = await call();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).toContain(
      "Shopify refused the request",
    );
  });
});
