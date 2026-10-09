// Receives a quote or booking request from the THE LAB website form and records it in the CRM.
// The website still emails Eric through Web3Forms; this is the second copy that feeds the pipeline.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { countDealsSince } from "../_shared/crm.ts";
import { isAllowedOrigin } from "../_shared/lab.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseLead } from "./parseLead.ts";
import { recordLead } from "./recordLead.ts";

const MAX_BODY_BYTES = 40_000;
/** More than this many new deals in ten minutes means something is flooding the endpoint. */
const FLOOD_LIMIT = 60;

function corsFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
  }
  return headers;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsFor(origin);
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...cors },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") return reply(405, { ok: false });
  // Browsers always send an Origin; scripts may not. A browser from any other site is refused.
  if (origin && !isAllowedOrigin(origin)) return reply(403, { ok: false });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return reply(413, { ok: false });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "Body must be JSON" });
  }

  // Honeypot: the form has a hidden "website" field that people leave empty and bots fill.
  if ((body as Record<string, unknown> | null)?.website) {
    return reply(200, { ok: true });
  }

  const parsed = parseLead(body);
  if (!parsed.ok) return reply(400, { ok: false, error: parsed.error });

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    if ((await countDealsSince(supabaseAdmin, tenMinutesAgo)) > FLOOD_LIMIT) {
      return reply(429, { ok: false });
    }
    const result = await recordLead(supabaseAdmin, parsed.lead);
    return reply(200, { ok: true, ...result });
  } catch (error) {
    console.error("lead-intake failed", error);
    return reply(500, { ok: false });
  }
});
