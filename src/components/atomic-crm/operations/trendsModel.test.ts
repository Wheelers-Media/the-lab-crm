import { describe, expect, it } from "vitest";

import type { Appointment, Deal, Order } from "../types";
import { shopDayKey } from "./shopTime";
import {
  mixTotals,
  movers,
  periodBuckets,
  trends,
  weeklyMix,
} from "./trendsModel";

// Wednesday Oct 28, 2026, mid-afternoon on the shop clock
const NOW = new Date("2026-10-28T22:00:00Z");
const at = (iso: string) => new Date(iso).toISOString();

let id = 1;
const order = (
  orderedAt: string,
  lines: Array<[string, number, number?]>,
  extra: Partial<Order> = {},
): Order => {
  const line_items = lines.map(([name, price, quantity = 1]) => ({
    name,
    price,
    quantity,
  }));
  const total = line_items.reduce((s, l) => s + l.price * l.quantity, 0);
  return {
    id: id++,
    shopify_order_id: null,
    order_number: `#${id}`,
    contact_id: 1,
    deal_id: null,
    source: "web",
    financial_status: "paid",
    fulfillment_status: null,
    currency: "CAD",
    subtotal: total,
    total,
    refunded_amount: 0,
    line_items,
    categories: [],
    is_deposit: false,
    ordered_at: at(orderedAt),
    cancelled_at: null,
    created_at: at(orderedAt),
    ...extra,
  };
};

describe("periodBuckets", () => {
  it("returns months oldest first, with this month cut at now", () => {
    const buckets = periodBuckets("month", NOW, 3);

    expect(buckets.map((b) => shopDayKey(b.start))).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(buckets[2].end.getTime()).toBe(NOW.getTime());
  });

  it("returns whole weeks starting on Monday", () => {
    const [first, second] = periodBuckets("week", NOW, 2);
    expect(shopDayKey(first.start)).toBe("2026-10-19");
    expect(shopDayKey(second.start)).toBe("2026-10-26");
  });
});

describe("trends", () => {
  const deal = (createdAt: string, stage: string) =>
    ({ id: id++, created_at: at(createdAt), stage }) as unknown as Deal;
  const dropOff = (startAt: string) =>
    ({
      id: id++,
      resource: "detailing-bay",
      status: "booked",
      start_at: at(startAt),
    }) as unknown as Appointment;

  it("splits customers into new and returning by their first order ever", () => {
    // Arrange: customer 1 first bought in August, customer 2 is new this month
    const orders = [
      order("2026-08-10T18:00:00Z", [["Ceramic Tint", 260]]),
      order("2026-10-05T18:00:00Z", [["Standard Signature", 329]]),
      order("2026-10-06T18:00:00Z", [["Headlight Restoration", 150]], {
        contact_id: 2,
      }),
    ];

    // Act
    const { current } = trends(
      { orders, ledgerOrders: orders, deals: [], appointments: [] },
      "month",
      NOW,
    );

    // Assert
    expect(current.newCustomers).toBe(1);
    expect(current.returningCustomers).toBe(1);
    expect(current.salesOrders).toBe(2);
    expect(current.averageTicket).toBe(239.5);
  });

  it("leaves deposits out of revenue, the order count and the ticket", () => {
    const orders = [
      order("2026-10-05T18:00:00Z", [["Standard Signature", 329]]),
      order("2026-10-06T18:00:00Z", [["$50 Secure Booking Deposit", 50]], {
        is_deposit: true,
      }),
    ];
    const { current } = trends(
      { orders, ledgerOrders: orders, deals: [], appointments: [] },
      "month",
      NOW,
    );
    expect(current.revenue).toBe(329);
    expect(current.salesOrders).toBe(1);
    expect(current.averageTicket).toBe(329);
  });

  it("counts leads, booked leads and bay use for the week", () => {
    const { current } = trends(
      {
        orders: [],
        ledgerOrders: [],
        deals: [
          deal("2026-10-26T18:00:00Z", "booked"),
          deal("2026-10-27T18:00:00Z", "intake"),
        ],
        // Mon to Wed so far: 3 workdays x 2 slots = 6, 3 booked
        appointments: [
          dropOff("2026-10-26T15:00:00Z"),
          dropOff("2026-10-27T15:00:00Z"),
          dropOff("2026-10-28T15:00:00Z"),
        ],
      },
      "week",
      NOW,
    );
    expect(current.leads).toBe(2);
    expect(current.bookedLeads).toBe(1);
    expect(current.bayUse).toBe(50);
  });
});

describe("weeklyMix", () => {
  it("files each line under its kind of work and shares refunds out", () => {
    // Arrange: one order with a detail and a tint, $100 refunded
    const orders = [
      order(
        "2026-10-27T18:00:00Z",
        [
          ["Standard Signature (Small SUV/Truck)", 300],
          ["Universal Fit - Suntek - Ceramic Tint - Front Roll Ups", 300],
        ],
        { refunded_amount: 100 },
      ),
      order("2026-10-20T18:00:00Z", [
        ['2017-2025 Duramax 6.6L - Polar - 4" Exhaust', 1000],
      ]),
    ];

    // Act
    const weeks = weeklyMix(orders, NOW, 2);

    // Assert
    expect(weeks[1].partial).toBe(true);
    expect(weeks[1].groups.detail).toBe(250);
    expect(weeks[1].groups.tint).toBe(250);
    expect(weeks[1].total).toBe(500);
    expect(weeks[0].groups.parts).toBe(1000);
    expect(mixTotals(weeks).map((g) => [g.key, g.share])).toEqual([
      ["parts", 67],
      ["detail", 17],
      ["tint", 17],
    ]);
  });

  it("leaves out deposits and cancelled orders", () => {
    const orders = [
      order("2026-10-27T18:00:00Z", [["$50 Secure Booking Deposit", 50]], {
        is_deposit: true,
      }),
      order("2026-10-27T18:00:00Z", [["Ceramic Tint", 260]], {
        cancelled_at: at("2026-10-27T19:00:00Z"),
      }),
    ];
    expect(weeklyMix(orders, NOW, 1)[0].total).toBe(0);
  });
});

describe("movers", () => {
  it("ranks by dollars gained or lost, not by percent", () => {
    const range = {
      start: new Date("2026-10-01T07:00:00Z"),
      end: NOW,
    };
    const previous = {
      start: new Date("2026-09-01T07:00:00Z"),
      end: new Date("2026-09-28T22:00:00Z"),
    };
    const orders = [
      order("2026-10-05T18:00:00Z", [["Ceramic Tint", 2600]]),
      order("2026-09-05T18:00:00Z", [["Ceramic Tint", 600]]),
      order("2026-10-05T18:00:00Z", [["Odour Elimination (Ozone)", 140]]),
      order("2026-09-05T18:00:00Z", [["Odour Elimination (Ozone)", 70]]),
      order("2026-09-08T18:00:00Z", [["Headlight Restoration", 150]]),
    ];

    const result = movers(orders, range, previous);

    expect(result.map((m) => m.name)).toEqual([
      "Ceramic Tint",
      "Headlight Restoration",
      "Odour Elimination (Ozone)",
    ]);
    expect(result[0].change).toBe(333);
    expect(result[1].change).toBe(-100);
  });
});
