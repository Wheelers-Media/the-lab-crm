// Receives Cal.com booking webhooks and keeps the CRM calendar and pipeline in
// step: a booking saves an appointment, moves the customer's deal to Booked
// and adds a drop-off task; reschedules move both; cancellations free the slot
// and ask Eric to follow up. The $50 deposit is paid in the Shopify store: the
// shopify_webhook marks a booking paid when the order arrives, and a booking
// made after the deposit claims it here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  DETAILING_BAY,
  parseCalBooking,
  type CalBooking,
} from "../_shared/lab/parse.ts";
import { verifyCalSignature } from "../_shared/lab/signatures.ts";
import { pickByCustomer } from "../_shared/lab/depositMatch.ts";
import { notify } from "../_shared/lab/push.ts";
import {
  type BookingTrigger,
  bookingMessage,
} from "../_shared/lab/pushMessages.ts";
import {
  addDealNote,
  createDeal,
  createTask,
  defaultSalesId,
  defaultVehicleFor,
  finishEvent,
  findOpenDeal,
  findOrCreateContact,
  findUnclaimedDeposits,
  moveDeal,
  recordEvent,
  shopTimeText,
} from "../_shared/lab/crm.ts";

const SOURCE = "calcom";

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const taskTextFor = (b: CalBooking) =>
  b.resource === DETAILING_BAY
    ? `Vehicle drop-off: ${b.title}`
    : `Appointment with Eric: ${b.title}`;

const findAppointment = async (uid: string) => {
  if (!uid) return null;
  const { data } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, task_id, deal_id, contact_id, vehicle_id, vehicle, deposit_paid",
    )
    .eq("external_id", uid)
    .limit(1);
  return data?.[0] ?? null;
};

// Ties an earlier deposit to this booking: the order points at the booking,
// the job is Converted (unless the deposit already did that when it was paid)
// and the "check which booking it belongs to" task is closed.
const claimDeposit = async (
  deposit: {
    id: number;
    orderNumber: string;
    contactId: number | null;
    dealId: number | null;
  },
  appointmentId: number,
  dealId: number,
) => {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ appointment_id: appointmentId, deal_id: dealId })
    .eq("id", deposit.id);
  if (error) throw new Error(`link deposit to booking: ${error.message}`);
  if (deposit.dealId !== dealId) await moveDeal(dealId, "won");
  await addDealNote(
    dealId,
    `$50 booking deposit was already paid (Shopify order ${deposit.orderNumber}).`,
  );
  if (deposit.contactId) {
    await supabaseAdmin
      .from("tasks")
      .update({ done_date: new Date().toISOString() })
      .eq("contact_id", deposit.contactId)
      .is("done_date", null)
      .like("text", `Deposit paid (order ${deposit.orderNumber})%`);
  }
};

const handleCreated = async (b: CalBooking) => {
  if (await findAppointment(b.uid)) return; // already filed
  const contact = await findOrCreateContact(b.contact, ["Booked online"]);
  if (!contact) throw new Error("Booking has no email or phone");

  // A deposit paid before the booking was made: by this customer, else by name
  const deposit = pickByCustomer(await findUnclaimedDeposits(), {
    contactId: contact.id,
    name: [b.contact.firstName, b.contact.lastName].filter(Boolean).join(" "),
  });
  const paid = deposit.kind === "match" ? deposit.item : null;

  const deal = await findOpenDeal(contact.id);
  // The job the deposit was paid against has already moved to Converted, so it
  // is no longer "open": it still gets the booking
  const dealId =
    paid?.dealId ??
    deal?.id ??
    (await createDeal({
      name: b.title,
      contactId: contact.id,
      stage: "booked",
      category: b.category,
      amount: 0,
      leadSource: "cal.com",
    }));
  if (deal && deal.id === dealId && deal.stage !== "booked")
    await moveDeal(deal.id, "booked");

  const taskId = await createTask(
    contact.id,
    "drop-off",
    taskTextFor(b),
    b.startAt,
  );
  const vehicle = await defaultVehicleFor(contact.id);
  const { data: created, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      external_id: b.uid,
      source: SOURCE,
      contact_id: contact.id,
      deal_id: dealId,
      task_id: taskId,
      title: b.title,
      resource: b.resource,
      start_at: b.startAt,
      end_at: b.endAt,
      status: "booked",
      deposit_paid: paid != null,
      notes: b.notes || null,
      vehicle_id: vehicle?.id ?? null,
      vehicle: vehicle?.label || null,
      sales_id: await defaultSalesId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`save appointment: ${error.message}`);
  if (paid) await claimDeposit(paid, created.id, dealId);
  await addDealNote(
    dealId,
    `Booked on Cal.com: ${b.title}, ${shopTimeText(b.startAt)}.${b.notes ? `\n\n${b.notes}` : ""}`,
  );
};

