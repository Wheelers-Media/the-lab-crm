import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";

import { ContactOrders } from "./ContactOrders";

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

describe("ContactOrders", () => {
  it("shows lifetime spend without double-counting the booking deposit", async () => {
    // Arrange
    const orders = [
      order(1),
      order(2, {
        total: 50,
        is_deposit: true,
        categories: ["Deposit"],
        line_items: [
          { name: "$50 Secure Booking Deposit", quantity: 1, price: 50 },
        ],
      }),
      order(3, { contact_id: 2, total: 999 }),
    ];

    // Act
    const screen = await render(
      <StoryWrapper data={{ orders }}>
        <ContactOrders contactId={1} />
      </StoryWrapper>,
    );

    // Assert
    await expect.element(screen.getByText("$260.00").first()).toBeVisible();
    await expect.element(screen.getByText("1 order")).toBeVisible();
    await expect
      .element(screen.getByText("Ceramic Tint - Front Roll Ups"))
      .toBeVisible();
    await expect.element(screen.getByText(/#1202 · Deposit/)).toBeVisible();
    await expect.element(screen.getByText("$999.00")).not.toBeInTheDocument();
  });

  it("says so when the contact has never ordered", async () => {
    const screen = await render(
      <StoryWrapper data={{ orders: [] }}>
        <ContactOrders contactId={1} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByText("No Shopify orders yet."))
      .toBeVisible();
  });

  it("links to the full order list once there are more than five", async () => {
    const orders = Array.from({ length: 7 }, (_, i) => order(i + 1));

    const screen = await render(
      <StoryWrapper data={{ orders }}>
        <ContactOrders contactId={1} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("link", { name: "See all 7 orders" }))
      .toBeVisible();
    await expect.element(screen.getByText("$1,820.00")).toBeVisible();
  });
});
