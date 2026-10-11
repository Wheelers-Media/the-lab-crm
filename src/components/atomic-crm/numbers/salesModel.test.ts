import { describe, expect, it } from "vitest";

import type { Order, Package } from "../types";
import { numbersRanges } from "./periods";
import {
  FEES,
  lineCategory,
  salesByBrand,
  salesByCategory,
  salesByChannel,
  salesByProduct,
  salesSummary,
  salesTrend,
  withPrevious,
} from "./salesModel";

// Friday Oct 9 2026, 9:00 in Fort St. John
const NOW = new Date("2026-10-09T16:00:00Z");
const { current, previous } = numbersRanges("month", NOW);

let nextId = 1;
const order = (over: Partial<Order>): Order =>
  ({
    id: nextId++,
    order_number: `#${nextId}`,
    contact_id: 1,
    source: "web",
    currency: "CAD",
    subtotal: 100,
    total: 105,
    refunded_amount: 0,
    line_items: [],
    categories: [],
    is_deposit: false,
    cancelled_at: null,
    ordered_at: "2026-10-05T18:00:00Z",
    created_at: "2026-10-05T18:00:00Z",
    ...over,
  }) as Order;

describe("salesSummary", () => {
  it("separates net sales, tax and shipping, refunds and money collected", () => {
    const orders = [
      order({ subtotal: 1000, total: 1100, refunded_amount: 110 }),
      order({ subtotal: 200, total: 210 }),
    ];

    const s = salesSummary(orders, current);

    expect(s.orders).toBe(2);
    expect(s.netSales).toBe(1200);
    expect(s.taxAndShipping).toBe(110);
    expect(s.refunds).toBe(110);
    expect(s.refundedOrders).toBe(1);
    expect(s.refundRate).toBe(50);
    expect(s.collected).toBe(1200);
    expect(s.averageOrder).toBe(600);
    expect(s.largestOrder).toBe(1000);
  });

  it("leaves booking deposits and cancelled orders out of sales and counts deposits on their own", () => {
    const orders = [
      order({ subtotal: 500, total: 525 }),
      order({ subtotal: 50, total: 50, is_deposit: true }),
      order({
        subtotal: 900,
        total: 945,
        cancelled_at: "2026-10-06T00:00:00Z",
      }),
    ];

    const s = salesSummary(orders, current);

    expect(s.orders).toBe(1);
    expect(s.netSales).toBe(500);
    expect(s.deposits).toBe(1);
    expect(s.depositAmount).toBe(50);
  });

  it("falls back to the total for imported orders with no subtotal", () => {
    const s = salesSummary([order({ subtotal: null, total: 300 })], current);

    expect(s.netSales).toBe(300);
  });

  it("counts units of products but not shop supplies", () => {
    const orders = [
      order({
        line_items: [
          {
            name: "Universal Fit - THE LAB - Ceramic Tint",
            quantity: 2,
            price: 100,
          },
          { name: "Shop Supplies", quantity: 1, price: 20 },
        ],
      }),
    ];

    const s = salesSummary(orders, current);

    expect(s.units).toBe(2);
    expect(s.unitsPerOrder).toBe(2);
  });

  it("has no averages when there are no orders", () => {
    const s = salesSummary([], current);

    expect(s).toMatchObject({
      orders: 0,
      averageOrder: null,
      refundRate: null,
    });
  });
});

describe("salesTrend", () => {
  it("gives every day, zero when nothing sold, with the previous month's same day alongside", () => {
    const orders = [
      order({ subtotal: 300, ordered_at: "2026-10-02T18:00:00Z" }),
      order({ subtotal: 100, ordered_at: "2026-10-02T20:00:00Z" }),
      order({ subtotal: 700, ordered_at: "2026-09-01T18:00:00Z" }),
    ];

    const trend = salesTrend(orders, numbersRanges("month", NOW));

    expect(trend[0]).toMatchObject({
      key: "2026-10-01",
      netSales: 0,
      previousNetSales: 700,
    });
    expect(trend[1]).toMatchObject({
      key: "2026-10-02",
      netSales: 400,
      orders: 2,
    });
    expect(trend).toHaveLength(9);
  });
});

