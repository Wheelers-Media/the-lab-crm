// Receives quote and booking requests from the thelabfsj.ca forms and files
// them in the CRM: contact (found or created), a deal, a note with the full
// request, and a "Send quote" task for quote requests. Public endpoint:
// protected by an origin allow-list, a honeypot field and a rate limit.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { parseWebsiteLead, websiteDealName } from "../_shared/lab/parse.ts";
import { hashClient } from "../_shared/lab/signatures.ts";
import {
  addDealNote,
  countRecentEvents,
  createDeal,
  createTask,
  finishEvent,
  findOpenDeal,
  findOrCreateContact,
  findOrCreateVehicle,
  noteContactProfile,
  recordEvent,
} from "../_shared/lab/crm.ts";

const SOURCE = "website";
const MAX_BODY_BYTES = 32_000;
const MAX_REQUESTS_PER_10_MIN = 5;

// The live site, any preview on Nathan's Vercel team, and local testing
const ALLOWED_ORIGIN =
  /^https:\/\/((www\.)?thelabfsj\.ca|[a-z0-9-]+-nathans-projects-e8dc0632\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return createErrorResponse(405, "Method not allowed");

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGIN.test(origin))
    return createErrorResponse(403, "Origin not allowed");

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES)
    return createErrorResponse(413, "Request too large");

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return createErrorResponse(400, "Invalid JSON");
  }

  const parsed = parseWebsiteLead(body);
  if (!parsed.ok) {
    // Honeypot hits get a normal-looking response so bots learn nothing
    return parsed.error === "Rejected"
      ? json(200, { ok: true })
      : createErrorResponse(400, parsed.error);
  }
  const lead = parsed.value;

  const clientIp =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const clientHash = await hashClient(
    clientIp,
    Deno.env.get("SUPABASE_URL") ?? "",
  );
  if (
    (await countRecentEvents(SOURCE, clientHash, 10)) >= MAX_REQUESTS_PER_10_MIN
  ) {
    return createErrorResponse(
      429,
      "Too many requests. Please call or text the shop.",
    );
  }

  const eventId = await recordEvent({
    source: SOURCE,
    eventType: lead.intent === "book" ? "booking-request" : "quote-request",
    clientHash,
    payload: { service: lead.service, vehicle: lead.vehicle, page: lead.page },
  });

  try {
    const tags = ["Website lead", ...(lead.smsConsent ? ["SMS consent"] : [])];
    const contact = await findOrCreateContact(lead.contact, tags);
    if (!contact) throw new Error("No way to reach the customer");

    await noteContactProfile(contact.id, {
      smsConsent: lead.smsConsent,
      leadSource: SOURCE,
    });
    const vehicleId = await findOrCreateVehicle(contact.id, {
      ...lead.vehicleParts,
      vin: lead.vin,
    });

    // Reuse a deal that is already in progress for the same customer and service
    const open = await findOpenDeal(contact.id);
    const sameService =
      open && open.name.startsWith(websiteDealName(lead).split(" - ")[0]);
    const stage = lead.intent === "book" ? "qualified" : "intake";
    const dealId = sameService
      ? open!.id
      : await createDeal({
          name: websiteDealName(lead),
          contactId: contact.id,
          stage,
          category: lead.category,
          amount: lead.estimateTotal,
          leadSource: SOURCE,
          vehicleId,
          description: lead.vin ? `VIN ${lead.vin}` : undefined,
          // The priced lines the customer saw become the job's packages
          packages: lead.quote.lines.map((line) => ({
            package_id: null,
            title: line.label,
            price: line.price,
            quantity: 1,
          })),
          quote: lead.quote,
        });

    if (sameService && vehicleId) {
      await supabaseAdmin
        .from("deals")
        .update({ vehicle_id: vehicleId })
        .eq("id", dealId)
        .is("vehicle_id", null);
    }
    if (sameService) {
      // The latest request is what the customer wants now
      await supabaseAdmin
        .from("deals")
        .update({ quote: lead.quote })
        .eq("id", dealId);
    }

    const header =
      lead.intent === "book"
        ? "**Website booking request.** The customer was sent to the booking calendar to pick a time and pay the $50 deposit."
        : "**Website quote request.** The customer wants a price before booking.";
    const lines = [
      header,
      `Service: ${lead.service}`,
      lead.vehicle &&
        `Vehicle: ${lead.vehicle}${lead.vin ? ` (VIN ${lead.vin})` : ""}`,
      lead.estimateText && `Starting price shown: ${lead.estimateText}`,
      lead.details,
      lead.page && `Sent from: ${lead.page}`,
      `SMS consent: ${lead.smsConsent ? "yes" : "no"}`,
    ].filter(Boolean);
    await addDealNote(dealId, lines.join("\n\n"));

    // A resubmitted request adds a note to the existing deal, not a second task
    if (lead.intent === "quote" && !sameService) {
      await createTask(
        contact.id,
        "send-quote",
        `Send quote: ${websiteDealName(lead)}`,
      );
    }

    if (eventId) await finishEvent(eventId, "processed");
    return json(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (eventId) await finishEvent(eventId, "failed", message);
    console.error("lead_intake failed", message);
    // The website still emails the request to the shop, so nothing is lost
    return createErrorResponse(500, "Could not file the request");
  }
});
