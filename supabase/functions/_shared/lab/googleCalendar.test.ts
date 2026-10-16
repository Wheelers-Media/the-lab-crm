import { describe, expect, it } from "vitest";

import {
  type CalendarEvent,
  eventFromAppointment,
  GOOGLE_PREFIX,
  GoogleFailure,
  isCalcomEvent,
  parseServiceAccount,
  phoneFrom,
  plainText,
  planSync,
  rowFromEvent,
  signedAssertion,
  type SyncAppointment,
  vehicleFrom,
} from "./googleCalendar.ts";

const NOW = new Date("2026-10-14T18:00:00Z");

const event = (over: Record<string, unknown> = {}): CalendarEvent => ({
  resource: "detailing-bay",
  event: {
    id: "evt1",
    status: "confirmed",
    summary: "Brendan Feilberg",
    description: "2019 f150 Raptor\nDe-LUXX\n778-256-4486",
    updated: "2026-10-06T22:08:52Z",
    start: { dateTime: "2026-10-16T08:00:00-07:00" },
    end: { dateTime: "2026-10-16T09:00:00-07:00" },
    ...over,
  },
});

const appointment = (over: Partial<SyncAppointment> = {}): SyncAppointment => ({
  id: 1,
  external_id: null,
  source: "manual",
  resource: "detailing-bay",
  title: "Oil Lee",
  start_at: "2026-10-16T15:00:00.000Z",
  end_at: "2026-10-16T16:00:00.000Z",
  status: "booked",
  vehicle: null,
  notes: null,
  updated_at: "2026-10-14T12:00:00Z",
  ...over,
});

describe("parseServiceAccount", () => {
  const key = {
    client_email: "crm@lab.iam.gserviceaccount.com",
    private_key:
      "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n",
  };

  it("is not an error when nothing is set", () => {
    expect(parseServiceAccount(undefined)).toBeNull();
    expect(parseServiceAccount("  ")).toBeNull();
  });

  it("reads the key file as JSON or as base64 of it", () => {
    const json = JSON.stringify(key);

    expect(parseServiceAccount(json)?.client_email).toBe(key.client_email);
    expect(parseServiceAccount(btoa(json))?.client_email).toBe(
      key.client_email,
    );
    expect(parseServiceAccount(json)?.token_uri).toBe(
      "https://oauth2.googleapis.com/token",
    );
  });

  it("explains what is wrong with a bad value", () => {
    expect(() => parseServiceAccount("not json")).toThrow(GoogleFailure);
    expect(() => parseServiceAccount('{"client_email":"a@b"}')).toThrow(
      /private_key/,
    );
  });
});

