import { describe, expect, it } from "vitest";

import type { Appointment, Deal, Order } from "../types";
import { reviewAskFor } from "./reviewModel";

const NOW = new Date("2026-11-02T18:00:00Z");
const DAY_MS = 86_400_000;
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * DAY_MS).toISOString();

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 1,
    shopify_order_id: null,
    order_number: "#1201",
    contact_id: 7,
    deal_id: null,
    source: "pos",
    financial_status: "paid",
    fulfillment_status: null,
    currency: "CAD",
    subtotal: 499,
    total: 499,
    refunded_amount: 0,
    line_items: [
      { name: "De-luxx Signature (Small SUV, Truck)", quantity: 1, price: 499 },
    ],
    categories: ["Detailing"],
    is_deposit: false,
    ordered_at: daysAgo(3),
    cancelled_at: null,
    created_at: daysAgo(3),
    ...over,
  }) as Order;

const deal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Ceramic tint, crew cab truck",
    contact_ids: [7],
    stage: "booked",
    work_status: "picked_up",
    work_status_changed_at: daysAgo(2),
    updated_at: daysAgo(2),
    ...over,
  }) as Deal;

const appointment = (over: Partial<Appointment> = {}): Appointment =>
  ({
    id: 1,
    contact_id: 7,
    deal_id: null,
    title: "Complete De-Luxx Signature",
    status: "completed",
    start_at: daysAgo(5),
    end_at: daysAgo(5),
    deposit_paid: true,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    ...over,
  }) as Appointment;

describe("reviewAskFor", () => {
  it("asks about the most recent finished work", () => {
    const plan = reviewAskFor({
      firstName: "Sam",
      orders: [order({ ordered_at: daysAgo(9) })],
      deals: [deal({ name: "Ceramic tint, crew cab truck" })],
      now: NOW,
    });

    expect(plan?.what).toBe("Ceramic tint, crew cab truck");
    expect(plan?.at).toBe(daysAgo(2));
    expect(plan?.text).toContain("Hi Sam,");
  });

  it("generalizes the package the customer bought", () => {
    const plan = reviewAskFor({
      firstName: "Sam",
      vehicle: "2022 Ram 3500",
      orders: [order()],
      now: NOW,
    });

    expect(plan?.subject).toBe("the detail on your 2022 Ram 3500");
    expect(plan?.text).toContain("for the detail on your 2022 Ram 3500!");
    expect(plan?.text).not.toContain("De-luxx");
  });

  it("counts an appointment they kept", () => {
    const plan = reviewAskFor({
      firstName: "Sam",
      vehicle: "2021 Ram 3500",
      appointments: [
        appointment({
          title: "Ceramic tint, full vehicle",
          start_at: daysAgo(4),
        }),
      ],
      now: NOW,
    });

    expect(plan?.subject).toBe("the window tint on your 2021 Ram 3500");
    expect(plan?.what).toBe("Ceramic tint, full vehicle");
  });

  it("ignores deposits, cancelled orders and work still in the shop", () => {
    const plan = reviewAskFor({
      orders: [
        order({ is_deposit: true, ordered_at: daysAgo(1) }),
        order({ id: 2, cancelled_at: daysAgo(1), ordered_at: daysAgo(1) }),
      ],
      deals: [
        deal({
          work_status: "in_shop",
          work_status_changed_at: daysAgo(1),
          updated_at: daysAgo(1),
        }),
      ],
      appointments: [appointment({ status: "booked", start_at: daysAgo(1) })],
      now: NOW,
    });

    expect(plan).toBeNull();
  });

  it("stays quiet once the work is more than 30 days old", () => {
    const plan = reviewAskFor({
      orders: [order({ ordered_at: daysAgo(40) })],
      now: NOW,
    });

    expect(plan).toBeNull();
  });

  it("treats a converted job as finished even with no floor status", () => {
    const plan = reviewAskFor({
      deals: [
        deal({
          stage: "won",
          stage_changed_at: daysAgo(6),
          work_status: null,
          work_status_changed_at: null,
          updated_at: daysAgo(6),
        }),
      ],
      now: NOW,
    });

    expect(plan?.at).toBe(daysAgo(6));
  });
});
