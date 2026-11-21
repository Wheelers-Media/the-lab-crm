import { describe, expect, it } from "vitest";

import type { Order } from "../types";
import { workDone } from "./workDone";

const NOW = new Date("2026-11-21T18:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

let nextId = 1;
const order = (
  daysBack: number,
  name: string,
  extra: Partial<Order> = {},
): Order => ({
  id: nextId++,
  shopify_order_id: null,
  order_number: `#${nextId}`,
  contact_id: 7,
  deal_id: null,
  source: "web",
  financial_status: "paid",
  fulfillment_status: null,
  currency: "CAD",
  subtotal: 100,
  total: 100,
  refunded_amount: 0,
  line_items: [{ name, quantity: 1, price: 100 }],
  categories: [],
  is_deposit: false,
  ordered_at: daysAgo(daysBack),
  cancelled_at: null,
  created_at: daysAgo(daysBack),
  ...extra,
});

describe("workDone", () => {
  it("groups paid work by kind, newest kind first, with a count and last date", () => {
    const done = workDone([
      order(200, "Complete Standard Signature"),
      order(30, "Complete Standard Signature"),
      order(90, "Ceramic tint, crew cab truck"),
    ]);
    expect(done.map((d) => [d.label, d.times])).toEqual([
      ["Detail", 2],
      ["Tint", 1],
    ]);
    expect(done[0].last).toBe(daysAgo(30));
  });

  it("ignores deposits and cancelled orders", () => {
    expect(
      workDone([
        order(5, "Booking deposit", { is_deposit: true }),
        order(5, "Ceramic tint", { cancelled_at: daysAgo(4) }),
      ]),
    ).toEqual([]);
  });
});
