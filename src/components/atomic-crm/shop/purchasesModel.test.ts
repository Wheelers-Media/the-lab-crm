import { describe, expect, it } from "vitest";

import type { Order } from "../types";
import { purchaseLedger } from "./purchasesModel";

const order = (id: number, over: Partial<Order> = {}): Order => ({
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
  ...over,
});

describe("purchaseLedger", () => {
  it("adds up lifetime spend and the average order, less refunds", () => {
    const { summary } = purchaseLedger([
      order(1, { total: 260, refunded_amount: 60 }),
      order(2, { total: 500, ordered_at: "2026-10-01T16:00:00Z" }),
    ]);

    expect(summary).toMatchObject({
      orderCount: 2,
      lifetimeSpend: 700,
      averageOrder: 350,
      lastPurchasedAt: "2026-10-01T16:00:00Z",
      firstPurchasedAt: "2026-09-11T16:00:00Z",
    });
  });

  it("leaves deposits and cancelled orders out of spend but keeps them in the history", () => {
    const ledger = purchaseLedger([
      order(1),
      order(2, {
        total: 50,
        is_deposit: true,
        line_items: [
          { name: "$50 Secure Booking Deposit", quantity: 1, price: 50 },
        ],
      }),
      order(3, {
        total: 900,
        ordered_at: "2026-10-02T16:00:00Z",
        cancelled_at: "2026-10-03T16:00:00Z",
      }),
    ]);

    expect(ledger.summary.orderCount).toBe(1);
    expect(ledger.summary.lifetimeSpend).toBe(260);
    // The deposit still counts as the latest purchase, just not as spend
    expect(ledger.summary.lastPurchasedAt).toBe("2026-09-12T16:00:00Z");
    expect(ledger.history.map((o) => o.id)).toEqual([3, 2, 1]);
    expect(ledger.items.map((i) => i.name)).toEqual([
      "Ceramic Tint - Front Roll Ups",
    ]);
  });

  it("groups repeat buys into one item with its count, spend and dates", () => {
    const tint = {
      name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
      quantity: 1,
      price: 260,
    };
    const { items, summary } = purchaseLedger([
      order(1, {
        total: 260,
        line_items: [tint],
        ordered_at: "2026-01-10T16:00:00Z",
      }),
      order(2, {
        total: 520,
        line_items: [{ ...tint, quantity: 2 }],
        ordered_at: "2026-06-10T16:00:00Z",
      }),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Ceramic Tint - Front Roll Ups",
      quantity: 3,
      orders: 2,
      spent: 780,
      lastPurchasedAt: "2026-06-10T16:00:00Z",
      firstPurchasedAt: "2026-01-10T16:00:00Z",
    });
    expect(summary).toMatchObject({ distinctItems: 1, units: 3 });
  });

  it("keeps item spend equal to lifetime spend when an order is partly refunded", () => {
    const { items, summary } = purchaseLedger([
      order(1, {
        total: 520,
        refunded_amount: 260,
        line_items: [
          {
            name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
            quantity: 1,
            price: 260,
          },
          {
            name: "Universal Fit - THE LAB - Headlight Restoration",
            quantity: 1,
            price: 260,
          },
        ],
      }),
    ]);

    expect(summary.lifetimeSpend).toBe(260);
    expect(items.reduce((sum, i) => sum + i.spent, 0)).toBe(260);
  });

  it("leaves fees, shipping and shop supplies out of what they bought", () => {
    const { items } = purchaseLedger([
      order(1, {
        total: 300,
        line_items: [
          {
            name: "Universal Fit - THE LAB - Headlight Restoration",
            quantity: 1,
            price: 150,
          },
          { name: "Shipping - Standard", quantity: 1, price: 20 },
          { name: "Shop supplies", quantity: 1, price: 130 },
        ],
      }),
    ]);

    expect(items.map((i) => i.name)).toEqual(["Headlight Restoration"]);
  });

  it("says nothing was bought when there are no orders", () => {
    const ledger = purchaseLedger([]);

    expect(ledger.summary).toMatchObject({
      orderCount: 0,
      lifetimeSpend: 0,
      averageOrder: null,
      lastPurchasedAt: null,
      distinctItems: 0,
    });
    expect(ledger.items).toEqual([]);
    expect(ledger.history).toEqual([]);
  });
});
