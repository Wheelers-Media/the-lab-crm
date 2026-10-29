import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { buildContact, buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import { ContactQuotes } from "../packages/ContactQuotes";
import type { Deal } from "../types";

const contact = buildContact({
  id: 1,
  phone_jsonb: [{ number: "(778) 256-4486", type: "Work" }],
});

const renderQuotes = (deal: Deal) =>
  render(
    <StoryWrapper data={{ contacts: [contact], deals: [deal] }}>
      <ContactQuotes contact={contact} />
    </StoryWrapper>,
  );

/** The labels in the open action sheet, read from the DOM. */
const sheetLabels = (): string[] =>
  [...document.querySelectorAll('[role="dialog"] li button')].map(
    (b) => b.textContent?.trim() ?? "",
  );

const holdJob = async (name: string) => {
  await expect.element(page.getByText(name)).toBeVisible();
  await userEvent.click(page.getByText(name), { button: "right" });
};

describe("job hold menu", () => {
  it("offers the quote, the customer, the next stage and the ways out", async () => {
    // Arrange
    await renderQuotes(
      buildDeal({ name: "Tint, Raptor", stage: "quoted", contact_ids: [1] }),
    );

    // Act
    await holdJob("Tint, Raptor");

    // Assert
    await expect.poll(sheetLabels).toContain("Move to Booked");
    const labels = sheetLabels();
    expect(labels).toContain("Build quote");
    expect(labels).toContain("Call (778) 256-4486");
    expect(labels).toContain("Open customer");
    expect(labels).toContain("Not now");
    expect(labels).toContain("Archive job");
  });

  it("moves the job with an Undo", async () => {
    // Arrange
    await renderQuotes(
      buildDeal({ name: "Tint, Raptor", stage: "quoted", contact_ids: [1] }),
    );
    await holdJob("Tint, Raptor");
    await expect.poll(sheetLabels).toContain("Move to Booked");

    // Act
    await page.getByRole("button", { name: "Move to Booked" }).click();

    // Assert
    await expect.element(page.getByText("Moved to Booked")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /undo/i }))
      .toBeVisible();
  });
});
