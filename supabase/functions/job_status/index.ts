// The customer's job status page (thelabfsj.ca/status/?t=<token>) reads this.
// Public and read-only: the secret in the link is the only way in, unknown
// tokens all look the same, and requests are rate limited. What comes back is
// decided by buildJobStatus (no line prices, notes or phone numbers).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { buildJobStatus } from "../_shared/lab/jobStatus.ts";
import { countRecentEvents, recordEvent } from "../_shared/lab/crm.ts";
import { hashClient } from "../_shared/lab/signatures.ts";

const SOURCE = "job_status";
const MAX_REQUESTS_PER_10_MIN = 60;
const TOKEN = /^[0-9a-f]{32}$/;

// The live site, any preview on Nathan's Vercel team, and local testing
const ALLOWED_ORIGIN =
  /^https:\/\/((www\.)?thelabfsj\.ca|[a-z0-9-]+-nathans-projects-e8dc0632\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;

const reply = (status: number, body: unknown, origin: string | null) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...(origin && ALLOWED_ORIGIN.test(origin)
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {}),
    },
  });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return reply(204, null, origin);
  if (req.method !== "GET") return reply(405, { error: "Not allowed" }, origin);
  if (origin && !ALLOWED_ORIGIN.test(origin))
    return reply(403, { error: "Not allowed" }, null);

  const clientIp =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const clientHash = await hashClient(
    clientIp,
    Deno.env.get("SUPABASE_URL") ?? "",
  );
  if (
    (await countRecentEvents(SOURCE, clientHash, 10)) >= MAX_REQUESTS_PER_10_MIN
  )
    return reply(429, { error: "Too many requests" }, origin);
  await recordEvent({ source: SOURCE, eventType: "view", clientHash });

  const token = new URL(req.url).searchParams.get("t") ?? "";
  const notFound = () => reply(404, { error: "Job not found" }, origin);
  if (!TOKEN.test(token)) return notFound();

  const { data: deal } = await supabaseAdmin
    .from("deals")
    .select(
      "id, name, stage, work_status, packages, checkout, updated_at, contact_ids, vehicle_id, archived_at",
    )
    .eq("status_token", token)
    .maybeSingle();
  if (!deal || deal.archived_at) return notFound();

  const [contact, vehicle, appointments] = await Promise.all([
    deal.contact_ids?.[0]
      ? supabaseAdmin
          .from("contacts")
          .select("first_name")
          .eq("id", deal.contact_ids[0])
          .maybeSingle()
      : Promise.resolve({ data: null }),
    deal.vehicle_id
      ? supabaseAdmin
          .from("vehicles")
          .select("year, make, model")
          .eq("id", deal.vehicle_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("appointments")
      .select("start_at, end_at, resource, status")
      .eq("deal_id", deal.id),
  ]);

  const v = vehicle.data as {
    year: number | null;
    make: string | null;
    model: string | null;
  } | null;
  return reply(
    200,
    buildJobStatus({
      deal,
      firstName:
        (contact.data as { first_name: string | null } | null)?.first_name ??
        null,
      vehicle: v ? [v.year, v.make, v.model].filter(Boolean).join(" ") : null,
      appointments: appointments.data ?? [],
    }),
    origin,
  );
});
