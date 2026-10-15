import { describe, expect, it } from "vitest";

import type { Order } from "../types";
import {
  basketBands,
  inSegment,
  metricTrend,
  newVsReturning,
  ordersInBucket,
  ordersInSlot,
  parseSegment,
  paymentStatus,
  salesPace,
  segmentParam,
  slotOf,
  weekdayHourGrid,
} from "./insightsModel";
import { numbersRanges } from "./periods";

// Friday Oct 9 2026, 9:00 in Fort St. John (UTC-7, no clock change)
const NOW = new Date("2026-10-09T16:00:00Z");
const ranges = numbersRanges("month", NOW);

let nextId = 1;
const order = (over: Partial<Order>): Order =>
  ({
    id: nextId++,
    order_number: `#${nextId}`,
    contact_id: 1,
    source: "web",
    financial_status: "paid",
    currency: "CAD",
    subtotal: 100,
    total: 105,
    refunded_amount: 0,
    line_items: [],
    categories: [],
    is_deposit: false,
    cancelled_at: null,
    // Monday Oct 5, 11:00 shop time
    ordered_at: "2026-10-05T18:00:00Z",
    created_at: "2026-10-05T18:00:00Z",
    ...over,
  }) as Order;

describe("metricTrend", () => {
  const orders = [
    order({ subtotal: 300, ordered_at: "2026-10-02T18:00:00Z" }),
    order({ subtotal: 100, ordered_at: "2026-10-02T20:00:00Z" }),
    order({ subtotal: 700, ordered_at: "2026-09-01T18:00:00Z" }),
  ];

  it("charts net sales with the previous month's same day beside it", () => {
    const trend = metricTrend(orders, ranges, "netSales");

    expect(trend).toHaveLength(9);
    expect(trend[0]).toMatchObject({
      key: "2026-10-01",
      value: 0,
      previous: 700,
    });
    expect(trend[1]).toMatchObject({
      key: "2026-10-02",
      value: 400,
      orders: 2,
    });
  });

  it("switches to orders and to average order", () => {
    expect(metricTrend(orders, ranges, "orders")[1].value).toBe(2);
    expect(metricTrend(orders, ranges, "average")[1].value).toBe(200);
    expect(metricTrend(orders, ranges, "average")[0].value).toBe(0);
  });

  it("lists the orders behind one bar, newest first", () => {
    const list = ordersInBucket(orders, ranges, "2026-10-02");

    expect(list.map((o) => o.subtotal)).toEqual([100, 300]);
  });
});

describe("segments", () => {
  const tint = order({
    line_items: [
      {
        name: "Suntek - Ceramic Tint - Front Roll Ups",
        quantity: 1,
        price: 400,
      },
    ],
  });
  const pos = order({ source: "pos" });

  it("round-trips through the URL and rejects unknown kinds", () => {
    const segment = parseSegment("category:Tint");

    expect(segment).toEqual({ kind: "category", value: "Tint" });
    expect(segmentParam(segment!)).toBe("category:Tint");
    expect(parseSegment("colour:Blue")).toBeNull();
    expect(parseSegment("category:")).toBeNull();
    expect(parseSegment(null)).toBeNull();
  });

  it("matches an order by a line's category or by its channel", () => {
    expect(inSegment(tint, { kind: "category", value: "Tint" })).toBe(true);
    expect(inSegment(tint, { kind: "category", value: "Detailing" })).toBe(
      false,
    );
    expect(inSegment(pos, { kind: "channel", value: "In shop (POS)" })).toBe(
      true,
    );
    expect(inSegment(tint, null)).toBe(true);
  });
});

