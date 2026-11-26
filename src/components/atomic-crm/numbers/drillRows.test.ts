import { describe, expect, it } from "vitest";

import type { Deal, Order, ShopifyCheckout } from "../types";
import { cartRows, customersInRange, dealRows, orderRows } from "./drillRows";

const order = (over: Partial<Order>): Order =>
  ({
    id: 1,
    order_number: "1001",
    ordered_at: "2026-11-10T18:00:00Z",
    total: 100,
    subtotal: 90,
    refunded_amount: 0,
    currency: "CAD",
    line_items: [{ name: "EZ LYNK Tune", quantity: 1, price: 90 }],
    contact_id: 5,
    is_deposit: false,
    cancelled_at: null,
    ...over,
  }) as Order;

describe("orderRows", () => {
  it("lists newest first and links each row to its order page", () => {
    const rows = orderRows([
      order({ id: 1, ordered_at: "2026-11-01T00:00:00Z" }),
      order({ id: 2, ordered_at: "2026-11-09T00:00:00Z" }),
    ]);
    expect(rows.map((r) => r.key)).toEqual([2, 1]);
    expect(rows[0].to).toBe("/orders/2/show");
  });
});

describe("dealRows", () => {
  it("links each job to its page and shows when it came in", () => {
    const rows = dealRows([
      {
        id: 7,
        name: "Quote - Dale",
        stage: "ready_to_book",
        created_at: "2026-11-02T00:00:00Z",
        amount: 0,
      } as Deal,
    ]);
    expect(rows[0].to).toBe("/deals/7/show");
    expect(String(rows[0].subtitle)).toContain("ready to book");
  });
});

describe("cartRows", () => {
  it("opens the cart in place so it can be worked", () => {
    let opened: ShopifyCheckout | null = null;
    const cart = {
      id: 3,
      customer_name: "Dale",
      total: 250,
      line_items: [],
      checkout_updated_at: "2026-11-25T00:00:00Z",
    } as unknown as ShopifyCheckout;
    const [row] = cartRows([cart], (c) => (opened = c));
    row.onOpen?.();
    expect(opened).toBe(cart);
    expect(row.to).toBeUndefined();
  });
});

describe("customersInRange", () => {
  const range = {
    start: new Date("2026-11-01T00:00:00Z"),
    end: new Date("2026-12-01T00:00:00Z"),
  };
  it("splits who ordered into new and returning by first order ever", () => {
    const { active, added, returning } = customersInRange(
      [
        order({ contact_id: 1, ordered_at: "2026-11-05T00:00:00Z" }),
        order({ id: 2, contact_id: 2, ordered_at: "2026-11-06T00:00:00Z" }),
        order({ id: 3, contact_id: 2, ordered_at: "2026-05-01T00:00:00Z" }),
        order({ id: 4, contact_id: 3, ordered_at: "2026-05-01T00:00:00Z" }),
      ],
      range,
    );
    expect(active.map((r) => r.contactId).sort()).toEqual([1, 2]);
    expect(added.map((r) => r.contactId)).toEqual([1]);
    expect(returning.map((r) => r.contactId)).toEqual([2]);
  });
});
