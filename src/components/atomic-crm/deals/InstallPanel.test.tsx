import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildContact, buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import { InstallPanel } from "./InstallPanel";

const contact = buildContact({
  id: 1,
  first_name: "Sam",
  phone_jsonb: [{ number: "(778) 256-4486", type: "Work" }],
});

const renderPanel = (stage: string) =>
  render(
    <StoryWrapper
      data={{
        contacts: [contact],
        deals: [buildDeal({ id: 5, name: "Install", stage, contact_ids: [1] })],
      }}
    >
      <InstallPanel
        deal={buildDeal({ id: 5, name: "Install", stage, contact_ids: [1] })}
      />
    </StoryWrapper>,
  );

describe("InstallPanel", () => {
  it("offers Parts arrived while the parts are on the way, with no deposit", async () => {
    await renderPanel("parts_on_the_way");

    await expect
      .element(page.getByRole("button", { name: "Parts arrived" }))
      .toBeVisible();
    await expect.element(page.getByText(/No deposit is needed/)).toBeVisible();
  });

  it("moves the job to Ready to book when the parts arrive", async () => {
    await renderPanel("parts_on_the_way");

    await page.getByRole("button", { name: "Parts arrived" }).click();

    await expect
      .element(page.getByText(/Moved to Ready to book/))
      .toBeVisible();
  });

  it("offers the Text button once the job is ready to book", async () => {
    await renderPanel("ready_to_book");

    await expect
      .element(page.getByRole("button", { name: "Text" }))
      .toBeVisible();
  });

  it("shows nothing for a job that is not an install job", async () => {
    await renderPanel("quoted");

    await expect
      .element(page.getByRole("button", { name: "Parts arrived" }))
      .not.toBeInTheDocument();
  });
});
