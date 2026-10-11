import { describe, expect, it } from "vitest";

import {
  marginOf,
  salesStats,
  splitTags,
  stockInfo,
  websiteUrl,
} from "./productModel";

describe("stockInfo", () => {
  it("says nothing when Shopify does not track stock", () => {
    expect(stockInfo(null)).toBeNull();
  });

  it("separates out of stock, nearly gone and plenty", () => {
    expect(stockInfo(0)).toEqual({ label: "Out of stock", tone: "out" });
    expect(stockInfo(2)).toEqual({ label: "2 in stock", tone: "low" });
    expect(stockInfo(9)).toEqual({ label: "9 in stock", tone: "ok" });
  });

  it("calls negative stock made to order, not out of stock", () => {
    expect(stockInfo(-1)).toEqual({
      label: "Made to order",
      tone: "made-to-order",
    });
  });
});

describe("marginOf", () => {
  it("gives profit and percent of the price", () => {
    expect(marginOf({ price: 165.99, cost: 97.95 })).toEqual({
      profit: 68.04,
      percent: 41,
    });
  });

  it("is unknown without a cost", () => {
    expect(marginOf({ price: 100 })).toBeNull();
    expect(marginOf({ price: 100, cost: 0 })).toBeNull();
  });
});

describe("splitTags", () => {
  it("pulls the shipping rule out of the other tags", () => {
    expect(splitTags(["duramax", "Shipping: Exhaust", "full exhaust"])).toEqual(
      {
        shipping: "Exhaust",
        others: ["duramax", "full exhaust"],
      },
    );
    expect(splitTags(undefined)).toEqual({ shipping: null, others: [] });
  });
});

describe("websiteUrl", () => {
  it("links active parts to the website's product page by Shopify id", () => {
    expect(
      websiteUrl({
        kind: "product",
        status: "active",
        shopify_product_id: "123",
      }),
    ).toBe(
      "https://thelabfsj.ca/store/product/?id=gid%3A%2F%2Fshopify%2FProduct%2F123",
    );
  });

  it("has no link for shop services or products that are not for sale", () => {
    expect(
      websiteUrl({
        kind: "package",
        status: "active",
        shopify_product_id: "1",
      }),
    ).toBeNull();
    expect(
      websiteUrl({
        kind: "product",
        status: "archived",
        shopify_product_id: "1",
      }),
    ).toBeNull();
  });
});

describe("salesStats", () => {
  const NOW = new Date("2026-10-09T16:00:00Z");
  const line = (
    daysAgo: number,
    quantity: number,
    contact_id: number | null,
    price = 100,
  ) => ({
    ordered_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    quantity,
    price,
    contact_id,
  });

  it("totals units and revenue over 30, 90 and 365 days and ever", () => {
    const stats = salesStats(
      [line(5, 2, 1), line(60, 1, 2), line(200, 3, 1), line(500, 4, 3)],
      NOW,
    );

    expect(stats.units).toEqual({ d30: 2, d90: 3, d365: 6, all: 10 });
    expect(stats.revenue).toEqual({ d30: 200, d90: 300, d365: 600, all: 1000 });
    expect(stats.customers).toBe(3);
    expect(stats.lastSoldAt).toBe(line(5, 2, 1).ordered_at);
  });

  it("gives twelve months of units, oldest first, with none skipped", () => {
    const stats = salesStats([line(5, 2, 1), line(25, 1, 1)], NOW);

    expect(stats.monthly).toHaveLength(12);
    expect(stats.monthly[11]).toEqual({ key: "2026-10", units: 2 });
    expect(stats.monthly[10]).toEqual({ key: "2026-09", units: 1 });
    expect(stats.monthly[0].key).toBe("2025-11");
  });

  it("is empty for a product that never sold", () => {
    const stats = salesStats([], NOW);

    expect(stats.units.all).toBe(0);
    expect(stats.lastSoldAt).toBeNull();
  });
});