const handleRescheduled = async (b: CalBooking) => {
  const previous = await findAppointment(b.previousUid);
  const current = await findAppointment(b.uid);
  if (current) return;
  if (!previous) return handleCreated(b);

  await supabaseAdmin
    .from("appointments")
    .update({ status: "rescheduled" })
    .eq("id", previous.id);
  const { error } = await supabaseAdmin.from("appointments").insert({
    external_id: b.uid,
    source: SOURCE,
    contact_id: previous.contact_id,
    deal_id: previous.deal_id,
    task_id: previous.task_id,
    vehicle_id: previous.vehicle_id,
    vehicle: previous.vehicle,
    // A deposit paid for the old time still covers the new one
    deposit_paid: previous.deposit_paid ?? false,
    title: b.title,
    resource: b.resource,
    start_at: b.startAt,
    end_at: b.endAt,
    status: "booked",
    notes: b.notes || null,
    sales_id: await defaultSalesId(),
  });
  if (error) throw new Error(`save rescheduled appointment: ${error.message}`);
  if (previous.task_id) {
    await supabaseAdmin
      .from("tasks")
      .update({ due_date: b.startAt, text: taskTextFor(b) })
      .eq("id", previous.task_id);
  }
  if (previous.deal_id)
    await addDealNote(
      previous.deal_id,
      `Rescheduled on Cal.com to ${shopTimeText(b.startAt)}.`,
    );
};

const handleCancelled = async (b: CalBooking) => {
  const appointment = await findAppointment(b.uid);
  if (!appointment) return;
  await supabaseAdmin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointment.id);
  if (appointment.task_id)
    await supabaseAdmin.from("tasks").delete().eq("id", appointment.task_id);
  if (appointment.contact_id) {
    await createTask(
      appointment.contact_id,
      "call",
      `Booking cancelled (${b.title}, ${shopTimeText(b.startAt)}). Follow up to rebook.`,
    );
  }
  if (appointment.deal_id)
    await addDealNote(
      appointment.deal_id,
      `Cancelled on Cal.com: ${shopTimeText(b.startAt)}.`,
    );
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return createErrorResponse(405, "Method not allowed");
  const raw = await req.text();
  const valid = await verifyCalSignature(
    raw,
    req.headers.get("x-cal-signature-256"),
    Deno.env.get("CALCOM_WEBHOOK_SECRET"),
  );
  if (!valid) return createErrorResponse(401, "Invalid signature");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return createErrorResponse(400, "Invalid JSON");
  }
  const parsed = parseCalBooking(body);
  if (!parsed.ok) return createErrorResponse(400, parsed.error);
  const b = parsed.value;
  if (b.trigger === "PING") return ok({ ok: true, ping: true });

  const eventId = await recordEvent({
    source: SOURCE,
    eventType: b.trigger,
    externalId: b.uid ? `${b.trigger}:${b.uid}` : null,
  });
  if (eventId === null) return ok({ ok: true, duplicate: true });

  try {
    if (b.trigger === "BOOKING_CREATED") await handleCreated(b);
    else if (b.trigger === "BOOKING_RESCHEDULED") await handleRescheduled(b);
    else if (b.trigger === "BOOKING_CANCELLED") await handleCancelled(b);
    else {
      await finishEvent(eventId, "ignored", `unhandled trigger ${b.trigger}`);
      return ok();
    }
    await notify(
      bookingMessage({
        trigger: b.trigger as BookingTrigger,
        uid: b.uid,
        title: b.title,
        name: [b.contact.firstName, b.contact.lastName]
          .filter(Boolean)
          .join(" "),
        when: shopTimeText(b.startAt),
      }),
    );
    await finishEvent(eventId, "processed");
    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishEvent(eventId, "failed", message);
    await supabaseAdmin
      .from("integration_events")
      .update({ external_id: null })
      .eq("id", eventId);
    console.error("calcom_webhook failed", b.trigger, message);
    return createErrorResponse(500, "Processing failed");
  }
});