describe("weekdayHourGrid", () => {
  it("reads the shop's clock, not UTC", () => {
    // 18:00 UTC is 11:00 in Fort St. John, on a Monday
    expect(slotOf("2026-10-05T18:00:00Z")).toEqual({ weekday: 0, hour: 11 });
    // 03:00 UTC Tuesday is still Monday evening there (20:00)
    expect(slotOf("2026-10-06T03:00:00Z")).toEqual({ weekday: 0, hour: 20 });
  });

  it("counts orders per weekday and two-hour column and finds the busiest", () => {
    const orders = [
      order({ ordered_at: "2026-10-05T18:00:00Z" }),
      order({ ordered_at: "2026-10-05T18:30:00Z" }),
      order({ ordered_at: "2026-10-02T20:00:00Z", subtotal: 50 }),
    ];

    const grid = weekdayHourGrid(orders, ranges.current);

    expect(grid.max).toBe(2);
    expect(grid.busiest).toMatchObject({ weekday: 0, band: 5, orders: 2 });
    expect(ordersInSlot(orders, ranges.current, 0, 5)).toHaveLength(2);
    expect(ordersInSlot(orders, ranges.current, 4, 6)).toHaveLength(1);
  });
});

describe("basketBands", () => {
  it("groups orders by net value and gives each band's share", () => {
    const orders = [
      order({ subtotal: 40 }),
      order({ subtotal: 120 }),
      order({ subtotal: 130 }),
      order({ subtotal: 1500 }),
    ];

    const bands = basketBands(orders, ranges.current);

    expect(bands.map((b) => b.orders)).toEqual([1, 2, 0, 0, 1]);
    expect(bands[1]).toMatchObject({ netSales: 250, share: 50 });
  });
});

describe("paymentStatus", () => {
  it("puts money still owed first and leaves booking deposits out", () => {
    const orders = [
      order({ financial_status: "paid" }),
      order({ financial_status: "pending", total: 800 }),
      order({ financial_status: "pending", total: 200 }),
      order({ is_deposit: true, financial_status: "pending" }),
      order({ cancelled_at: "2026-10-06T00:00:00Z" }),
    ];

    const rows = paymentStatus(orders, ranges.current);

    expect(rows.map((r) => r.name)).toEqual([
      "Awaiting payment",
      "Paid",
      "Cancelled",
    ]);
    expect(rows[0]).toMatchObject({ orders: 2, amount: 1000, open: true });
  });
});

describe("newVsReturning", () => {
  it("counts a customer as new only in the bucket of their first order ever", () => {
    const orders = [
      // Customer 1: first order in September, orders again Oct 2
      order({ contact_id: 1, ordered_at: "2026-09-01T18:00:00Z" }),
      order({ contact_id: 1, ordered_at: "2026-10-02T18:00:00Z" }),
      // Customer 2: first order Oct 2
      order({ contact_id: 2, ordered_at: "2026-10-02T19:00:00Z" }),
      // In-shop sale with no customer: not counted
      order({ contact_id: null, ordered_at: "2026-10-02T19:30:00Z" }),
    ];

    const mix = newVsReturning(orders, ranges);
    const oct2 = mix.find((p) => p.key === "2026-10-02")!;

    expect(oct2).toMatchObject({ newCustomers: 1, returning: 1 });
  });
});

describe("salesPace", () => {
  it("projects the month at today's daily average", () => {
    const orders = [
      // Oct 1-9 (9 days elapsed): 900 net in total
      order({ subtotal: 400, ordered_at: "2026-10-01T18:00:00Z" }),
      order({ subtotal: 500, ordered_at: "2026-10-08T18:00:00Z" }),
      // September, to compare with
      order({ subtotal: 1000, ordered_at: "2026-09-05T18:00:00Z" }),
      order({ subtotal: 2000, ordered_at: "2026-09-25T18:00:00Z" }),
    ];

    const pace = salesPace(orders, "month", NOW)!;

    expect(pace.daysTotal).toBe(31);
    expect(pace.daysElapsed).toBe(9);
    expect(pace.soFar).toBe(900);
    expect(pace.projected).toBeCloseTo((900 / 9) * 31);
    expect(pace.previousToDate).toBe(1000);
    expect(pace.previousTotal).toBe(3000);
    expect(pace.points[8].current).toBe(900);
    expect(pace.points[9].current).toBeNull();
  });

  it("has no pace for rolling periods", () => {
    expect(salesPace([], "30d", NOW)).toBeNull();
    expect(salesPace([], "last-month", NOW)).toBeNull();
  });
});
