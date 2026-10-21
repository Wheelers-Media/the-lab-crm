import { CoreAdminContext } from "ra-core";
import fakeDataProvider from "ra-data-fakerest";
import { MemoryRouter } from "react-router";
import { render } from "vitest-browser-react";

import { ContactPurchases } from "./ContactPurchases";

const order = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  shopify_order_id: String(6100000000 + id),
  order_number: `#${1200 + id}`,
  contact_id: 1,
  deal_id: null,
  source: "web",
  financial_status: "paid",
  fulfillment_status: null,
  currency: "CAD",
  subtotal: 260,
  total: 260,
  refunded_amount: 0,
  line_items: [
    {
      name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
      quantity: 1,
      price: 260,
    },
  ],
  categories: ["Tint"],
  is_deposit: false,
  ordered_at: `2026-09-${String(10 + id).padStart(2, "0")}T16:00:00Z`,
  cancelled_at: null,
  created_at: "2026-09-10T16:00:00Z",
  ...overrides,
});

const renderPurchases = (orders: unknown[]) => {
  const dataProvider = fakeDataProvider({ orders });
  return render(
    <MemoryRouter>
      <CoreAdminContext dataProvider={dataProvider}>
        <ContactPurchases contactId={1} />
      </CoreAdminContext>
    </MemoryRouter>,
  );
};

describe("ContactPurchases", () => {
  it("shows lifetime spend, orders and what they bought before", async () => {
    const screen = await renderPurchases([
      order(1),
      order(2, {
        ordered_at: "2026-10-02T16:00:00Z",
        total: 520,
        line_items: [
          {
            name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
            quantity: 2,
            price: 260,
          },
        ],
      }),
    ]);

    await expect.element(screen.getByText("$780.00").first()).toBeVisible();
    await expect
      .element(screen.getByText("Ceramic Tint - Front Roll Ups").first())
      .toBeVisible();
    await expect
      .element(screen.getByText("3 bought · 2 orders · last Oct 2, 2026"))
      .toBeVisible();
    await expect.element(screen.getByText("Order history")).toBeVisible();
    await expect.element(screen.getByText("Lifetime spend")).toBeVisible();
  });

  it("opens an order to show each line and where it went", async () => {
    const screen = await renderPurchases([order(1)]);

    await screen.getByRole("button", { name: /Sep 11, 2026/ }).click();

    await expect.element(screen.getByText("#1201")).toBeVisible();
    await expect
      .element(screen.getByText("Ceramic Tint - Front Roll Ups").first())
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Open in Orders" }))
      .toBeVisible();
  });

  it("says so when the customer has never bought anything", async () => {
    const screen = await renderPurchases([]);

    await expect.element(screen.getByText("Nothing bought yet")).toBeVisible();
  });
});
