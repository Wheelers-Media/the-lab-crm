import { describe, expect, it } from "vitest";

import {
  askedNote,
  askedContacts,
  canAskReview,
  isDueForReview,
  nextEveningReminder,
  reviewTiming,
  wasAsked,
} from "./orderReview";

const paid = {
  is_deposit: false,
  cancelled_at: null,
  financial_status: "paid",
  refunded_amount: 0,
  total: 100,
  contact_id: 1,
};

describe("canAskReview", () => {
  it("allows a paid order and refuses deposits, cancels and unlinked orders", () => {
    expect(canAskReview(paid)).toBe(true);
    expect(canAskReview({ ...paid, is_deposit: true })).toBe(false);
    expect(canAskReview({ ...paid, cancelled_at: "2026-11-01" })).toBe(false);
    expect(canAskReview({ ...paid, contact_id: null })).toBe(false);
    expect(canAskReview({ ...paid, financial_status: "pending" })).toBe(false);
  });
});

describe("isDueForReview", () => {
  const now = new Date("2026-11-26T18:00:00Z");
  it("keeps the ask to the last 30 days", () => {
    expect(isDueForReview({ ordered_at: "2026-11-20T00:00:00Z" }, now)).toBe(
      true,
    );
    expect(isDueForReview({ ordered_at: "2026-10-01T00:00:00Z" }, now)).toBe(
      false,
    );
  });
});

describe("reviewTiming", () => {
  it("is a good time in the evening and not during the day", () => {
    // 6 p.m. and 1 p.m. in Fort St. John (UTC-7)
    expect(reviewTiming(new Date("2026-11-27T01:00:00Z")).good).toBe(true);
    expect(reviewTiming(new Date("2026-11-26T20:00:00Z")).good).toBe(false);
  });
});

describe("nextEveningReminder", () => {
  it("is 6 p.m. today when it is still daytime", () => {
    expect(
      nextEveningReminder(new Date("2026-11-26T20:00:00Z")).toISOString(),
    ).toBe("2026-11-27T01:00:00.000Z");
  });

  it("rolls to tomorrow's 6 p.m. once tonight has passed", () => {
    expect(
      nextEveningReminder(new Date("2026-11-27T03:00:00Z")).toISOString(),
    ).toBe("2026-11-28T01:00:00.000Z");
  });
});

describe("asked notes", () => {
  const now = new Date("2026-11-26T18:00:00Z");
  it("counts a customer as asked for 30 days, whichever order it was", () => {
    const asked = askedContacts(
      [
        {
          contact_id: 5,
          text: askedNote({ order_number: "1042" }),
          date: "2026-11-20T00:00:00Z",
        },
        { contact_id: 6, text: "Called back", date: "2026-11-20T00:00:00Z" },
        {
          contact_id: 7,
          text: askedNote({ order_number: "900" }),
          date: "2026-09-01T00:00:00Z",
        },
      ],
      now,
    );
    expect(wasAsked({ contact_id: 5 }, asked)).toBe(true);
    expect(wasAsked({ contact_id: 6 }, asked)).toBe(false);
    expect(wasAsked({ contact_id: 7 }, asked)).toBe(false);
    expect(wasAsked({ contact_id: null }, asked)).toBe(false);
  });
});
