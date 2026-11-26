import { describe, expect, it } from "vitest";

import type { ShopifyCheckout } from "../types";
import { agoLabel, cartHeat, cartTotals, recoveryText } from "./cartModel";

const NOW = new Date("2026-11-26T18:00:00Z");
const cart = (over: Partial<ShopifyCheckout> = {}): ShopifyCheckout =>
  ({
    id: 1,
    total: 100,
    phone: null,
    email: null,
    customer_name: "Dale Smith",
    line_items: [{ name: "EZ LYNK Tune", quantity: 1, price: 100 }],
    recovery_url: "https://thelabfsj.ca/cart/abc",
    checkout_updated_at: "2026-11-26T15:00:00Z",
    ...over,
  }) as ShopifyCheckout;

describe("agoLabel", () => {
  it("reads minutes, hours and days in plain words", () => {
    expect(agoLabel("2026-11-26T17:40:00Z", NOW)).toBe("20 minutes ago");
    expect(agoLabel("2026-11-26T15:00:00Z", NOW)).toBe("3 hours ago");
    expect(agoLabel("2026-11-24T18:00:00Z", NOW)).toBe("2 days ago");
  });
});

describe("cartHeat", () => {
  it("calls a cart hot under a day, warm under a week and cold after", () => {
    expect(cartHeat(cart(), NOW)).toBe("hot");
    expect(
      cartHeat(cart({ checkout_updated_at: "2026-11-22T18:00:00Z" }), NOW),
    ).toBe("warm");
    expect(
      cartHeat(cart({ checkout_updated_at: "2026-11-01T18:00:00Z" }), NOW),
    ).toBe("cold");
  });
});

describe("cartTotals", () => {
  it("adds up what is in carts and counts the hot and unreachable ones", () => {
    const totals = cartTotals(
      [
        cart({ total: 250, phone: "250" }),
        cart({ total: 50, checkout_updated_at: "2026-11-01T18:00:00Z" }),
      ],
      NOW,
    );
    expect(totals).toEqual({ count: 2, value: 300, hot: 1, unreachable: 1 });
  });
});

describe("recoveryText", () => {
  it("greets by first name, names the item and links the cart", () => {
    const text = recoveryText(cart());
    expect(text).toContain("Hey Dale, it's the team at THE LAB.");
    expect(text).toContain("EZ LYNK Tune");
    expect(text).toContain("https://thelabfsj.ca/cart/abc");
  });

  it("never links a non-https address", () => {
    expect(
      recoveryText(cart({ recovery_url: "javascript:alert(1)" })),
    ).not.toContain("javascript:");
  });
});
