import { describe, expect, it } from "vitest";

import { parseShopifyOrder } from "./parse.ts";
import { ordersFromCsv, toIsoDate } from "./shopifyCsv.ts";

// Shape of Shopify's admin order export: one row per line item, order-level
// columns only on the first row.
const firstRow = {
  Name: "#1450",
  Id: "6100000450",
  Email: "Pat@Example.com",
  "Financial Status": "paid",
  "Paid at": "2025-11-02 14:05:10 -0700",
  "Fulfillment Status": "unfulfilled",
  Currency: "CAD",
  Subtotal: "440.00",
  Total: "462.00",
  "Created at": "2025-11-02 14:04:58 -0700",
  "Lineitem quantity": "1",
  "Lineitem name": "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
  "Lineitem price": "260.00",
  "Lineitem sku": "",
  "Billing Name": "Pat van der Berg",
  "Billing Phone": "+12505550199",
  "Billing Company": "",
  "Shipping Phone": "",
  Notes: "",
  "Cancelled at": "",
  "Refunded Amount": "0.00",
  Source: "pos",
  Phone: "",
};

const secondRow = {
  Name: "#1450",
  "Lineitem quantity": "1",
  "Lineitem name":
    "Universal Fit - Suntek - Ceramic Tint - Windshield Brow (1 Piece)",
  "Lineitem price": "180.00",
};

describe("toIsoDate", () => {
  it("turns Shopify's export date into an ISO timestamp", () => {
    expect(toIsoDate("2025-11-02 14:05:10 -0700")).toBe(
      "2025-11-02T14:05:10-07:00",
    );
    expect(toIsoDate("")).toBe("");
  });
});

describe("ordersFromCsv", () => {
  it("groups line-item rows into one order the webhook parser understands", () => {
    // Act
    const { orders, skipped } = ordersFromCsv([firstRow, secondRow]);
    const parsed = parseShopifyOrder(orders[0]);

    // Assert
    expect(skipped).toEqual([]);
    expect(orders).toHaveLength(1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.shopifyOrderId).toBe("6100000450");
    expect(parsed.value.orderNumber).toBe("#1450");
    expect(parsed.value.total).toBe(462);
    expect(parsed.value.lineItems).toHaveLength(2);
    expect(parsed.value.categories).toEqual(["Tint"]);
    expect(parsed.value.orderedAt).toBe("2025-11-02T14:05:10-07:00");
    expect(parsed.value.contact.email).toBe("pat@example.com");
    expect(parsed.value.contact.firstName).toBe("Pat");
    expect(parsed.value.contact.lastName).toBe("Van Der Berg");
  });

  it("carries the refunded amount so lifetime spend is net of refunds", () => {
    const { orders } = ordersFromCsv([
      {
        ...firstRow,
        "Financial Status": "partially_refunded",
        "Refunded Amount": "180.00",
      },
    ]);
    const parsed = parseShopifyOrder(orders[0]);
    expect(parsed.ok && parsed.value.refundedAmount).toBe(180);
  });

  it("skips orders that were never paid, and says why", () => {
    const { orders, skipped } = ordersFromCsv([
      { ...firstRow, Name: "#1451", Id: "1", "Financial Status": "pending" },
      { ...firstRow, Name: "#1452", Id: "", "Financial Status": "paid" },
    ]);
    expect(orders).toEqual([]);
    expect(skipped).toEqual([
      { name: "#1451", reason: 'payment status "pending"' },
      { name: "#1452", reason: "no order Id column" },
    ]);
  });

  it("marks a booking deposit order as a deposit", () => {
    const { orders } = ordersFromCsv([
      {
        ...firstRow,
        Total: "50.00",
        Subtotal: "50.00",
        "Lineitem name": "$50 Secure Booking Deposit",
        "Lineitem price": "50.00",
      },
    ]);
    const parsed = parseShopifyOrder(orders[0]);
    expect(parsed.ok && parsed.value.isDeposit).toBe(true);
  });
});
