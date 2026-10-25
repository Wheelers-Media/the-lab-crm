import { render } from "vitest-browser-react";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";

import type { Appointment } from "../types";
import { AppointmentDetail } from "./AppointmentDetail";
import { appointmentSource } from "./appointmentSource";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 1,
  external_id: "gcal:evt1",
  external_url: "https://www.google.com/calendar/event?eid=evt1",
  source: "google",
  contact_id: 1,
  deal_id: null,
  task_id: null,
  title: "Ceramic tint, crew cab",
  resource: "detailing-bay",
  start_at: "2026-10-16T15:00:00.000Z",
  end_at: "2026-10-16T17:00:00.000Z",
  status: "booked",
  deposit_paid: true,
  vehicle: "2019 f150 Raptor",
  notes: "2019 f150 Raptor\nDe-LUXX — call before noon",
  created_at: "2026-10-01T15:00:00.000Z",
  updated_at: "2026-10-02T15:00:00.000Z",
  ...overrides,
});

const contact = buildContact({
  city: "Fort St. John",
  email_jsonb: [{ email: "brendan@example.com", type: "Work" }],
  id: 1,
  lead_source: "phone",
  membership: "monthly-signature",
  phone_jsonb: [{ number: "(778) 256-4486", type: "Work" }],
  province: "BC",
});

/** The dialog Radix renders into the page, read from the DOM. */
const dialogText = (): string =>
  document.querySelector('[role="dialog"]')?.textContent ?? "";

const dialogLink = (selector: string): string | null =>
  document
    .querySelector('[role="dialog"]')
    ?.querySelector(selector)
    ?.getAttribute("href") ?? null;

const renderDetail = (overrides: Partial<Appointment> = {}) =>
  render(
    <StoryWrapper data={{ contacts: [contact] }}>
      <AppointmentDetail
        appointment={appointment(overrides)}
        contact={contact}
        open
        onOpenChange={() => undefined}
      />
    </StoryWrapper>,
  );

describe("AppointmentDetail", () => {
  it("shows the customer, what was written in Google, and the event itself", async () => {
    await renderDetail();

    await expect.poll(dialogText).toContain("call before noon");
    const text = dialogText();
    expect(text).toContain("Ceramic tint, crew cab");
    expect(text).toContain("Friday, October 16");
    expect(text).toContain("2019 f150 Raptor");
    expect(text).toContain("From Google Calendar");
    expect(text).toContain("Written in Google");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("(778) 256-4486");

    expect(dialogLink('a[href^="https://www.google.com/calendar"]')).toBe(
      "https://www.google.com/calendar/event?eid=evt1",
    );
    expect(dialogLink('a[href="/contacts/1/show"]')).toBe("/contacts/1/show");
    expect(dialogLink('a[href^="tel:"]')).toBe("tel:7782564486");
  });

  it("says a booking added in the CRM has no Google event", async () => {
    await renderDetail({
      external_id: null,
      external_url: null,
      source: "manual",
    });

    await expect.poll(dialogText).toContain("Added in the CRM");
    expect(dialogText()).not.toContain("From Google Calendar");
    expect(dialogLink('a[href^="https://www.google.com/calendar"]')).toBeNull();
  });

  it("names where each booking came from", () => {
    expect(appointmentSource(appointment())).toBe("From Google Calendar");
    expect(appointmentSource(appointment({ source: "calcom" }))).toBe(
      "Cal.com booking",
    );
    expect(appointmentSource(appointment({ source: "manual" }))).toBe(
      "Added in the CRM",
    );
  });
});
