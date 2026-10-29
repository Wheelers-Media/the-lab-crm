import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { buildContact, StoryWrapper } from "@/test/StoryWrapper";

import type { ContactNote } from "../types";
import { NoteMobile } from "./NotesIteratorMobile";

const note: ContactNote = {
  id: 7,
  contact_id: 1,
  text: "Wants the tint darker on the back glass",
  date: "2026-10-20T15:00:00.000Z",
  sales_id: 0,
  status: "warm",
} as ContactNote;

/** The labels in the open action sheet, read from the DOM. */
const sheetLabels = (): string[] =>
  [...document.querySelectorAll('[role="dialog"] li button')].map(
    (b) => b.textContent?.trim() ?? "",
  );

describe("note hold menu", () => {
  it("offers edit, copy and an undoable delete", async () => {
    // Arrange
    await render(
      <StoryWrapper
        data={{ contacts: [buildContact({ id: 1 })], contact_notes: [note] }}
      >
        <NoteMobile note={note} contactId={1} />
      </StoryWrapper>,
    );
    await expect.element(page.getByText(/tint darker/)).toBeVisible();

    // Act
    await userEvent.click(page.getByText(/tint darker/), { button: "right" });
    await expect.poll(sheetLabels).toContain("Delete note");
    expect(sheetLabels()).toEqual(["Edit note", "Copy text", "Delete note"]);
    await page.getByRole("button", { name: "Delete note" }).click();

    // Assert
    await expect.element(page.getByText("Note deleted")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: /undo/i }))
      .toBeVisible();
  });
});
