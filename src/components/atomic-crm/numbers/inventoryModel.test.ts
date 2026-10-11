import { describe, expect, it } from "vitest";

import type { Order, Package } from "../types";
import { inventoryHealth, slowWindow } from "./inventoryModel";

const NOW = new Date("2026-10-09T16:00:00Z");
const window = slowWindow(NOW);

const product = (
  id: number,
  title: string,
  inventory: number | null,
  price = 100,
): Package =>
  ({
    id,
    title,
    shopify_title: title,
    vendor: "Brand",
    kind: "product",
    status: "active",
    inventory,
    variants: [{ id: String(id), title: "Default Title", price, inventory }],
  }) as unknown as Package;

const sale = (
  name: string,
  quantity: number,
  ordered_at = "2026-09-20T18:00:00Z",
): Order =>
  ({
    id: Math.random(),
    ordered_at,
    cancelled_at: null,
    is_deposit: false,
    subtotal: quantity * 100,
    total: quantity * 100,
    line_items: [{ name, quantity, price: 100 }],
  }) as unknown as Order;

describe("inventoryHealth", () => {
  const catalog = [
    product(1, "Fast Seller Out", 0),
    product(2, "Fast Seller Low", 1, 50),
    product(3, "Fine Seller", 20),
    product(4, "Dusty Part", 5, 200),
    product(5, "Drop Shipped Exhaust", -1, 1000),
    product(6, "Not Tracked", null),
    { ...product(7, "Draft Thing", 9), status: "draft" } as Package,
    { ...product(8, "A Service", 3), kind: "package" } as Package,
  ];
  const orders = [
    sale("Fast Seller Out", 4),
    sale("Fast Seller Low", 3),
    sale("Fine Seller - Black", 1),
    sale("Drop Shipped Exhaust", 2),
    sale("Dusty Part", 1, "2026-05-01T18:00:00Z"), // outside the 90 days
  ];

  it("counts tracked, in-stock, out-of-stock and made-to-order products, leaving out services and drafts", () => {
    const h = inventoryHealth(catalog, orders, window);

    expect(h).toMatchObject({
      products: 6,
      tracked: 5,
      inStock: 3,
      outOfStock: 1,
      madeToOrder: 1,
    });
  });

  it("values the stock on the shelf at retail and ignores negative stock", () => {
    const h = inventoryHealth(catalog, orders, window);

    // 1x$50 + 20x$100 + 5x$200
    expect(h.stockValue).toBe(50 + 2000 + 1000);
  });

  it("lists best sellers that are out, and ones nearly gone, most sold first", () => {
    const h = inventoryHealth(catalog, orders, window);

    expect(h.outOfStockSellers.map((l) => [l.title, l.soldRecently])).toEqual([
      ["Fast Seller Out", 4],
    ]);
    expect(h.lowStockSellers.map((l) => l.title)).toEqual(["Fast Seller Low"]);
  });

  it("finds stock that has not sold in 90 days, biggest value first", () => {
    const h = inventoryHealth(catalog, orders, window);

    expect(h.slowMovers.map((l) => l.title)).toEqual(["Dusty Part"]);
    expect(h.slowValue).toBe(1000);
  });
});
