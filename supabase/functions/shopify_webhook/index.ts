// Receives Shopify webhooks (Order payment, Checkout creation/update,
// Product creation/update/deletion).
// Paid orders are saved to the orders table and the customer's history. A
// $50 booking deposit is matched to the booking it pays for (the customer's
// own booking first, then a booking under the same name, so a deposit paid
// with another email or phone still finds it); the booking is marked paid and
// its deal moves to Converted.
// Checkouts are stored so the follow-up rules can flag big abandoned carts.
// Products keep the CRM's catalog (packages and parts) in step with Shopify.
// "history/order" is our own topic, sent by scripts/shopify-backfill.ts: past
// orders are recorded on the customer, with no deal moves or tasks.
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
import { type Match, pickByCustomer } from "../_shared/lab/depositMatch.ts";
import { packageFromProduct } from "../_shared/lab/packages.ts";
import {
  addContactNote,
  addDealNote,
  createTask,
  defaultSalesId,
  finishEvent,
  findContact,
  findOpenDeal,
  findOrCreateContact,
  findUnpaidBookings,
  moveDeal,
  recordEvent,
  shopTimeText,
  type UnpaidBooking,
} from "../_shared/lab/crm.ts";

const SOURCE = "shopify";
const HISTORY_TOPIC = "history/order";
const HISTORY_STATUSES = new Set([
  "paid",
  "partially_paid",
  "partially_refunded",
  "refunded",
]);

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const payerName = (order: ShopifyOrder) =>
  [order.contact.firstName, order.contact.lastName].filter(Boolean).join(" ");

const handleOrder = async (
  order: ShopifyOrder,
  { history = false }: { history?: boolean } = {},
) => {
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("shopify_order_id", order.shopifyOrderId)
    .limit(1);
  const isNew = !existing?.[0];
  // A past deposit belongs to a job that is long done: never move today's deals
  const isLiveDeposit = order.isDeposit && isNew && !history;

  // Find the booking this deposit pays for before a contact is made for the
  // payer: their own customer record first, then the name on the booking
  let match: Match<UnpaidBooking> = { kind: "none" };
  if (isLiveDeposit) {
    const known = await findContact(order.contact);
    match = pickByCustomer(await findUnpaidBookings(), {
      contactId: known?.id ?? null,
      name: payerName(order),
    });
  }
  const booking = match.kind === "match" ? match.item : null;

  const contact = await findOrCreateContact(
    order.contact,
    ["Shopify customer", ...order.categories],
    history ? order.orderedAt : undefined,
    booking?.contactId ?? undefined,
  );
  let dealId: number | null = null;
  let appointmentId: number | null = booking?.id ?? null;

  if (isLiveDeposit && contact) {
    const dealToMove =
      booking?.dealId ?? (await findOpenDeal(contact.id))?.id ?? null;
    if (dealToMove) {
      dealId = dealToMove;
      await moveDeal(dealToMove, "won");
      await addDealNote(
        dealToMove,
        `$50 booking deposit paid (Shopify order ${order.orderNumber}).` +
          (booking && match.kind === "match" && match.by === "name"
            ? ` Matched to the booking on ${shopTimeText(booking.when)} by the customer's name: it was paid with a different email or phone.`
            : ""),
      );
    }
    // The matched booking, else the booked appointment on the job that moved
    const paid = booking
      ? supabaseAdmin
          .from("appointments")
          .update({ deposit_paid: true })
          .eq("id", booking.id)
      : dealToMove
        ? supabaseAdmin
            .from("appointments")
            .update({ deposit_paid: true })
            .eq("deal_id", dealToMove)
            .eq("status", "booked")
        : null;
    if (paid) {
      const { data: marked, error } = await paid.select("id");
      if (error) throw new Error(`mark deposit paid: ${error.message}`);
      appointmentId ??= marked?.[0]?.id ?? null;
    }
    if (!booking && !dealToMove) {
      // The order number leads the text so a later booking can close this task
      await createTask(
        contact.id,
        "deposit",
        `Deposit paid (order ${order.orderNumber}) by ${payerName(order) || "an unknown payer"}, ${
          match.kind === "ambiguous"
            ? "but several bookings share that name"
            : "but no booking matched"
        }. Check which booking it belongs to.`,
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
    ...(appointmentId ? { appointment_id: appointmentId } : {}),
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

/** Keeps the catalog in step with Shopify; deleted products are marked so. */
const handleProduct = async (topic: string, payload: unknown) => {
  const id = String((payload as { id?: unknown })?.id ?? "");
  if (!id) throw new Error("Missing product id");
  const row = topic === "products/delete" ? null : packageFromProduct(payload);
  if (!row) {
    // Deleted in Shopify (or unreadable): keep the row for old jobs, mark it
    const { error } = await supabaseAdmin
      .from("packages")
      .update({ status: "deleted", synced_at: new Date().toISOString() })
      .eq("shopify_product_id", id);
    if (error) throw new Error(`remove package: ${error.message}`);
    return;
  }
  const { error } = await supabaseAdmin
    .from("packages")
    .upsert(
      { ...row, synced_at: new Date().toISOString() },
      { onConflict: "shopify_product_id" },
    );
  if (error) throw new Error(`save package: ${error.message}`);
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
    } else if (topic === HISTORY_TOPIC) {
      const parsed = parseShopifyOrder(payload);
      if (!parsed.ok) throw new Error(parsed.error);
      if (!HISTORY_STATUSES.has(parsed.value.financialStatus)) {
        await finishEvent(eventId, "ignored", "order never paid");
        return ok();
      }
      await handleOrder(parsed.value, { history: true });
    } else if (topic.startsWith("checkouts/")) {
      await handleCheckout(payload);
    } else if (topic.startsWith("products/")) {
      await handleProduct(topic, payload);
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
