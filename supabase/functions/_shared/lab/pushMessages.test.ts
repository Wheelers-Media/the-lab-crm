import { describe, expect, it } from "vitest";
import {
  bookingMessage,
  depositMessage,
  leadMessage,
  orderMessage,
  wantsKind,
} from "./pushMessages";

describe("leadMessage", () => {
  it("says who wants what, and opens their job", () => {
    const m = leadMessage({
      dealId: 42,
      name: "Jamie Croft",
      service: "Window tint",
      vehicle: "2022 Ram 3500",
      intent: "quote",
      from: "Instagram",
    });

    expect(m.title).toBe("New quote request");
    expect(m.body).toBe(
      "Jamie Croft · Window tint · 2022 Ram 3500 · from Instagram",
    );
    expect(m.url).toBe("/#/deals/42/show");
    expect(m.tag).toBe("lead-42");
  });

  it("calls a booking request a booking request and skips empty parts", () => {
    const m = leadMessage({
      dealId: 7,
      name: "Sam",
      service: "Detailing",
      vehicle: "",
      intent: "book",
    });

    expect(m.title).toBe("New booking request");
    expect(m.body).toBe("Sam · Detailing");
  });

  it("keeps the body short enough for a lock screen", () => {
    const m = leadMessage({
      dealId: 1,
      name: "N".repeat(100),
      service: "S".repeat(100),
      vehicle: "V".repeat(100),
      intent: "quote",
    });

    expect(m.body.length).toBeLessThanOrEqual(140);
  });
});

describe("bookingMessage", () => {
  it("titles a new, moved and cancelled booking differently", () => {
    const base = {
      uid: "abc",
      title: "Interior detail",
      name: "Sam Lee",
      when: "Mon, Nov 2, 8:00 a.m.",
    };

    expect(bookingMessage({ ...base, trigger: "BOOKING_CREATED" }).title).toBe(
      "New booking",
    );
    expect(
      bookingMessage({ ...base, trigger: "BOOKING_RESCHEDULED" }).title,
    ).toBe("Booking moved");
    expect(
      bookingMessage({ ...base, trigger: "BOOKING_CANCELLED" }).title,
    ).toBe("Booking cancelled");
    expect(bookingMessage({ ...base, trigger: "BOOKING_CREATED" }).url).toBe(
      "/#/calendar",
    );
  });
});

describe("depositMessage and orderMessage", () => {
  it("open the job when there is one, the orders list when there is not", () => {
    expect(
      depositMessage({ name: "Sam", orderNumber: "#1042", dealId: 9 }).url,
    ).toBe("/#/deals/9/show");
    expect(depositMessage({ name: "Sam", orderNumber: "#1042" }).url).toBe(
      "/#/orders",
    );
  });

  it("shows an order's total in dollars", () => {
    expect(
      orderMessage({ name: "Sam", orderNumber: "#1043", total: 1250 }).title,
    ).toBe("New order $1,250");
    expect(
      orderMessage({ name: "Sam", orderNumber: "#1043", total: 19.5 }).title,
    ).toBe("New order $19.50");
  });
});

describe("wantsKind", () => {
  it("treats anything not switched off as on", () => {
    expect(wantsKind({}, "lead")).toBe(true);
    expect(wantsKind(null, "order")).toBe(true);
    expect(wantsKind({ order: false }, "order")).toBe(false);
    expect(wantsKind({ order: false }, "lead")).toBe(true);
  });
});
