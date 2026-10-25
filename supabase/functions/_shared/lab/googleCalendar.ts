// Google Calendar link for the shop's two calendars ("THE LAB | Detailing Bay"
// and "THE LAB | Vehicle Customization"). Pure helpers, no Deno or network
// imports, so vitest runs them in Node:
//
//  - a service account signs its own token request (RS256 with WebCrypto);
//  - events typed by hand into Google ("Chad Bordeleau", the truck and a phone
//    number in the notes) become CRM appointments;
//  - appointments made in the CRM become events;
//  - one plan says what to do, so every rule can be tested without a network.
//
// Cal.com already writes its bookings to these calendars and tells the CRM by
// webhook, so those events are recognised and left alone (no double booking).
import { formatPhone } from "./parse.ts";

export type Resource = "detailing-bay" | "eric";

/** The shop's calendars. Ids are not secrets; env vars can override them. */
export const LAB_CALENDARS: Array<{
  resource: Resource;
  id: string;
  name: string;
  envKey: string;
}> = [
  {
    resource: "detailing-bay",
    id: "c_3de0d0264e65066b4dbdf3153586122b20ea802e835f9fab26d5b1d659b5394c@group.calendar.google.com",
    name: "THE LAB | Detailing Bay",
    envKey: "GOOGLE_CALENDAR_DETAILING_ID",
  },
  {
    resource: "eric",
    id: "c_e2a7b106f004d17b2b349159d9026f2cd56ac0a159877b0fcf384d3da51286d9@group.calendar.google.com",
    name: "THE LAB | Vehicle Customization",
    envKey: "GOOGLE_CALENDAR_ERIC_ID",
  },
];

/** A failure whose message is safe and useful to show the CRM user. */
export class GoogleFailure extends Error {}

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
/** appointments.external_id for rows that came from, or were sent to, Google. */
export const GOOGLE_PREFIX = "gcal:";
export const SHOP_TIME_ZONE = "America/Dawson_Creek";

// ── Service account ────────────────────────────────────────────────────────

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri: string;
};

/**
 * Reads the downloaded service account key. Accepts the JSON as is, or the
 * same JSON base64-encoded (multi-line secrets are awkward to paste).
 * Returns null when nothing is set, so "not connected" is not an error.
 */
export const parseServiceAccount = (
  raw: string | null | undefined,
): ServiceAccount | null => {
  const text = raw?.trim();
  if (!text) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.startsWith("{") ? text : atob(text));
  } catch {
    throw new GoogleFailure(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not the key file Google gave you. Paste the whole JSON file.",
    );
  }
  const email = String(parsed.client_email ?? "");
  const key = String(parsed.private_key ?? "");
  if (!email || !key.includes("BEGIN PRIVATE KEY")) {
    throw new GoogleFailure(
      "GOOGLE_SERVICE_ACCOUNT_JSON has no client_email or private_key. Create a JSON key for the service account.",
    );
  }
  return {
    client_email: email,
    private_key: key,
    token_uri: String(
      parsed.token_uri ?? "https://oauth2.googleapis.com/token",
    ),
  };
};

