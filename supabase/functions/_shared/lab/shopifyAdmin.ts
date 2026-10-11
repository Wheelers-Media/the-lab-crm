// Talking to the Shopify Admin API from the edge functions: the store's
// domain, the access token (saved by "Connect Shopify", else the app's client
// credentials) and one GraphQL call that turns Shopify's refusals into
// messages a CRM user can act on.
import { supabaseAdmin } from "../supabaseAdmin.ts";

const API_VERSION = "2025-10";

/** A failure whose message is safe and useful to show the CRM user. */
export class ShopifyFailure extends Error {}

/** One Admin GraphQL call; throws a ShopifyFailure the CRM user can act on. */
export const shopifyGraphql = async (
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
  // What the app must be allowed to do, for the "refused" message
  scopes = "write_draft_orders and write_customers",
) => {
  const res = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    const detail = Array.isArray(body.errors)
      ? body.errors.map((e: { message?: string }) => e.message).join("; ")
      : typeof body.errors === "string"
        ? body.errors
        : JSON.stringify(body.errors ?? body).slice(0, 200);
    throw new ShopifyFailure(
      res.status === 401 ||
        res.status === 403 ||
        /access denied|scope/i.test(detail)
        ? `Shopify refused the request (${detail}). The app needs the ${scopes} scopes, released and approved on the store.`
        : `Shopify error ${res.status}: ${detail}`,
    );
  }
  return body.data;
};

/** "https://xr6pmx-y0.myshopify.com/" or "xr6pmx-y0" -> "xr6pmx-y0.myshopify.com" */
export const shopDomain = (raw: string) => {
  const host = raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return host.includes(".") ? host : `${host}.myshopify.com`;
};

// Client credentials tokens last 24 hours; reuse one until shortly before it ends
let cachedToken: { value: string; expiresAt: number } | null = null;

export const adminAccessToken = async (
  shop: string,
): Promise<string | null> => {
  const fixed = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
  if (fixed) return fixed;
  // The permanent token saved by "Connect Shopify" (shopify_connect)
  const { data: connection } = await supabaseAdmin
    .from("shop_connections")
    .select("access_token")
    .eq("shop", shop)
    .maybeSingle();
  if (connection?.access_token) return connection.access_token;
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now())
    return cachedToken.value;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const said =
      body.error_description ??
      body.error ??
      body.errors ??
      (Object.keys(body).length ? JSON.stringify(body) : "no reason given");
    throw new ShopifyFailure(
      `Shopify would not sign the CRM in (${res.status}: ${typeof said === "string" ? said : JSON.stringify(said)}). Connect the store once by opening ${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify_connect while signed in to Shopify.`,
    );
  }
  const lifetime = (Number(body.expires_in) || 86399) * 1000;
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + lifetime - 10 * 60 * 1000,
  };
  return cachedToken.value;
};
