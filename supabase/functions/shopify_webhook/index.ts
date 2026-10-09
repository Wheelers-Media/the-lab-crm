// Receives Shopify webhooks (Order payment, Checkout creation/update).
// Paid orders are saved to the orders table and the customer's history; a
// $50 booking deposit moves the customer's open deal to Converted.
// Checkouts are stored so the follow-up rules can flag big abandoned carts.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  orderNoteText,
  parseShopifyCheckout,
  parseShopifyOrder,
  type ShopifyOrder,
} from "../_shared/lab/parse.ts";
import { verifyShopifySignature } from "../_shared/lab/signatures.ts";
import {
  addContactNote,
  addDealNote,
  createTask,
  defaultSalesId,
  finishEvent,
  findContact,
  findOpenDeal,
  findOrCreateContact,
  moveDeal,
  recordEvent,
} from "../_shared/lab/crm.ts";

const SOURCE = "shopify";

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const handleOrder = async (order: ShopifyOrder) => {
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("shopify_order_id", order.shopifyOrderId)
    .limit(1);
  const isNew = !existing?.[0];

  const contact = await findOrCreateContact(order.contact, [
    "Shopify customer",
    ...order.categories,
  ]);
  let dealId: number | null = null;

  if (order.isDeposit && contact && isNew) {
    const deal = await findOpenDeal(contact.id);
    if (deal) {
      dealId = deal.id;
      await moveDeal(deal.id, "won");
      await addDealNote(
        deal.id,
        `$50 booking deposit paid (Shopify order ${order.orderNumber}).`,
      );
      await supabaseAdmin
        .from("appointments")
        .update({ deposit_paid: true })
        .eq("deal_id", deal.id)
        .eq("status", "booked");
    } else {
      await createTask(
        contact.id,
        "deposit",
        `Deposit paid (order ${order.orderNumber}) but no open deal matched. Check which booking it belongs to.`,
      );
    }
  }

  const row = {
    shopify_order_id: order.shopifyOrderId,
    order_number: order.orderNumber,
    contact_id: contact?.id ?? null,
    source: order.source,
    financial_status: order.financialStatus,
    fulfillment_status: order.fulfillmentStatus,
    currency: order.currency,
    subtotal: order.subtotal,
    total: order.total,
    refunded_amount: order.refundedAmount,
    line_items: order.lineItems,
    categories: order.categories,
    is_deposit: order.isDeposit,
    ordered_at: order.orderedAt,
    cancelled_at: order.cancelledAt,
    sales_id: await defaultSalesId(),
    ...(dealId ? { deal_id: dealId } : {}),
  };
  const { error } = await supabaseAdmin
    .from("orders")
    .upsert(row, { onConflict: "shopify_order_id" });
  if (error) throw new Error(`save order: ${error.message}`);

  if (isNew && contact)
    await addContactNote(contact.id, orderNoteText(order), order.orderedAt);

  if (order.checkoutToken) {
    await supabaseAdmin
      .from("shopify_checkouts")
      .update({ completed_at: order.orderedAt })
      .eq("checkout_token", order.checkoutToken);
  }
};

const handleCheckout = async (payload: unknown) => {
  const parsed = parseShopifyCheckout(payload);
  if (!parsed.ok) throw new Error(parsed.error);
  const c = parsed.value;
  // Link to a known customer, but don't create contacts for carts nobody finished
  const contact = await findContact(c.contact);
  const { error } = await supabaseAdmin.from("shopify_checkouts").upsert(
    {
      checkout_token: c.token,
      contact_id: contact?.id ?? null,
      email: c.contact.email || null,
      phone: c.contact.phone || null,
      customer_name: c.customerName || null,
      total: c.total,
      line_items: c.lineItems,
      recovery_url: c.recoveryUrl || null,
      completed_at: c.completedAt,
      checkout_updated_at: c.updatedAt,
    },
    { onConflict: "checkout_token" },
  );
  if (error) throw new Error(`save checkout: ${error.message}`);

  // The follow-up rules need a contact to attach the "Call" task to
  if (
    !contact &&
    !c.completedAt &&
    c.total >= 2000 &&
    (c.contact.email || c.contact.phone)
  ) {
    const created = await findOrCreateContact(c.contact, ["Abandoned cart"]);
    if (created) {
      await supabaseAdmin
        .from("shopify_checkouts")
        .update({ contact_id: created.id })
        .eq("checkout_token", c.token);
    }
  }
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return createErrorResponse(405, "Method not allowed");
  const raw = await req.text();
  const valid = await verifyShopifySignature(
    raw,
    req.headers.get("x-shopify-hmac-sha256"),
    Deno.env.get("SHOPIFY_WEBHOOK_SECRET"),
  );
  if (!valid) return createErrorResponse(401, "Invalid signature");

  const topic = req.headers.get("x-shopify-topic") ?? "unknown";
  const webhookId = req.headers.get("x-shopify-webhook-id");
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return createErrorResponse(400, "Invalid JSON");
  }

  const eventId = await recordEvent({
    source: SOURCE,
    eventType: topic,
    externalId: webhookId,
  });
  if (eventId === null) return ok({ ok: true, duplicate: true });

  try {
    if (topic === "orders/paid" || topic === "orders/create") {
      const parsed = parseShopifyOrder(payload);
      if (!parsed.ok) throw new Error(parsed.error);
      // A "create" for an unpaid order (draft or pending) is ignored until it is paid
      if (
        topic === "orders/create" &&
        parsed.value.financialStatus !== "paid"
      ) {
        await finishEvent(eventId, "ignored", "order not paid yet");
        return ok();
      }
      await handleOrder(parsed.value);
    } else if (topic.startsWith("checkouts/")) {
      await handleCheckout(payload);
    } else {
      await finishEvent(eventId, "ignored", `unhandled topic ${topic}`);
      return ok();
    }
    await finishEvent(eventId, "processed");
    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishEvent(eventId, "failed", message);
    console.error("shopify_webhook failed", topic, message);
    // 500 makes Shopify retry; the retry has a new event row because the first one failed
    await supabaseAdmin
      .from("integration_events")
      .update({ external_id: null })
      .eq("id", eventId);
    return createErrorResponse(500, "Processing failed");
  }
});
