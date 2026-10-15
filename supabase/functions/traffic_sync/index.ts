// Copies the store's online traffic (sessions, and how many added to a cart,
// reached checkout and completed it, by day, referrer and device) from
// Shopify's reports into the CRM, for the Traffic section of Numbers.
// Signed-in CRM users only. Needs the Shopify app's read_reports scope; a
// store connected before that scope was added must be approved again.
//
// POST {} -> { synced, days }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import {
  adminAccessToken,
  ShopifyFailure,
  shopDomain,
  shopifyGraphql,
} from "../_shared/lab/shopifyAdmin.ts";
import {
  daysToSync,
  PAGE_ROWS,
  parseTrafficRows,
  trafficQuery,
  windowsFor,
} from "../_shared/lab/shopifyTraffic.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const UPSERT_CHUNK = 500;
// A window of a small store is one page; this only stops a runaway loop
const MAX_PAGES = 20;
const KEY = "day,referrer_source,referrer_name,device_type";

const REPORT = `
query($q: String!) {
  shopifyqlQuery(query: $q) {
    parseErrors
    tableData { columns { name } rows }
  }
}`;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

/** True when the saved approval is known and leaves out report access. */
const lacksReports = async (shop: string): Promise<boolean> => {
  // A token set by hand in the function secrets has no saved approval to read
  if (Deno.env.get("SHOPIFY_ADMIN_TOKEN")) return false;
  const { data } = await supabaseAdmin
    .from("shop_connections")
    .select("scope")
    .eq("shop", shop)
    .maybeSingle();
  const scope = typeof data?.scope === "string" ? data.scope : "";
  if (!scope) return false;
  const held = scope.split(/[\s,]+/);
  return !held.includes("read_reports") && !held.includes("write_reports");
};

const handle = async () => {
  const rawShop = Deno.env.get("SHOPIFY_SHOP");
  const shop = rawShop ? shopDomain(rawShop) : null;
  const token = shop ? await adminAccessToken(shop) : null;
  if (!shop || !token) {
    return createErrorResponse(
      503,
      "The CRM is not connected to Shopify yet.",
      { code: "not_connected" },
    );
  }
  if (await lacksReports(shop)) {
    return createErrorResponse(
      403,
      "Shopify has not given the CRM report access yet. Add the read_reports permission to the Shopify app, release it, then open the Connect Shopify link once and approve.",
      { code: "needs_scope" },
    );
  }

  const { data: newest } = await supabaseAdmin
    .from("shop_traffic_daily")
    .select("day")
    .order("day", { ascending: false })
    .limit(1);
  const days = daysToSync(
    typeof newest?.[0]?.day === "string" ? newest[0].day : null,
    new Date(),
  );

  const syncedAt = new Date().toISOString();
  const rows = [];
  for (let window = 0; window < windowsFor(days); window++) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await shopifyGraphql(
        shop,
        token,
        REPORT,
        { q: trafficQuery(window, page * PAGE_ROWS) },
        "read_reports",
      );
      const report = data?.shopifyqlQuery;
      if (report?.parseErrors?.length) {
        throw new ShopifyFailure(
          `Shopify could not read the traffic report: ${report.parseErrors.join("; ")}`,
        );
      }
      rows.push(...parseTrafficRows(report?.tableData));
      if ((report?.tableData?.rows?.length ?? 0) < PAGE_ROWS) break;
    }
  }

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabaseAdmin.from("shop_traffic_daily").upsert(
      rows
        .slice(i, i + UPSERT_CHUNK)
        .map((row) => ({ ...row, synced_at: syncedAt })),
      { onConflict: KEY },
    );
    if (error) throw new Error(`save traffic: ${error.message}`);
  }
  return json({ synced: rows.length, days });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await handle();
        } catch (error) {
          console.error("traffic_sync failed:", error);
          return createErrorResponse(
            500,
            error instanceof ShopifyFailure
              ? error.message
              : `Could not sync traffic: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    ),
  ),
);
