import type { CreateParams, UpdateParams } from "ra-core";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { buildContact, buildDeal, StoryWrapper } from "@/test/StoryWrapper";

import type { Package } from "../types";
import { AppointmentCreateDialog } from "./AddAppointment";

const lightBar = {
  id: 9,
  shopify_product_id: "9",
  title: "Baja Designs light bar",
  shopify_title: "Baja Designs light bar",
  vendor: "Baja Designs",
  category: null,
  bay: "parts",
  price: 400,
  price_max: null,
  variants: [
    { id: "gid://shopify/ProductVariant/1", title: "Default", price: 400 },
  ],
  status: "active",
  shopify_updated_at: null,
  synced_at: "2026-10-01T00:00:00Z",
  kind: "product",
  product_type: "Lighting",
  handle: "light-bar",
  image_url: null,
  inventory: 3,
} as unknown as Package;

const contact = buildContact({ id: 3, first_name: "Brendan" });

/** Renders the booking form for Brendan and records what gets created. */
const renderBooking = (deals = [] as ReturnType<typeof buildDeal>[]) => {
  const created: Array<{ resource: string; data: Record<string, unknown> }> =
    [];
  const updated: Array<{ resource: string; data: Record<string, unknown> }> =
    [];
  const screen = render(
    <StoryWrapper
      data={{ contacts: [contact], deals, packages: [lightBar], vehicles: [] }}
      dataProvider={{
        create: async (resource: string, params: CreateParams) => {
          created.push({ resource, data: params.data });
          return { data: { ...params.data, id: 100 + created.length } };
        },
        update: async (resource: string, params: UpdateParams) => {
          updated.push({ resource, data: params.data });
          return { data: { ...params.previousData, ...params.data } };
        },
      }}
    >
      <AppointmentCreateDialog
        open
        onOpenChange={() => undefined}
        defaults={{
          day: "2026-11-02",
          contact_id: 3,
          title: "Light bar install",
        }}
      />
    </StoryWrapper>,
  );
  return { screen, created, updated };
};

const addLightBar = async () => {
  await page.getByRole("button", { name: "Add products" }).click();
  await page.getByLabelText("Search parts by name or SKU").fill("baja");
  await page
    .getByRole("button", { name: "Add Baja Designs light bar" })
    .click();
};

describe("booking with products", () => {
  it("saves the products on a new job and books against it", async () => {
    // Arrange
    const { created } = renderBooking();
    await expect
      .element(page.getByText("Add appointment").first())
      .toBeVisible();

    // Act
    await addLightBar();
    await expect
      .element(page.getByText("A new job for this booking").first())
      .toBeVisible();
    await page.getByRole("button", { name: "Add appointment" }).click();

    // Assert
    await expect
      .poll(() => created.map((c) => c.resource))
      .toEqual(["deals", "appointments"]);
    expect(created[0].data).toMatchObject({
      name: "Light bar install",
      contact_ids: [3],
      stage: "booked",
      amount: 400,
    });
    expect(created[0].data.packages).toEqual([
      expect.objectContaining({ title: "Baja Designs light bar", price: 400 }),
    ]);
    expect(created[1].data).toMatchObject({ contact_id: 3, deal_id: 101 });
    expect(created[1].data).not.toHaveProperty("packages");
  });

  it("adds the products to the customer's open job instead, when there is one", async () => {
    // Arrange
    const quoted = buildDeal({
      id: 7,
      name: "Lighting quote",
      stage: "quoted",
      contact_ids: [3],
      packages: [],
      updated_at: "2026-10-20T00:00:00Z",
    });
    const { created, updated } = renderBooking([quoted]);

    // Act
    await addLightBar();
    await expect
      .element(page.getByText("Lighting quote (Quoted)").first())
      .toBeVisible();
    await page.getByRole("button", { name: "Add appointment" }).click();

    // Assert
    await expect
      .poll(() => created.map((c) => c.resource))
      .toEqual(["appointments"]);
    expect(updated[0]).toMatchObject({
      resource: "deals",
      data: { stage: "booked", amount: 400 },
    });
    expect(created[0].data).toMatchObject({ deal_id: 7 });
  });
});