describe("salesByCategory", () => {
  it("spreads an order's discount over its lines so categories add up to net sales", () => {
    // Lines are worth 400 and 600 at list price; the order was discounted to 800
    const orders = [
      order({
        subtotal: 800,
        line_items: [
          {
            name: "Suntek - Ceramic Tint - Front Roll Ups",
            quantity: 1,
            price: 400,
          },
          { name: "Interior Detail Signature", quantity: 1, price: 600 },
        ],
      }),
    ];

    const rows = salesByCategory(orders, current);

    expect(Object.fromEntries(rows.map((r) => [r.name, r.netSales]))).toEqual({
      Detailing: 480,
      Tint: 320,
    });
    expect(rows.reduce((s, r) => s + r.netSales, 0)).toBe(800);
  });

  it("files fees apart from products and counts an order once per category", () => {
    const orders = [
      order({
        subtotal: 150,
        line_items: [
          { name: "Interior Detail Signature", quantity: 1, price: 100 },
          { name: "Exterior Detail Signature", quantity: 1, price: 30 },
          { name: "Mechanical Shop Supplies", quantity: 1, price: 20 },
        ],
      }),
    ];

    const rows = salesByCategory(orders, current);
    const detailing = rows.find((r) => r.name === "Detailing")!;

    expect(detailing.orders).toBe(1);
    expect(detailing.units).toBe(2);
    expect(rows.find((r) => r.name === FEES)?.units).toBe(0);
    expect(lineCategory("Mechanical Shop Supplies")).toBe(FEES);
  });
});

describe("salesByProduct and salesByBrand", () => {
  const catalog = [
    {
      title: 'Polar - 4" Exhaust With Muffler',
      shopify_title: '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
      vendor: "Polar Diesel",
      variants: [{ id: "1", title: "Default Title", price: 1083, sku: "PD-1" }],
    },
    {
      title: "Bulbs",
      shopify_title: "LED Bulbs H11",
      vendor: "Speed Demon",
      variants: [{ id: "2", title: "Default Title", price: 166 }],
    },
  ] as unknown as Package[];

  it("names the brand from the catalog by SKU, then by product name with its option", () => {
    const orders = [
      order({
        subtotal: 1249,
        line_items: [
          {
            name: '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
            quantity: 1,
            price: 1083,
            sku: "PD-1",
          },
          { name: "LED Bulbs H11 - Pair", quantity: 1, price: 166 },
        ],
      }),
    ];

    const products = salesByProduct(orders, current, catalog);
    const brands = salesByBrand(products);

    expect(products.map((p) => [p.name, p.brand])).toEqual([
      [
        '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
        "Polar Diesel",
      ],
      ["LED Bulbs H11 - Pair", "Speed Demon"],
    ]);
    expect(brands.map((b) => [b.name, Math.round(b.netSales)])).toEqual([
      ["Polar Diesel", 1083],
      ["Speed Demon", 166],
    ]);
  });

  it("groups products it cannot place under 'Brand not set'", () => {
    const orders = [
      order({
        subtotal: 90,
        line_items: [{ name: "Mystery Part", quantity: 3, price: 30 }],
      }),
    ];

    const brands = salesByBrand(salesByProduct(orders, current, catalog));

    expect(brands).toEqual([
      { name: "Brand not set", netSales: 90, orders: 1, units: 3 },
    ]);
  });
});

describe("salesByChannel and withPrevious", () => {
  it("names the channels and compares each with the previous period", () => {
    const orders = [
      order({ source: "web", subtotal: 400 }),
      order({ source: "pos", subtotal: 100 }),
      order({ source: "shopify_draft_order", subtotal: 1000 }),
      order({
        source: "web",
        subtotal: 200,
        ordered_at: "2026-09-02T18:00:00Z",
      }),
    ];

    const rows = withPrevious(
      salesByChannel(orders, current),
      salesByChannel(orders, previous),
    );

    expect(rows.map((r) => r.name)).toEqual([
      "Draft orders and pay links",
      "Online store",
      "In shop (POS)",
    ]);
    const web = rows.find((r) => r.name === "Online store")!;
    expect(web.previousNetSales).toBe(200);
    expect(web.change).toBe(100);
    expect(rows.find((r) => r.name === "In shop (POS)")!.change).toBeNull();
  });
});
