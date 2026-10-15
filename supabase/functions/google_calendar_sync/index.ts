// Keeps the shop's two Google calendars and the CRM calendar in step.
//
//  - Events typed into "THE LAB | Detailing Bay" or "THE LAB | Vehicle
//    Customization" become CRM appointments (title, time, the vehicle line and
//    the notes; a phone number in the notes links the customer when it matches).
//  - A time moved or an event cancelled in Google follows into the CRM.
//  - Appointments made in the CRM are added to the right calendar, and a time
//    edit or cancellation there follows to Google (the later edit wins).
//  - Cal.com bookings are left alone: Cal.com writes them to Google itself and
//    tells the CRM by webhook.
//
// POST {} by a signed-in CRM user -> { configured, calendars, pulled, pushed, ... }
//
// Function secrets: GOOGLE_SERVICE_ACCOUNT_JSON (the service account's JSON key,
// or that JSON base64-encoded). Both calendars must be shared with the service
// account's email with "Make changes to events". Optional: CRM_URL (link put in
// event notes), GOOGLE_CALENDAR_DETAILING_ID and GOOGLE_CALENDAR_ERIC_ID.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import {
  countRecentEvents,
  defaultSalesId,
  finishEvent,
  findContact,
  recordEvent,
} from "../_shared/lab/crm.ts";
import {
  type CalendarEvent,
  eventFromAppointment,
  GOOGLE_PREFIX,
  GoogleFailure,
  type GoogleEvent,
  LAB_CALENDARS,
  parseServiceAccount,
  planSync,
  type Resource,
  type ServiceAccount,
  signedAssertion,
  type SyncAppointment,
} from "../_shared/lab/googleCalendar.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

const API = "https://www.googleapis.com/calendar/v3";
const SOURCE = "google_calendar";
const DAY_MS = 86_400_000;
// How far back and forward the sync looks
const PAST_DAYS = 7;
const FUTURE_DAYS = 120;
// Events sent to Google in one run; the rest go on the next one
const MAX_PUSHES = 40;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

class GoogleHttp extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const accessToken = async (account: ServiceAccount): Promise<string> => {
  const assertion = await signedAssertion(
    account,
    Math.floor(Date.now() / 1000),
  );
  const res = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new GoogleFailure(
      `Google refused the service account key (${body.error_description ?? body.error ?? res.status}). Check that the Google Calendar API is enabled and that the key is still active.`,
    );
  }
  return body.access_token as string;
};

const google = async (
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown> | null> => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GoogleHttp(
      res.status,
      (body as { error?: { message?: string } }).error?.message ??
        res.statusText,
    );
  }
  return body as Record<string, unknown>;
};

const listEvents = async (
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleEvent[]> => {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "250",
      timeMin,
      timeMax,
    });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await google(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    );
    events.push(...((page?.items as GoogleEvent[] | undefined) ?? []));
    pageToken = page?.nextPageToken as string | undefined;
  } while (pageToken && events.length < 2000);
  return events;
};

