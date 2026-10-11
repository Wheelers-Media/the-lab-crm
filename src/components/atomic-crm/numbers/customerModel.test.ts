import { describe, expect, it } from "vitest";

import { numbersRanges } from "./periods";
import {
  customerLedger,
  customerStats,
  type LedgerOrder,
  quietCustomers,
  topSpenders,
} from "./customerModel";

const NOW = new Date("2026-10-09T16:00:00Z");
const { current } = numbersRanges("month", NOW);

const order = (
  contact_id: number | null,
  ordered_at: string,
  total = 100,
  over: Partial<LedgerOrder> = {},
): LedgerOrder => ({
  contact_id,
  ordered_at,
  total,
  refunded_amount: 0,
  is_deposit: false,
  cancelled_at: null,
  ...over,
});

describe("customerLedger", () => {
  it("adds up each customer's orders and spend, less refunds, and skips deposits and cancelled orders", () => {
    const ledger = customerLedger([
      order(1, "2026-01-10T18:00:00Z", 300, { refunded_amount: 50 }),
      order(1, "2026-06-10T18:00:00Z", 200),
      order(1, "2026-07-01T18:00:00Z", 50, { is_deposit: true }),
      order(1, "2026-08-01T18:00:00Z", 900, {
        cancelled_at: "2026-08-02T00:00:00Z",
      }),
      order(null, "2026-06-10T18:00:00Z", 75),
    ]);

    expect([...ledger.keys()]).toEqual([1]);
    expect(ledger.get(1)).toEqual({
      contactId: 1,
      firstOrderAt: "2026-01-10T18:00:00Z",
      lastOrderAt: "2026-06-10T18:00:00Z",
      orders: 2,
      spend: 450,
    });
  });
});

describe("customerStats", () => {
  const orders = [
    order(1, "2025-03-01T18:00:00Z", 500), // returning: first order long ago
    order(1, "2026-10-03T18:00:00Z", 400),
    order(2, "2026-10-04T18:00:00Z", 100), // new this month
    order(3, "2026-10-05T18:00:00Z", 250), // new this month
    order(3, "2026-10-06T18:00:00Z", 50),
    order(null, "2026-10-06T18:00:00Z", 60), // in-shop sale, no customer
    order(4, "2026-09-02T18:00:00Z", 999), // last month: not active now
  ];

  it("splits active customers into new and returning by their first order ever", () => {
    const s = customerStats(orders, current);

    expect(s).toMatchObject({
      active: 3,
      newCustomers: 2,
      returning: 1,
      repeatRate: 33,
    });
    expect(s.returningCollected).toBe(400);
    expect(s.newCollected).toBe(400);
  });

  it("reports how many orders had no customer attached", () => {
    expect(customerStats(orders, current).unidentifiedShare).toBe(20); // 1 of the 5 orders this month
  });

  it("averages lifetime spend and orders over every customer on file", () => {
    const s = customerStats(orders, current);

    // 4 customers: 900, 100, 300, 999 spend; 2, 1, 2, 1 orders
    expect(s.averageLifetimeSpend).toBe(574.75);
    expect(s.averageOrdersPerCustomer).toBe(1.5);
  });

  it("has no rates when nobody ordered", () => {
    expect(customerStats([], current)).toMatchObject({
      active: 0,
      repeatRate: null,
      averageLifetimeSpend: null,
    });
  });
});

describe("topSpenders and quietCustomers", () => {
  const ledger = customerLedger([
    order(1, "2026-10-01T18:00:00Z", 5000),
    order(2, "2025-01-10T18:00:00Z", 1500), // lapsed repeat customer
    order(2, "2025-02-10T18:00:00Z", 1500),
    order(3, "2026-02-10T18:00:00Z", 800), // slipping repeat customer
    order(3, "2026-03-10T18:00:00Z", 900),
    order(4, "2025-01-10T18:00:00Z", 9000), // one order only: never "quiet"
  ]);

  it("ranks customers by lifetime spend", () => {
    expect(topSpenders(ledger, 2).map((r) => r.contactId)).toEqual([4, 1]);
  });

  it("finds repeat customers who have gone quiet for 6 and 12 months, biggest first", () => {
    const quiet = quietCustomers(ledger, NOW);

    expect(quiet.slipping.map((r) => r.contactId)).toEqual([3]);
    expect(quiet.lapsed.map((r) => r.contactId)).toEqual([2]);
  });
});
