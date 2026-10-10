import { describe, expect, it } from "vitest";

import type { Appointment, Deal, Order, ShopifyCheckout, Task } from "../types";
import {
  cartStats,
  cleanProductName,
  dayLoads,
  leadStats,
  needsAttention,
  openPipeline,
  orderRevenue,
  ordersByCategory,
  percentChange,
  shopifyStats,
  topProducts,
} from "./metrics";
import {
  addDays,
  mondayOf,
  periodRange,
  previousPeriodRange,
  shopDayKey,
  startOfShopDay,
} from "./shopTime";

// Friday Oct 9 2026, 9:00 in Fort St. John (UTC-7, no daylight saving)
const NOW = new Date("2026-10-09T16:00:00Z");

const deal = (over: Partial<Deal>): Deal =>
  ({
    id: Math.random(),
    name: "Deal",
    stage: "intake",
    amount: 0,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    contact_ids: [],
    ...over,
  }) as Deal;

describe("shop time", () => {
  it("uses the shop's calendar day, not UTC", () => {
    // 11 pm in Fort St. John is already the next day in UTC
    expect(shopDayKey("2026-10-10T06:00:00Z")).toBe("2026-10-09");
    expect(startOfShopDay("2026-10-09").toISOString()).toBe(
      "2026-10-09T07:00:00.000Z",
    );
  });

  it("starts weeks on Monday and handles month and year edges", () => {
    expect(mondayOf("2026-10-09")).toBe("2026-10-05");
    expect(mondayOf("2026-10-11")).toBe("2026-10-05");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("builds today, week and month ranges with matching previous periods", () => {
    const week = periodRange("week", NOW);
    expect(week.start.toISOString()).toBe("2026-10-05T07:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-10-12T07:00:00.000Z");
    const month = periodRange("month", NOW);
    expect(month.start.toISOString()).toBe("2026-10-01T07:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    // Compared with the same 8 days and 9 hours of September
    const before = previousPeriodRange("month", NOW);
    expect(before.start.toISOString()).toBe("2026-09-01T07:00:00.000Z");
    expect(before.end.toISOString()).toBe("2026-09-09T16:00:00.000Z");
    expect(previousPeriodRange("week", NOW).end.toISOString()).toBe(
      "2026-10-02T16:00:00.000Z",
    );
  });
});

describe("dashboard numbers", () => {
  it("counts revenue in the period net of refunds, skipping cancelled orders", () => {
    const orders = [
      { total: 500, refunded_amount: 50, ordered_at: "2026-10-02T18:00:00Z" },
      {
        total: 300,
        refunded_amount: 0,
        ordered_at: "2026-10-03T18:00:00Z",
        cancelled_at: "2026-10-03T19:00:00Z",
      },
      { total: 999, refunded_amount: 0, ordered_at: "2026-09-30T18:00:00Z" },
    ] as Order[];
    expect(orderRevenue(orders, periodRange("month", NOW))).toBe(450);
  });

  it("reports a percent change only when there is something to compare with", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(50, 0)).toBeNull();
  });

  it("counts leads created in the period and how many reached Booked or Converted", () => {
    const deals = [
      deal({ lead_source: "website", stage: "booked" }),
      deal({ lead_source: "website", stage: "quoted" }),
      deal({ stage: "won" }),
      deal({ stage: "lost", created_at: "2026-08-01T00:00:00Z" }),
    ];
    expect(leadStats(deals, periodRange("month", NOW))).toEqual({
      total: 3,
      website: 2,
      booked: 2,
      conversion: 67,
    });
  });

  it("sums only open deals in the pipeline", () => {
    const deals = [
      deal({ stage: "quoted", amount: 850 }),
      deal({ stage: "won", amount: 900 }),
      deal({
        stage: "intake",
        amount: 180,
        archived_at: "2026-10-01T00:00:00Z",
      }),
    ];
    expect(openPipeline(deals)).toEqual({ amount: 850, count: 1 });
  });

  it("counts detailing bay and Eric bookings per shop day, ignoring cancellations", () => {
    const appointments = [
      {
        resource: "detailing-bay",
        status: "booked",
        start_at: "2026-10-09T15:00:00Z",
      },
      {
        resource: "detailing-bay",
        status: "cancelled",
        start_at: "2026-10-09T15:30:00Z",
      },
      { resource: "eric", status: "booked", start_at: "2026-10-09T17:00:00Z" },
    ] as Appointment[];
    expect(dayLoads(appointments, ["2026-10-09", "2026-10-10"])).toEqual([
      { key: "2026-10-09", bay: 1, eric: 1 },
      { key: "2026-10-10", bay: 0, eric: 0 },
    ]);
  });
});

describe("needs attention", () => {
  it("lists big abandoned carts, unpaid upcoming bookings, new requests, stale quotes and overdue tasks", () => {
    const items = needsAttention({
      now: NOW,
      checkouts: [
        { total: 2640, checkout_updated_at: "2026-10-09T13:00:00Z" },
        { total: 300, checkout_updated_at: "2026-10-09T13:00:00Z" },
        { total: 5000, checkout_updated_at: "2026-10-09T15:30:00Z" }, // under an hour old
      ] as ShopifyCheckout[],
      appointments: [
        {
          title: "Highlander",
          status: "booked",
          deposit_paid: false,
          resource: "detailing-bay",
          start_at: "2026-10-12T15:00:00Z",
        },
        {
          title: "Paid",
          status: "booked",
          deposit_paid: true,
          resource: "detailing-bay",
          start_at: "2026-10-12T15:30:00Z",
        },
      ] as Appointment[],
      deals: [
        deal({ stage: "intake" }),
        deal({
          stage: "quoted",
          amount: 850,
          stage_changed_at: "2026-10-05T16:00:00Z",
        }),
        deal({
          stage: "quoted",
          amount: 260,
          stage_changed_at: "2026-10-08T16:00:00Z",
        }),
      ],
      tasks: [
        { due_date: "2026-10-08T16:00:00Z" },
        { due_date: "2026-10-08T16:00:00Z", done_date: "2026-10-08T17:00:00Z" },
        { due_date: "2026-10-10T16:00:00Z" },
      ] as Task[],
    });
    expect(items.map((i) => [i.kind, i.count])).toEqual([
      ["abandoned-cart", 1],
      ["no-deposit", 1],
      ["new-requests", 1],
      ["quotes-waiting", 1],
      ["overdue-tasks", 1],
    ]);
    expect(items[0].amount).toBe(2640);
    expect(items[1].detail).toBe("Highlander");
  });

  it("returns nothing when everything is handled", () => {
    expect(
      needsAttention({
        now: NOW,
        deals: [],
        appointments: [],
        checkouts: [],
        tasks: [],
      }),
    ).toEqual([]);
  });
});

const order = (over: Partial<Order>): Order =>
  ({
    id: Math.random(),
    order_number: "#1",
    contact_id: null,
    total: 0,
    refunded_amount: 0,
    line_items: [],
    categories: [],
    is_deposit: false,
    cancelled_at: null,
    ordered_at: "2026-10-02T18:00:00Z",
    ...over,
  }) as Order;

describe("shopify metrics", () => {
  const month = periodRange("month", NOW);

  it("counts sales orders, average and customers without deposits or cancelled orders", () => {
    const orders = [
      order({ total: 400, contact_id: 1 }),
      order({ total: 600, refunded_amount: 200, contact_id: 1 }),
      order({ total: 50, is_deposit: true, contact_id: 2 }),
      order({ total: 900, cancelled_at: "2026-10-03T18:00:00Z" }),
      order({ total: 700, ordered_at: "2026-09-20T18:00:00Z" }),
    ];
    expect(shopifyStats(orders, month)).toEqual({
      orders: 2,
      averageOrder: 400,
      customers: 1,
      refunded: 200,
      refundedOrders: 1,
      deposits: 1,
      depositAmount: 50,
    });
    expect(shopifyStats([], month).averageOrder).toBeNull();
  });

  it("measures checkout completion, leaving carts under an hour old out", () => {
    const checkout = (over: Partial<ShopifyCheckout>) =>
      ({
        total: 100,
        completed_at: null,
        checkout_updated_at: "2026-10-05T18:00:00Z",
        ...over,
      }) as ShopifyCheckout;
    const stats = cartStats(
      [
        checkout({ completed_at: "2026-10-05T18:10:00Z" }),
        checkout({ total: 250 }),
        checkout({ total: 300 }),
        checkout({ checkout_updated_at: "2026-10-09T15:30:00Z" }), // in progress
        checkout({ checkout_updated_at: "2026-09-05T18:00:00Z" }), // last month
      ],
      month,
      NOW,
    );
    expect(stats).toEqual({
      started: 3,
      completed: 1,
      abandoned: 2,
      abandonedValue: 550,
      completionRate: 33,
    });
  });

  it("ranks best sellers by line revenue, merging names and skipping fees and deposits", () => {
    const orders = [
      order({
        line_items: [
          {
            name: "Universal Fit - THE LAB - Odour Elimination (Ozone)",
            quantity: 1,
            price: 70,
          },
          { name: "Shipping", quantity: 1, price: 25 },
        ],
      }),
      order({
        line_items: [
          { name: "Odour Elimination (Ozone)", quantity: 2, price: 70 },
          { name: 'Polar 4" Exhaust', quantity: 1, price: 1083 },
        ],
      }),
      order({
        is_deposit: true,
        line_items: [
          { name: "$50 Secure Booking Deposit", quantity: 1, price: 50 },
        ],
      }),
    ];
    expect(topProducts(orders, month)).toEqual([
      { name: 'Polar 4" Exhaust', quantity: 1, revenue: 1083 },
      { name: "Odour Elimination (Ozone)", quantity: 3, revenue: 210 },
    ]);
    expect(topProducts(orders, month, 1)).toHaveLength(1);
    expect(cleanProductName("Universal Fit - Suntek - SxS Ceramic Tint")).toBe(
      "Suntek - SxS Ceramic Tint",
    );
    expect(cleanProductName('Universal – Hi-Lux 20" LED Light Bar')).toBe(
      'Hi-Lux 20" LED Light Bar',
    );
  });

  it("counts orders per type, an order with two types in both", () => {
    const orders = [
      order({ categories: ["Detailing"] }),
      order({ categories: ["Detailing", "Lighting"] }),
      order({ categories: ["Deposit"], is_deposit: true }),
    ];
    expect(ordersByCategory(orders, month)).toEqual([
      { category: "Detailing", orders: 2 },
      { category: "Lighting", orders: 1 },
    ]);
  });
});