const handle = async () => {
  const account = parseServiceAccount(
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"),
  );
  if (!account) {
    return json({
      configured: false,
      message:
        "Google Calendar is not connected yet. See docs/google-calendar-setup.md.",
    });
  }

  // One sync at a time: two screens opening together must not double-send
  if ((await countRecentEvents(SOURCE, "sync", 1)) > 0) {
    return json({ configured: true, busy: true });
  }
  const eventId = await recordEvent({
    source: SOURCE,
    eventType: "sync",
    clientHash: "sync",
  });

  try {
    const token = await accessToken(account);
    const now = new Date();
    const timeMin = new Date(now.getTime() - PAST_DAYS * DAY_MS).toISOString();
    const timeMax = new Date(
      now.getTime() + FUTURE_DAYS * DAY_MS,
    ).toISOString();

    const calendars = LAB_CALENDARS.map((c) => ({
      ...c,
      id: Deno.env.get(c.envKey) || c.id,
    }));
    const status: Array<{ name: string; ok: boolean; error?: string }> = [];
    const loaded: CalendarEvent[] = [];
    const reachable = new Map<Resource, string>();
    for (const calendar of calendars) {
      try {
        const events = await listEvents(token, calendar.id, timeMin, timeMax);
        for (const event of events)
          loaded.push({ event, resource: calendar.resource });
        reachable.set(calendar.resource, calendar.id);
        status.push({ name: calendar.name, ok: true });
      } catch (error) {
        const reason =
          error instanceof GoogleHttp && [403, 404].includes(error.status)
            ? `Google cannot open this calendar. Share it with ${account.client_email} and allow "Make changes to events".`
            : error instanceof Error
              ? error.message
              : String(error);
        status.push({ name: calendar.name, ok: false, error: reason });
      }
    }

    const { data: rows, error: readError } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, external_id, source, resource, title, start_at, end_at, status, vehicle, notes, updated_at",
      )
      .gte("start_at", timeMin)
      .lt("start_at", timeMax)
      .limit(2000);
    if (readError) throw new Error(`read appointments: ${readError.message}`);
    const appointments = (rows ?? []) as SyncAppointment[];

    const plan = planSync(loaded, appointments, now);
    // Never send to a calendar that could not be read
    plan.pushCreates = plan.pushCreates.filter((a) =>
      reachable.has(a.resource as Resource),
    );

    const result = {
      configured: true,
      calendars: status,
      pulled: { created: 0, updated: 0, cancelled: 0 },
      pushed: { created: 0, updated: 0, deleted: 0 },
      skipped: plan.skipped,
      syncedAt: now.toISOString(),
    };

    // ── Google -> CRM ─────────────────────────────────────────────────────
    if (plan.creates.length) {
      const salesId = await defaultSalesId();
      for (const row of plan.creates) {
        const contact = row.phone
          ? await findContact({ phone: row.phone })
          : null;
        const { error } = await supabaseAdmin.from("appointments").insert({
          external_id: row.externalId,
          source: "google",
          contact_id: contact?.id ?? null,
          title: row.title,
          resource: row.resource,
          start_at: row.startAt,
          end_at: row.endAt,
          status: "booked",
          vehicle: row.vehicle,
          notes: row.notes,
          sales_id: salesId,
        });
        // 23505: another run saved it a moment ago
        if (error && error.code !== "23505")
          throw new Error(`save appointment: ${error.message}`);
        if (!error) result.pulled.created += 1;
      }
    }
    for (const { id, patch } of plan.updates) {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update(patch)
        .eq("id", id);
      if (error) throw new Error(`update appointment: ${error.message}`);
      result.pulled.updated += 1;
    }
    if (plan.cancels.length) {
      const { error } = await supabaseAdmin
        .from("appointments")
        .update({ status: "cancelled" })
        .in("id", plan.cancels);
      if (error) throw new Error(`cancel appointments: ${error.message}`);
      result.pulled.cancelled += plan.cancels.length;
    }
    for (const { id, externalId } of plan.links) {
      await supabaseAdmin
        .from("appointments")
        .update({ external_id: externalId })
        .eq("id", id)
        .is("external_id", null);
    }

    // ── CRM -> Google ─────────────────────────────────────────────────────
    const crmUrl = Deno.env.get("CRM_URL")
      ? `${Deno.env.get("CRM_URL")!.replace(/\/$/, "")}/#/calendar`
      : undefined;
    for (const a of plan.pushCreates.slice(0, MAX_PUSHES)) {
      const calendarId = reachable.get(a.resource as Resource)!;
      const created = await google(
        token,
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          body: JSON.stringify(eventFromAppointment(a, crmUrl)),
        },
      );
      const googleId = created?.id as string | undefined;
      if (googleId) {
        await supabaseAdmin
          .from("appointments")
          .update({ external_id: GOOGLE_PREFIX + googleId })
          .eq("id", a.id);
        result.pushed.created += 1;
      }
    }
    for (const {
      appointment,
      eventId: googleId,
      resource,
    } of plan.pushPatches) {
      const calendarId = reachable.get(resource);
      if (!calendarId) continue;
      const body = eventFromAppointment(appointment, crmUrl);
      await google(
        token,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            summary: body.summary,
            start: body.start,
            end: body.end,
          }),
        },
      );
      result.pushed.updated += 1;
    }
    for (const { eventId: googleId, resource } of plan.pushDeletes) {
      const calendarId = reachable.get(resource);
      if (!calendarId) continue;
      try {
        await google(
          token,
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
          { method: "DELETE" },
        );
        result.pushed.deleted += 1;
      } catch (error) {
        // Already gone
        if (!(error instanceof GoogleHttp && error.status === 410)) throw error;
      }
    }

    if (eventId != null)
      await finishEvent(
        eventId,
        status.some((s) => !s.ok) ? "failed" : "processed",
        status
          .filter((s) => !s.ok)
          .map((s) => `${s.name}: ${s.error}`)
          .join(" | ") || undefined,
      );
    return json(result);
  } catch (error) {
    if (eventId != null)
      await finishEvent(
        eventId,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
    throw error;
  }
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req) => {
        if (req.method !== "POST") {
          return createErrorResponse(405, "Method Not Allowed");
        }
        try {
          return await handle();
        } catch (error) {
          console.error("google_calendar_sync failed:", error);
          return createErrorResponse(
            500,
            error instanceof GoogleFailure
              ? error.message
              : `Could not sync Google Calendar: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    ),
  ),
);
