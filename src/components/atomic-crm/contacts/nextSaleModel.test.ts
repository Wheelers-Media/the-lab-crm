import { describe, expect, it } from "vitest";

import type { Appointment, Deal, Order } from "../types";
import { customerSnapshot, nextSales } from "./nextSaleModel";

const NOW = new Date("2026-10-27T18:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

let nextId = 1;
const order = (
  daysBack: number,
  name: string,
  total: number,
  extra: Partial<Order> = {},
): Order => ({
  id: nextId++,
  shopify_order_id: null,
  order_number: `#${nextId}`,
  contact_id: 7,
  deal_id: null,
  source: "web",
  financial_status: "paid",
  fulfillment_status: null,
  currency: "CAD",
  subtotal: total,
  total,
  refunded_amount: 0,
  line_items: [{ name, quantity: 1, price: total }],
  categories: [],
  is_deposit: false,
  ordered_at: daysAgo(daysBack),
  cancelled_at: null,
  created_at: daysAgo(daysBack),
  ...extra,
});

const appointment = (
  daysAhead: number,
  status: Appointment["status"] = "booked",
): Appointment => ({
  id: nextId++,
  external_id: null,
  source: "manual",
  contact_id: 7,
  deal_id: null,
  task_id: null,
  title: "Signature detail",
  resource: "detailing-bay",
  start_at: new Date(NOW.getTime() + daysAhead * 86_400_000).toISOString(),
  end_at: new Date(
    NOW.getTime() + daysAhead * 86_400_000 + 3_600_000,
  ).toISOString(),
  status,
  deposit_paid: true,
  vehicle: null,
  notes: null,
  created_at: daysAgo(30),
  updated_at: daysAgo(30),
});

const deal = (extra: Partial<Deal>): Deal =>
  ({
    id: nextId++,
    name: "Ceramic tint, crew cab",
    company_id: 0,
    contact_ids: [7],
    category: "window-tint",
    stage: "quoted",
    description: "",
    amount: 640,
    created_at: daysAgo(20),
    updated_at: daysAgo(10),
    stage_changed_at: daysAgo(10),
    expected_closing_date: daysAgo(-10),
    sales_id: 1,
    index: 0,
    ...extra,
  }) as Deal;

const ids = (input: Parameters<typeof nextSales>[0]) =>
  nextSales({ now: NOW, ...input }).map((s) => s.id);

describe("nextSales", () => {
  it("offers the monthly membership after two details in three months", () => {
    // Arrange
    const orders = [
      order(20, "Standard Signature (Small SUV/Truck)", 329),
      order(75, "De-luxx Signature (Small SUV, Truck)", 499),
    ];

    // Act
    const [first] = nextSales({
      orders,
      appointments: [],
      deals: [],
      membershipPrice: 249,
      now: NOW,
    });

    // Assert
    expect(first.id).toBe("membership");
    expect(first.reason).toContain("2 details in the last 3 months");
    expect(first.reason).toContain("$828");
    expect(first.reason).toContain("$249 a month");
  });

  it("does not offer the membership to someone who already has one", () => {
    const orders = [
      order(20, "Standard Signature (Small SUV/Truck)", 329),
      order(40, "Standard Signature (Small SUV/Truck)", 329),
    ];
    expect(
      ids({
        orders,
        appointments: [],
        deals: [],
        membership: "monthly-signature",
      }),
    ).not.toContain("membership");
  });

  it("counts a membership paid in the last month as current", () => {
    const orders = [
      order(10, "The Monthly Signature Membership", 249),
      order(20, "Standard Signature (Small SUV/Truck)", 329),
      order(40, "Standard Signature (Small SUV/Truck)", 329),
    ];
    const result = ids({ orders, appointments: [], deals: [] });
    expect(result).not.toContain("membership");
    expect(result).not.toContain("membership-lapsed");
  });

  it("asks to win back a membership that has lapsed", () => {
    const orders = [order(120, "The Monthly Signature Membership", 249)];
    expect(ids({ orders, appointments: [], deals: [] })).toContain(
      "membership-lapsed",
    );
  });

  it("says a detail is due two months after the last one", () => {
    const orders = [order(70, "Standard Interior Detail 5 & 6 Seater", 249)];
    expect(ids({ orders, appointments: [], deals: [] })).toContain(
      "detail-due",
    );
  });

  it("leaves out reminders when the customer is already booked in", () => {
    const orders = [order(200, "Standard Interior Detail 5 & 6 Seater", 249)];
    const result = ids({
      orders,
      appointments: [appointment(3)],
      deals: [],
    });
    expect(result).not.toContain("detail-due");
    expect(result).not.toContain("win-back");
  });

  it("puts a quote waiting three days first, with the job to open", () => {
    const waiting = deal({ stage: "quoted" });
    const [first] = nextSales({
      orders: [
        order(20, "Standard Signature (Small SUV/Truck)", 329),
        order(40, "Standard Signature (Small SUV/Truck)", 329),
      ],
      appointments: [],
      deals: [waiting],
      now: NOW,
    });
    expect(first.id).toBe("quote-follow-up");
    expect(first.dealId).toBe(waiting.id);
    expect(first.reason).toContain("$640");
  });

  it("suggests tint to a detail customer who has never had it", () => {
    const orders = [order(10, "Headlight Restoration", 150)];
    expect(ids({ orders, appointments: [], deals: [] })).toContain("tint");
  });

  it("suggests a tune to a parts buyer and a detail to an upgrade buyer", () => {
    const orders = [
      order(30, '2017-2025 Duramax 6.6L - Polar - 4" Exhaust', 1083, {
        categories: ["Diesel parts"],
      }),
    ];
    const result = ids({ orders, appointments: [], deals: [] });
    expect(result).toContain("tune");
    expect(result).toContain("detail");
  });

  it("ignores cancelled orders and booking deposits", () => {
    const orders = [
      order(20, "Standard Signature (Small SUV/Truck)", 329, {
        cancelled_at: daysAgo(19),
      }),
      order(25, "$50 Secure Booking Deposit", 50, { is_deposit: true }),
    ];
    expect(ids({ orders, appointments: [], deals: [] })).toEqual(["first-job"]);
  });

  it("returns at most three suggestions", () => {
    const orders = [
      order(200, "Standard Signature (Small SUV/Truck)", 329),
      order(250, '2017-2025 Duramax 6.6L - Polar - 4" Exhaust', 1083),
    ];
    expect(
      nextSales({ orders, appointments: [], deals: [deal({})], now: NOW }),
    ).toHaveLength(3);
  });
});

describe("customerSnapshot", () => {
  it("adds up spend, visits and the next booking", () => {
    const orders = [
      order(10, "Standard Signature", 329, { refunded_amount: 29 }),
      order(40, "Ceramic Tint", 260),
      order(5, "Deposit", 50, { is_deposit: true }),
    ];
    const appointments = [
      appointment(-10, "completed"),
      appointment(-40, "no_show"),
      appointment(4),
      appointment(12),
    ];

    const snap = customerSnapshot(orders, appointments, NOW);

    expect(snap.lifetimeSpend).toBe(560);
    expect(snap.orders).toBe(2);
    expect(snap.visits).toBe(1);
    expect(snap.noShows).toBe(1);
    expect(snap.nextVisit?.start_at).toBe(appointments[2].start_at);
    // The latest of the visit and the orders
    expect(snap.lastVisit).toBe(orders[0].ordered_at);
  });
});