describe("signedAssertion", () => {
  it("is an RS256 token Google can verify with the account's public key", async () => {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const der = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    );
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;

    const token = await signedAssertion(
      {
        client_email: "crm@lab.iam.gserviceaccount.com",
        private_key: pem,
        token_uri: "https://oauth2.googleapis.com/token",
      },
      1_800_000_000,
    );

    const [header, claims, signature] = token.split(".");
    const decode = (s: string) =>
      JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toMatchObject({
      iss: "crm@lab.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pair.publicKey,
      sigBytes,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
  });
});

describe("reading the notes Eric types into events", () => {
  it("finds the vehicle on the line that starts with a model year", () => {
    expect(vehicleFrom("2019 f150 Raptor\nDe-LUXX\n778-256-4486")).toBe(
      "2019 f150 Raptor",
    );
    expect(vehicleFrom("Engine bay $100.00 wash\n2009 Hyundai Santa Fe")).toBe(
      "2009 Hyundai Santa Fe",
    );
    expect(vehicleFrom("2014gmc 1500\nLeather seats")).toBe("2014gmc 1500");
    expect(vehicleFrom("Front two seats\n306-533-5313")).toBeNull();
  });

  it("finds the phone number in any common format", () => {
    expect(phoneFrom("Front two seats \n306-533-5313")).toBe("(306) 533-5313");
    expect(phoneFrom("call (250) 261-9502 today")).toBe("(250) 261-9502");
    expect(phoneFrom("Engine bay $100.00 wash")).toBeNull();
  });

  it("turns Google's HTML notes into text", () => {
    expect(plainText("<b>Booked by</b><br>Ezme &amp; Co<br/>x")).toBe(
      "Booked by\nEzme & Co\nx",
    );
  });
});

describe("rowFromEvent", () => {
  it("makes an appointment from a timed event on the right resource", () => {
    const result = rowFromEvent(event().event, "eric");

    expect(result).toMatchObject({
      row: {
        externalId: `${GOOGLE_PREFIX}evt1`,
        resource: "eric",
        title: "Brendan Feilberg",
        startAt: "2026-10-16T15:00:00.000Z",
        endAt: "2026-10-16T16:00:00.000Z",
        vehicle: "2019 f150 Raptor",
        phone: "(778) 256-4486",
      },
    });
  });

  it("leaves whole-day entries, Cal.com bookings and bad times out", () => {
    const allDay = event({
      start: { date: "2026-10-15" },
      end: { date: "2026-10-16" },
    });
    const cal = event({
      description: "<b>Booked by</b>\nEzme\nezme@example.com",
    });
    const bad = event({ end: { dateTime: "2026-10-16T07:00:00-07:00" } });

    expect(rowFromEvent(allDay.event, "eric")).toEqual({ skip: "allDay" });
    expect(rowFromEvent(cal.event, "eric")).toEqual({ skip: "calcom" });
    expect(rowFromEvent(bad.event, "eric")).toEqual({ skip: "invalid" });
    expect(isCalcomEvent({ id: "x", iCalUID: "abc123@Cal.com" })).toBe(true);
  });
});

describe("planSync", () => {
  it("brings a hand-typed event into the CRM once, and skips what is not a booking", () => {
    const calendar = [
      event(),
      event({
        id: "allday",
        start: { date: "2026-10-15" },
        end: { date: "2026-10-16" },
      }),
      event({ id: "cal", iCalUID: "u@Cal.com" }),
    ];

    const plan = planSync(calendar, [], NOW);

    expect(plan.creates.map((r) => r.externalId)).toEqual(["gcal:evt1"]);
    expect(plan.skipped).toEqual({ allDay: 1, calcom: 1, invalid: 0 });
  });

  it("does nothing when the CRM already matches Google", () => {
    const known = appointment({
      id: 7,
      source: "google",
      external_id: "gcal:evt1",
      title: "Brendan Feilberg",
      start_at: "2026-10-16T15:00:00.000Z",
      end_at: "2026-10-16T16:00:00.000Z",
    });

    const plan = planSync([event()], [known], NOW);

    expect(plan).toMatchObject({
      creates: [],
      updates: [],
      cancels: [],
      pushCreates: [],
    });
  });

  it("follows a time moved in Google, and a cancellation", () => {
    const known = appointment({
      id: 7,
      source: "google",
      external_id: "gcal:evt1",
      title: "Brendan Feilberg",
    });
    const moved = event({
      start: { dateTime: "2026-10-17T08:00:00-07:00" },
      end: { dateTime: "2026-10-17T09:00:00-07:00" },
    });
    const gone = event({ status: "cancelled" });

    expect(planSync([moved], [known], NOW).updates).toEqual([
      {
        id: 7,
        patch: {
          title: "Brendan Feilberg",
          start_at: "2026-10-17T15:00:00.000Z",
          end_at: "2026-10-17T16:00:00.000Z",
        },
      },
    ]);
    expect(planSync([gone], [known], NOW).cancels).toEqual([7]);
  });

  it("sends CRM-made appointments to Google, but not Cal.com ones", () => {
    const manual = appointment({ id: 1 });
    const cal = appointment({ id: 2, source: "calcom", external_id: "uid-2" });
    const past = appointment({
      id: 3,
      start_at: "2026-09-01T15:00:00Z",
      end_at: "2026-09-01T16:00:00Z",
    });

    const plan = planSync([], [manual, cal, past], NOW);

    expect(plan.pushCreates.map((a) => a.id)).toEqual([1]);
  });

  it("links an event the CRM sent instead of sending it again", () => {
    const sent = event({
      id: "evt9",
      summary: "Oil Lee",
      start: { dateTime: "2026-10-16T08:00:00-07:00" },
      end: { dateTime: "2026-10-16T09:00:00-07:00" },
      extendedProperties: { private: { crmAppointmentId: "1" } },
    });

    const plan = planSync([sent], [appointment({ id: 1 })], NOW);

    expect(plan.links).toEqual([{ id: 1, externalId: "gcal:evt9" }]);
    expect(plan.pushCreates).toEqual([]);
    expect(plan.creates).toEqual([]);
  });

  it("lets the later edit win for a CRM-made appointment", () => {
    const sent = (updated: string) =>
      event({
        id: "evt9",
        summary: "Oil Lee",
        updated,
        start: { dateTime: "2026-10-17T08:00:00-07:00" },
        end: { dateTime: "2026-10-17T09:00:00-07:00" },
        extendedProperties: { private: { crmAppointmentId: "1" } },
      });
    const mine = appointment({
      id: 1,
      external_id: "gcal:evt9",
      updated_at: "2026-10-14T12:00:00Z",
    });

    const googleNewer = planSync([sent("2026-10-14T13:00:00Z")], [mine], NOW);
    const crmNewer = planSync([sent("2026-10-14T11:00:00Z")], [mine], NOW);

    expect(googleNewer.updates).toHaveLength(1);
    expect(googleNewer.pushPatches).toEqual([]);
    expect(crmNewer.pushPatches).toHaveLength(1);
    expect(crmNewer.updates).toEqual([]);
  });

  it("takes a cancelled CRM appointment off the calendar", () => {
    const sent = event({
      id: "evt9",
      summary: "Oil Lee",
      extendedProperties: { private: { crmAppointmentId: "1" } },
    });
    const mine = appointment({
      id: 1,
      external_id: "gcal:evt9",
      status: "cancelled",
    });

    const plan = planSync([sent], [mine], NOW);

    expect(plan.pushDeletes.map((d) => d.eventId)).toEqual(["evt9"]);
  });
});

describe("eventFromAppointment", () => {
  it("carries the CRM id so the event is recognised when it comes back", () => {
    const body = eventFromAppointment(
      appointment({ id: 5, vehicle: "2019 F-150", notes: "Gb n cc leave" }),
      "https://crm.example/#/calendar",
    );

    expect(body).toMatchObject({
      summary: "Oil Lee",
      description:
        "2019 F-150\nGb n cc leave\nCRM: https://crm.example/#/calendar",
      extendedProperties: { private: { crmAppointmentId: "5" } },
      start: { timeZone: "America/Dawson_Creek" },
    });
  });
});
