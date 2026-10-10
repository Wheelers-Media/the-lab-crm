// One-time "Connect Shopify" for checkout links, using Shopify's standard app
// approval (authorization code grant). It works for any store the person
// approving is an admin of, unlike the client credentials shortcut, which
// only works when the store sits in the same Dev Dashboard organization.
//
// 1. Open this function's URL (or install the app with the legacy install
//    flow, which opens it): it sends you to Shopify to approve the app.
// 2. Shopify sends you back here with a code; the function checks Shopify's
//    signature, trades the code for a permanent store token and saves it in
//    shop_connections, where quote_checkout reads it.
//
// Needs SHOPIFY_SHOP, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET. In the
// Dev Dashboard, this URL must be the app's "Allowed redirection URL".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const SCOPES =
  "write_draft_orders,read_draft_orders,read_products,write_customers,read_customers";
// An approval link stays valid this long
const STATE_TTL_MS = 15 * 60 * 1000;

const text = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const shopDomain = (raw: string) => {
  const host = raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return host.includes(".") ? host : `${host}.myshopify.com`;
};

const hmacHex = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/**
 * Shopify signs every redirect: an HMAC of the query, without "hmac", sorted
 * by key. Accept the signature over the plain or the URL-encoded form.
 */
const shopifySigned = async (url: URL, secret: string) => {
  const hmac = url.searchParams.get("hmac") ?? "";
  const pairs = [...url.searchParams.entries()]
    .filter(([k]) => k !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));
  const plain = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  const encoded = new URLSearchParams(pairs).toString();
  for (const message of new Set([plain, encoded])) {
    if (safeEqual(await hmacHex(secret, message), hmac)) return true;
  }
  return false;
};

/** A state value only this function can make: a time and its signature. */
const makeState = async (secret: string) => {
  const issued = String(Date.now());
  return `${issued}.${await hmacHex(secret, `state:${issued}`)}`;
};

const stateValid = async (state: string, secret: string) => {
  const [issued, sig] = state.split(".");
  if (!issued || !sig) return false;
  if (Date.now() - Number(issued) > STATE_TTL_MS) return false;
  return safeEqual(await hmacHex(secret, `state:${issued}`), sig);
};

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return text(405, "Method Not Allowed");
  const rawShop = Deno.env.get("SHOPIFY_SHOP");
  const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
  const secret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
  if (!rawShop || !clientId || !secret) {
    return text(
      503,
      "Add SHOPIFY_SHOP, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET to the Supabase function secrets first.",
    );
  }
  const shop = shopDomain(rawShop);
  const url = new URL(req.url);
  // Behind Supabase's gateway the function sees an internal URL; Shopify
  // needs the public one it was registered with
  const self = `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify_connect`;
  const code = url.searchParams.get("code");

  if (!code) {
    const authorize = new URL(`https://${shop}/admin/oauth/authorize`);
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("scope", SCOPES);
    authorize.searchParams.set("redirect_uri", self);
    authorize.searchParams.set("state", await makeState(secret));
    return Response.redirect(authorize.toString(), 302);
  }

  const returnedShop = url.searchParams.get("shop") ?? "";
  if (returnedShop !== shop) {
    return text(400, `This connects ${shop} only, not ${returnedShop}.`);
  }
  if (!(await shopifySigned(url, secret))) {
    return text(401, "Shopify's signature did not match. Start again.");
  }
  if (!(await stateValid(url.searchParams.get("state") ?? "", secret))) {
    return text(
      401,
      "This approval link expired or was not started here. Open the connect link again.",
    );
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: secret, code }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    return text(
      502,
      `Shopify did not give a store token (${res.status}): ${JSON.stringify(body).slice(0, 300)}`,
    );
  }

  const { error } = await supabaseAdmin.from("shop_connections").upsert({
    shop,
    access_token: body.access_token,
    scope: body.scope ?? null,
    connected_at: new Date().toISOString(),
  });
  if (error)
    return text(500, `Could not save the connection: ${error.message}`);

  const crm = (Deno.env.get("CRM_BASE_URL") ?? "").replace(/\/$/, "");
  return crm
    ? Response.redirect(`${crm}/#/?shopify=connected`, 302)
    : text(
        200,
        `Shopify is connected (${shop}). Checkout links will work now. You can close this tab.`,
      );
});
