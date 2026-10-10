// Creates a Shopify checkout link for a job's quote, under the customer's name,
// and optionally emails it to them from Shopify. Signed-in CRM users only.
//
// POST { dealId, mode: "parts" | "all", email?: boolean }
// -> { url, dueNow, dueAtPickup, emailed }
//
// Function secrets: SHOPIFY_SHOP (xr6pmx-y0.myshopify.com) plus either
// SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET from a Dev Dashboard app
// installed on the store (exchanged for a 24-hour token), or an older
// SHOPIFY_ADMIN_TOKEN. The app needs write_draft_orders and write_customers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { addDealNote, moveDeal } from "../_shared/lab/crm.ts";
import {
  draftOrderNote,
  draftOrderPlan,
  type PayMode,
} from "../_shared/lab/quoteCheckout.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const API_VERSION = "2025-10";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const shopify = async (
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
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
    throw new Error(
      `Shopify ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`,
    );
  }
  return body.data;
};

// Client credentials tokens last 24 hours; reuse one until shortly before it ends
let cachedToken: { value: string; expiresAt: number } | null = null;

const accessToken = async (shop: string): Promise<string | null> => {
  const fixed = Deno.env.get("SHOPIFY_ADMIN_TOKEN");
  if (fixed) return fixed;
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
    throw new Error(
      `Shopify token ${res.status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  const lifetime = (Number(body.expires_in) || 86399) * 1000;
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + lifetime - 10 * 60 * 1000,
  };
  return cachedToken.value;
};

const CREATE = `mutation($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name invoiceUrl }
    userErrors { field message }
  }
}`;

const SEND = `mutation($id: ID!, $email: EmailInput) {
  draftOrderInvoiceSend(id: $id, email: $email) {
    draftOrder { id }
    userErrors { field message }
  }
}`;

type Contact = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: Array<{ email: string }> | null;
  phone_jsonb: Array<{ number: string }> | null;
};

const handle = async (req: Request) => {
  const shop = Deno.env.get("SHOPIFY_SHOP");
  const token = shop ? await accessToken(shop) : null;
  if (!shop || !token) {
    return createErrorResponse(
      503,
      "Checkout links are not connected to Shopify yet.",
      { code: "not_connected" },
    );
  }

  const body = await req.json().catch(() => ({}));
  const dealId = Number(body.dealId);
  const mode: PayMode = body.mode === "all" ? "all" : "parts";
  if (!Number.isInteger(dealId) || dealId <= 0) {
    return createErrorResponse(400, "Missing the job to quote.");
  }

  const { data: deal, error } = await supabaseAdmin
    .from("deals")
    .select("id, name, stage, packages, contact_ids")
    .eq("id", dealId)
    .single();
  if (error || !deal) return createErrorResponse(404, "Job not found.");

  const plan = draftOrderPlan(deal.packages, mode);
  if ("error" in plan) return createErrorResponse(400, plan.error);

  const contactId = (deal.contact_ids ?? [])[0];
  const { data: contact } = contactId
    ? await supabaseAdmin
        .from("contacts")
        .select("id, first_name, last_name, email_jsonb, phone_jsonb")
        .eq("id", contactId)
        .single<Contact>()
    : { data: null };
  const email = contact?.email_jsonb?.[0]?.email?.trim() || undefined;
  if (body.email && !email) {
    return createErrorResponse(
      400,
      "This customer has no email address. Add one, or copy the link and text it.",
    );
  }

  const created = await shopify(shop, token, CREATE, {
    input: {
      email,
      phone: contact?.phone_jsonb?.[0]?.number || undefined,
      lineItems: plan.lineItems,
      note: draftOrderNote(deal.name, plan),
      tags: ["CRM quote", `crm-deal-${deal.id}`],
      visibleToCustomer: true,
    },
  });
  const errors = created?.draftOrderCreate?.userErrors ?? [];
  const draft = created?.draftOrderCreate?.draftOrder;
  if (errors.length || !draft?.invoiceUrl) {
    return createErrorResponse(
      502,
      errors[0]?.message ?? "Shopify did not return a checkout link.",
    );
  }

  let emailed = false;
  if (body.email && email) {
    const sent = await shopify(shop, token, SEND, {
      id: draft.id,
      email: {
        to: email,
        subject: `Your quote from THE LAB`,
        customMessage: draftOrderNote(deal.name, plan),
      },
    });
    emailed = !(sent?.draftOrderInvoiceSend?.userErrors ?? []).length;
  }

  const checkout = {
    url: draft.invoiceUrl,
    draft_order_id: draft.id,
    draft_order_name: draft.name,
    mode,
    due_now: plan.dueNow,
    due_at_pickup: plan.dueAtPickup,
    emailed,
    created_at: new Date().toISOString(),
  };
  await supabaseAdmin.from("deals").update({ checkout }).eq("id", deal.id);
  if (deal.stage === "intake" || deal.stage === "qualified") {
    await moveDeal(deal.id, "quoted");
  }
  const cad = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  await addDealNote(
    deal.id,
    [
      `**Checkout link ${emailed ? "emailed to the customer" : "created"}** (${draft.name}).`,
      `Due now: ${cad(plan.dueNow)} plus tax.`,
      plan.dueAtPickup > 0
        ? `Labour at pickup: ${cad(plan.dueAtPickup)} plus tax.`
        : null,
      draft.invoiceUrl,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );

  return json({
    url: draft.invoiceUrl,
    dueNow: plan.dueNow,
    dueAtPickup: plan.dueAtPickup,
    emailed,
  });
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await handle(req);
        } catch (error) {
          console.error("quote_checkout failed:", error);
          return createErrorResponse(
            500,
            "Could not create the checkout link. Try again, or build the order in Shopify.",
          );
        }
      }),
    ),
  ),
);
