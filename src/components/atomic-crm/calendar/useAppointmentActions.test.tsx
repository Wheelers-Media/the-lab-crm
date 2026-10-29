import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";

import { AppointmentRow } from "../operations/OperationsWidgets";
import type { Appointment } from "../types";

const HOUR = 3_600_000;

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 1,
  external_id: "gcal:evt1",
  source: "google",
  contact_id: 1,
  deal_id: null,
  task_id: null,
  title: "Ceramic tint, crew cab",
  resource: "detailing-bay",
  start_at: new Date(Date.now() - HOUR).toISOString(),
  end_at: new Date(Date.now() + HOUR).toISOString(),
  status: "booked",
  deposit_paid: true,
  vehicle: "2019 f150 Raptor",
  notes: null,
  created_at: "2026-10-01T15:00:00.000Z",
  updated_at: "2026-10-02T15:00:00.000Z",
  ...overrides,
});

const contact = buildContact({
  id: 1,
  phone_jsonb: [{ number: "(778) 256-4486", type: "Work" }],
});

const renderRow = (booking: Appointment) =>
  render(
    <StoryWrapper data={{ contacts: [contact], appointments: [booking] }}>
      <AppointmentRow appointment={booking} contact={contact} />
    </StoryWrapper>,
  );

/** The labels in the open action sheet, read from the DOM. */
const sheetLabels = (): string[] =>
  [...document.querySelectorAll('[role="dialog"] li button')].map(
    (b) => b.textContent?.trim() ?? "",
  );

describe("booking hold menu", () => {
  it("offers calling, settling and cancelling a booking that has started", async () => {
    // Arrange
    const booking = appointment();
    await renderRow(booking);

    // Act: right-click is the desk's tap and hold
    await userEvent.click(page.getByText("Ceramic tint, crew cab"), {
      button: "right",
    });

    // Assert
    await expect.poll(sheetLabels).toContain("Cancel booking");
    const labels = sheetLabels();
    expect(labels).toContain("Call (778) 256-4486");
    expect(labels).toContain("Send a text");
    expect(labels).toContain("Open customer");
    expect(labels).toContain("Mark done");
    expect(labels).toContain("No-show");
    expect(labels).not.toContain("Open the job");
  });

  it("leaves Done and No-show out for a booking still to come", async () => {
    // Arrange
    const later = appointment({
      start_at: new Date(Date.now() + 24 * HOUR).toISOString(),
      end_at: new Date(Date.now() + 25 * HOUR).toISOString(),
    });
    await renderRow(later);

    // Act
    await userEvent.click(page.getByText("Ceramic tint, crew cab"), {
      button: "right",
    });

    // Assert
    await expect.poll(sheetLabels).toContain("Cancel booking");
    expect(sheetLabels()).not.toContain("Mark done");
    expect(sheetLabels()).not.toContain("No-show");
  });

  it("cancels with an Undo instead of asking first", async () => {
    // Arrange
    await renderRow(appointment());
    await userEvent.click(page.getByText("Ceramic tint, crew cab"), {
      button: "right",
    });
    await expect.poll(sheetLabels).toContain("Cancel booking");

    // Act
    await page.getByRole("button", { name: "Cancel booking" }).click();

    // Assert
    await expect.element(page.getByText("Booking cancelled")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /undo/i }))
      .toBeVisible();
  });

  it("offers Back to booked, not Cancel, once a visit is settled", async () => {
    // Arrange
    await renderRow(appointment({ status: "completed" }));

    // Act
    await userEvent.click(page.getByText("Ceramic tint, crew cab"), {
      button: "right",
    });

    // Assert
    await expect.poll(sheetLabels).toContain("Back to booked");
    expect(sheetLabels()).not.toContain("Cancel booking");
  });
});