const b64url = (data: Uint8Array | string): string => {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const pemBytes = (pem: string): Uint8Array => {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
};

/** The signed JWT Google trades for a one-hour access token. */
export const signedAssertion = async (
  account: ServiceAccount,
  nowSeconds: number,
  scope: string = CALENDAR_SCOPE,
): Promise<string> => {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope,
      aud: account.token_uri,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${claims}`),
    ),
  );
  return `${header}.${claims}.${b64url(signature)}`;
};

// ── Events ─────────────────────────────────────────────────────────────────

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  iCalUID?: string;
  /** Where the event opens in Google Calendar. */
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/** A Google event with the calendar (and so the CRM resource) it came from. */
export type CalendarEvent = { event: GoogleEvent; resource: Resource };

const decodeEntities = (text: string): string =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

/** Event notes may carry HTML (Google adds <br> and <b>); the CRM shows text. */
export const plainText = (html: string | undefined): string =>
  decodeEntities(
    (html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** "2019 f150 Raptor", "2014gmc 1500": the first line that starts with a model year. */
export const vehicleFrom = (notes: string): string | null => {
  for (const line of notes.split("\n")) {
    if (/(?<!\d)(19[89]\d|20[0-4]\d)\s*[a-z]/i.test(line)) {
      return line.trim().slice(0, 80);
    }
  }
  return null;
};

/** The first North American phone number in the notes, as "(306) 533-5313". */
export const phoneFrom = (notes: string): string | null => {
  const match = notes.match(
    /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/,
  );
  return match ? formatPhone(match[0]) || null : null;
};

/** Cal.com writes the booking to Google itself: its events are not new bookings. */
export const isCalcomEvent = (event: GoogleEvent): boolean =>
  /@cal\.com$/i.test(event.iCalUID ?? "") ||
  /<b>\s*booked by\s*<\/b>/i.test(event.description ?? "");

const isoOf = (value: string | undefined): string | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

export type PullRow = {
  externalId: string;
  resource: Resource;
  title: string;
  startAt: string;
  endAt: string;
  vehicle: string | null;
  notes: string | null;
  phone: string | null;
  /** The event in Google Calendar, kept so the CRM can link back to it. */
  url: string | null;
};

export type SkipReason = "allDay" | "calcom" | "invalid";

/** What a Google event means to the CRM, or why it is not an appointment. */
export const rowFromEvent = (
  event: GoogleEvent,
  resource: Resource,
): { row: PullRow } | { skip: SkipReason } => {
  if (isCalcomEvent(event)) return { skip: "calcom" };
  // A whole-day entry ("Dolly maintenance") takes no bay time; it is not a booking
  if (!event.start?.dateTime && event.start?.date) return { skip: "allDay" };
  const startAt = isoOf(event.start?.dateTime);
  const endAt = isoOf(event.end?.dateTime);
  if (!startAt || !endAt || endAt <= startAt) return { skip: "invalid" };
  const notes = plainText(event.description);
  return {
    row: {
      externalId: GOOGLE_PREFIX + event.id,
      resource,
      title: (event.summary ?? "").trim().slice(0, 200) || "(no title)",
      startAt,
      endAt,
      vehicle: vehicleFrom(notes),
      notes: notes ? notes.slice(0, 2000) : null,
      phone: phoneFrom(notes),
      url: event.htmlLink?.trim() || null,
    },
  };
};

/** The CRM appointment as the sync sees it. */
export type SyncAppointment = {
  id: number;
  external_id: string | null;
  external_url?: string | null;
  source: string;
  resource: string;
  title: string;
  start_at: string;
  end_at: string;
  status: string;
  vehicle: string | null;
  notes: string | null;
  updated_at: string;
};

/** The Google event body for a CRM appointment. */
export const eventFromAppointment = (
  a: SyncAppointment,
  crmUrl?: string,
): Record<string, unknown> => {
  const lines = [
    a.vehicle ? a.vehicle : null,
    a.notes ? a.notes : null,
    crmUrl ? `CRM: ${crmUrl}` : null,
  ].filter(Boolean);
  return {
    summary: a.title,
    description: lines.join("\n"),
    start: {
      dateTime: new Date(a.start_at).toISOString(),
      timeZone: SHOP_TIME_ZONE,
    },
    end: {
      dateTime: new Date(a.end_at).toISOString(),
      timeZone: SHOP_TIME_ZONE,
    },
    extendedProperties: { private: { crmAppointmentId: String(a.id) } },
  };
};

// ── The plan ───────────────────────────────────────────────────────────────

export type SyncPlan = {
  /** New CRM appointments, from events typed into Google. */
  creates: PullRow[];
  /** CRM appointments whose event changed in Google (or is newer than the CRM edit). */
  updates: Array<{
    id: number;
    patch: { title: string; start_at: string; end_at: string };
    /** The event's Google Calendar link, when Google gave one. */
    url: string | null;
  }>;
  /** CRM appointments to mark cancelled: the event was cancelled or deleted. */
  cancels: number[];
  /** CRM appointments that already have a Google event but did not record its id. */
  links: Array<{ id: number; externalId: string; url: string | null }>;
  /** CRM-made appointments with no event yet. */
  pushCreates: SyncAppointment[];
  /** CRM edits newer than the Google event. */
  pushPatches: Array<{
    appointment: SyncAppointment;
    eventId: string;
    resource: Resource;
  }>;
  /** Cancelled in the CRM while the event is still on the calendar. */
  pushDeletes: Array<{
    appointment: SyncAppointment;
    eventId: string;
    resource: Resource;
  }>;
  skipped: Record<SkipReason, number>;
};

const DAY_MS = 86_400_000;
const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

/**
 * Compares the calendars with the CRM and says what to do. Events from Google
 * win for appointments that began there; for appointments made in the CRM the
 * later edit wins, so a time moved in either place follows to the other.
 */
export const planSync = (
  calendar: CalendarEvent[],
  appointments: SyncAppointment[],
  now: Date = new Date(),
): SyncPlan => {
  const plan: SyncPlan = {
    creates: [],
    updates: [],
    cancels: [],
    links: [],
    pushCreates: [],
    pushPatches: [],
    pushDeletes: [],
    skipped: { allDay: 0, calcom: 0, invalid: 0 },
  };
  const byExternalId = new Map(
    appointments.filter((a) => a.external_id).map((a) => [a.external_id!, a]),
  );
  const byId = new Map(appointments.map((a) => [a.id, a]));
  const seen = new Set<number>();
  const cancelledSet = new Set<number>();

  for (const { event, resource } of calendar) {
    const externalId = GOOGLE_PREFIX + event.id;
    const crmId = Number(event.extendedProperties?.private?.crmAppointmentId);
    const known =
      byExternalId.get(externalId) ??
      (Number.isInteger(crmId) && crmId > 0 ? byId.get(crmId) : undefined);
    if (known) seen.add(known.id);

    if (event.status === "cancelled") {
      if (
        known &&
        known.status !== "cancelled" &&
        !cancelledSet.has(known.id)
      ) {
        cancelledSet.add(known.id);
        plan.cancels.push(known.id);
      }
      continue;
    }

    // An event the CRM itself sent
    if (known && Number.isInteger(crmId) && crmId === known.id) {
      if (!known.external_id)
        plan.links.push({
          id: known.id,
          externalId,
          url: event.htmlLink?.trim() || null,
        });
      if (known.status === "cancelled") {
        plan.pushDeletes.push({
          appointment: known,
          eventId: event.id,
          resource,
        });
        continue;
      }
      const start = isoOf(event.start?.dateTime);
      const end = isoOf(event.end?.dateTime);
      const moved =
        start != null &&
        end != null &&
        (!sameInstant(start, known.start_at) ||
          !sameInstant(end, known.end_at));
      const titled = (event.summary ?? "").trim() !== known.title.trim();
      if (moved || titled) {
        const crmNewer =
          Date.parse(known.updated_at) > Date.parse(event.updated ?? "");
        if (crmNewer) {
          plan.pushPatches.push({
            appointment: known,
            eventId: event.id,
            resource,
          });
        } else if (start && end) {
          plan.updates.push({
            id: known.id,
            patch: {
              title: (event.summary ?? known.title).trim().slice(0, 200),
              start_at: start,
              end_at: end,
            },
            url: event.htmlLink?.trim() || null,
          });
        }
      }
      continue;
    }

    const result = rowFromEvent(event, resource);
    if ("skip" in result) {
      plan.skipped[result.skip] += 1;
      continue;
    }
    const { row } = result;
    if (!known) {
      plan.creates.push(row);
      continue;
    }
    // An appointment that began in Google: Google is the source of truth
    if (known.status === "cancelled") continue;
    if (
      known.title !== row.title ||
      !sameInstant(known.start_at, row.startAt) ||
      !sameInstant(known.end_at, row.endAt)
    ) {
      plan.updates.push({
        id: known.id,
        patch: { title: row.title, start_at: row.startAt, end_at: row.endAt },
        url: row.url,
      });
    }
  }

  const recent = now.getTime() - DAY_MS;
  for (const a of appointments) {
    if (
      a.source === "manual" &&
      !a.external_id &&
      a.status === "booked" &&
      !seen.has(a.id) &&
      Date.parse(a.end_at) > recent
    ) {
      plan.pushCreates.push(a);
    }
  }
  return plan;
};
