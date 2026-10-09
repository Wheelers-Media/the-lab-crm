// Receives Cal.com booking webhooks and keeps the CRM calendar and pipeline in
// step: a booking saves an appointment, moves the customer's deal to Booked
// and adds a drop-off task; reschedules move both; cancellations free the slot
// and ask Eric to follow up.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import {
  DETAILING_BAY,
  parseCalBooking,
  type CalBooking,
} from "../_shared/lab/parse.ts";
import { verifyCalSignature } from "../_shared/lab/signatures.ts";
import {
  addDealNote,
  createDeal,
  createTask,
  defaultSalesId,
  finishEvent,
  findOpenDeal,
  findOrCreateContact,
  moveDeal,
  recordEvent,
} from "../_shared/lab/crm.ts";

const SOURCE = "calcom";

const ok = (body: Record<string, unknown> = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const whenText = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Dawson_Creek",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const taskTextFor = (b: CalBooking) =>
  b.resource === DETAILING_BAY
    ? `Vehicle drop-off: ${b.title}`
    : `Appointment with Eric: ${b.title}`;

const findAppointment = async (uid: string) => {
  if (!uid) return null;
  const { data } = await supabaseAdmin
    .from("appointments")
    .select("id, task_id, deal_id, contact_id")
    .eq("external_id", uid)
    .limit(1);
  return data?.[0] ?? null;
};

const handleCreated = async (b: CalBooking) => {
  if (await findAppointment(b.uid)) return; // already filed
  const contact = await findOrCreateContact(b.contact, ["Booked online"]);
  if (!contact) throw new Error("Booking has no email or phone");

  let deal = await findOpenDeal(contact.id);
  const dealId = deal
    ? deal.id
    : await createDeal({
        name: b.title,
        contactId: contact.id,
        stage: "booked",
        category: b.category,
        amount: 0,
        leadSource: "cal.com",
      });
  if (deal && deal.stage !== "booked") await moveDeal(deal.id, "booked");
  deal = null;

  const taskId = await createTask(
    contact.id,
    "drop-off",
    taskTextFor(b),
    b.startAt,
  );
  const { error } = await supabaseAdmin.from("appointments").insert({
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
    notes: b.notes || null,
    sales_id: await defaultSalesId(),
  });
  if (error) throw new Error(`save appointment: ${error.message}`);
  await addDealNote(
    dealId,
    `Booked on Cal.com: ${b.title}, ${whenText(b.startAt)}.${b.notes ? `\n\n${b.notes}` : ""}`,
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
      `Rescheduled on Cal.com to ${whenText(b.startAt)}.`,
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
      `Booking cancelled (${b.title}, ${whenText(b.startAt)}). Follow up to rebook.`,
    );
  }
  if (appointment.deal_id)
    await addDealNote(
      appointment.deal_id,
      `Cancelled on Cal.com: ${whenText(b.startAt)}.`,
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
