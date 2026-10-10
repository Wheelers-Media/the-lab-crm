// @vitest-environment node
import { describe, expect, it } from "vitest";

import { draftOrderNote, draftOrderPlan } from "./quoteCheckout.ts";

const lines = [
  {
    package_id: 7,
    title: '2017-2025 Duramax 6.6L - Polar - 5" Exhaust',
    price: 1899,
    quantity: 1,
    variant_id: "42388261830750",
    kind: "part" as const,
  },
  {
    package_id: null,
    title: "Exhaust install",
    price: 350,
    quantity: 1,
    kind: "labour" as const,
  },
];

describe("draftOrderPlan", () => {
  it("charges only the parts when the customer pays labour at pickup", () => {
    // Arrange / Act
    const plan = draftOrderPlan(lines, "parts");

    // Assert
    expect(plan).toEqual({
      lineItems: [
        {
          variantId: "gid://shopify/ProductVariant/42388261830750",
          quantity: 1,
          priceOverride: { amount: "1899.00", currencyCode: "CAD" },
        },
      ],
      dueNow: 1899,
      dueAtPickup: 350,
    });
  });

  it("adds labour as a non-shipping line when everything is paid now", () => {
    // Arrange / Act
    const plan = draftOrderPlan(lines, "all");

    // Assert
    expect(plan).toMatchObject({ dueNow: 2249, dueAtPickup: 0 });
    expect("lineItems" in plan && plan.lineItems[1]).toEqual({
      title: "Exhaust install",
      quantity: 1,
      originalUnitPriceWithCurrency: { amount: "350.00", currencyCode: "CAD" },
      requiresShipping: false,
      taxable: true,
    });
  });

  it("bills part hours of labour as one line for the hours", () => {
    // Arrange
    const halfHours = [
      {
        package_id: null,
        title: "Labour",
        price: 125,
        quantity: 1.5,
        kind: "labour" as const,
      },
    ];

    // Act
    const plan = draftOrderPlan(halfHours, "all");

    // Assert
    expect("lineItems" in plan && plan.lineItems[0]).toMatchObject({
      title: "Labour (1.5 h)",
      quantity: 1,
      originalUnitPriceWithCurrency: { amount: "187.50", currencyCode: "CAD" },
    });
  });

  it("explains what to do when a parts-only link has no parts", () => {
    // Arrange
    const labourOnly = [lines[1]];

    // Act
    const plan = draftOrderPlan(labourOnly, "parts");

    // Assert
    expect(plan).toEqual({
      error:
        "There are no parts on this quote. Choose to have everything paid now instead.",
    });
  });

  it("refuses an empty quote", () => {
    // Arrange / Act
    const plan = draftOrderPlan([], "all");

    // Assert
    expect(plan).toEqual({ error: "The quote has no lines yet." });
  });
});

describe("draftOrderNote", () => {
  it("tells the customer what is left to pay at pickup", () => {
    // Arrange
    const plan = draftOrderPlan(lines, "parts");

    // Act
    const note =
      "lineItems" in plan ? draftOrderNote("Exhaust - Sierra", plan) : "";

    // Assert
    expect(note).toBe(
      "Exhaust - Sierra. Parts paid now. Labour of $350.00 plus tax is paid at pickup.",
    );
  });
});
