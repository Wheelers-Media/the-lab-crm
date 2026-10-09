import { describe, expect, it } from "vitest";

import {
  contactDisplayName,
  customerSpend,
  formatMoney,
  orderStatusLabel,
  summarizeLines,
  todayDate,
} from "./shopFormat";

const order = (overrides: Record<string, unknown> = {}) => ({
  total: 100,
  refunded_amount: 0,
  cancelled_at: null,
  is_deposit: false,
  ordered_at: "2026-10-01T10:00:00Z",
  currency: "CAD",
  ...overrides,
});

describe("customerSpend", () => {
  it("adds up paid orders net of refunds", () => {
    // Arrange
    const orders = [
      order({ total: 260 }),
      order({ total: 1083, refunded_amount: 83 }),
    ];

    // Act
    const spend = customerSpend(orders);

    // Assert
    expect(spend).toEqual({
      orderCount: 2,
      lifetime: 1260,
      lastOrderedAt: "2026-10-01T10:00:00Z",
    });
  });

  it("leaves out deposits, which are credited to the final invoice", () => {
    const spend = customerSpend([
      order({ total: 50, is_deposit: true }),
      order({ total: 499 }),
    ]);
    expect(spend.lifetime).toBe(499);
    expect(spend.orderCount).toBe(1);
  });

  it("leaves out cancelled orders and US-dollar orders from the CAD total", () => {
    const spend = customerSpend([
      order({ total: 900, cancelled_at: "2026-10-02T00:00:00Z" }),
      order({ total: 37, currency: "USD" }),
      order({ total: 180 }),
    ]);
    expect(spend.lifetime).toBe(180);
  });

  it("reports the most recent order date, deposits included", () => {
    const spend = customerSpend([
      order({ ordered_at: "2026-09-01T00:00:00Z" }),
      order({ is_deposit: true, ordered_at: "2026-10-05T00:00:00Z" }),
    ]);
    expect(spend.lastOrderedAt).toBe("2026-10-05T00:00:00Z");
  });

  it("returns zeros for a customer with no orders", () => {
    expect(customerSpend([])).toEqual({
      orderCount: 0,
      lifetime: 0,
      lastOrderedAt: null,
    });
  });
});

describe("orderStatusLabel", () => {
  it("shows refunds and cancellations before the payment status", () => {
    const paid = { financial_status: "paid", total: 100 };
    expect(
      orderStatusLabel({ ...paid, cancelled_at: "x", refunded_amount: 0 }),
    ).toBe("Cancelled");
    expect(
      orderStatusLabel({ ...paid, cancelled_at: null, refunded_amount: 100 }),
    ).toBe("Refunded");
    expect(
      orderStatusLabel({ ...paid, cancelled_at: null, refunded_amount: 20 }),
    ).toBe("Part refunded");
    expect(
      orderStatusLabel({ ...paid, cancelled_at: null, refunded_amount: 0 }),
    ).toBe("Paid");
  });
});

describe("summarizeLines", () => {
  it("drops the store's Universal Fit prefix and counts the rest", () => {
    expect(
      summarizeLines([
        {
          name: "Universal Fit - Suntek - Ceramic Tint - Front Roll Ups",
          quantity: 1,
        },
        { name: "Universal Fit - THE LAB - Engine Bay Detail", quantity: 2 },
        { name: "Shop Supplies", quantity: 1 },
      ]),
    ).toBe("Ceramic Tint - Front Roll Ups, 2× Engine Bay Detail, +1 more");
  });
});

describe("formatMoney", () => {
  it("formats Canadian dollars with cents", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });
});

describe("todayDate", () => {
  it("uses the local calendar date so upcoming starts at midnight", () => {
    expect(todayDate(new Date(2026, 9, 9, 23, 30))).toBe("2026-10-09");
  });
});

describe("contactDisplayName", () => {
  it("falls back to email, then phone, when a contact has no name", () => {
    const base = {
      first_name: "",
      last_name: "",
      email_jsonb: [],
      phone_jsonb: [],
    };
    expect(
      contactDisplayName({
        ...base,
        email_jsonb: [{ email: "pat@example.com", type: "Work" }],
      } as never),
    ).toBe("pat@example.com");
    expect(
      contactDisplayName({
        ...base,
        phone_jsonb: [{ number: "250-261-9502", type: "Work" }],
      } as never),
    ).toBe("250-261-9502");
  });
});
