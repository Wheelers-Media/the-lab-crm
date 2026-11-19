// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseCalBooking,
  parseShopifyCheckout,
  parseShopifyOrder,
  parseWebsiteLead,
  referralFrom,
} from "./parse.ts";

describe("referral tag", () => {
  it("keeps a valid code and a clean keyword, drops anything else", () => {
    expect(referralFrom("NW", "L5P")).toEqual({ code: "nw", keyword: "L5P" });
    expect(referralFrom("nw", "<b>l5p</b>")).toEqual({
      code: "nw",
      keyword: "bl5pb",
    });
    expect(referralFrom("", "L5P")).toBeNull();
    expect(referralFrom("n w", "")).toBeNull();
    expect(referralFrom(undefined, undefined)).toBeNull();
  });

  it("reads the tag, refund date and product ids off a Shopify order", () => {
    const parsed = parseShopifyOrder({
      id: 1,
      name: "#1001",
      financial_status: "refunded",
      note_attributes: [
        { name: "Ref", value: "nw" },
        { name: "Ref keyword", value: "L5P" },
      ],
      refunds: [
        { created_at: "2026-11-20T10:00:00Z", transactions: [] },
        { created_at: "2026-11-22T10:00:00Z", transactions: [] },
      ],
      line_items: [{ name: "AMDP Tune", price: "900", product_id: 42 }],
    });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.referral).toEqual({ code: "nw", keyword: "L5P" });
    expect(parsed.value.refundedAt).toBe("2026-11-22T10:00:00Z");
    expect(parsed.value.lineItems[0].product_id).toBe("42");
  });

  it("finds no tag on an untagged order", () => {
    const parsed = parseShopifyOrder({ id: 2, line_items: [] });
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.referral).toBeNull();
    expect(parsed.value.refundedAt).toBeNull();
  });

  it("reads the tag off a checkout, a booking and a website lead", () => {
    const checkout = parseShopifyCheckout({
      token: "t",
      note_attributes: [{ name: "Ref", value: "nw" }],
    });
    if (!checkout.ok) throw new Error(checkout.error);
    expect(checkout.value.referral).toEqual({ code: "nw", keyword: "" });

    const booking = parseCalBooking({
      triggerEvent: "BOOKING_CREATED",
      payload: { uid: "u", metadata: { ref: "nw", kw: "Cummins" } },
    });
    if (!booking.ok) throw new Error(booking.error);
    expect(booking.value.referral).toEqual({ code: "nw", keyword: "Cummins" });

    const lead = parseWebsiteLead({
      email: "test@example.com",
      referral: { code: "nw", keyword: "L5P", at: "2026-11-19T00:00:00Z" },
    });
    if (!lead.ok) throw new Error(lead.error);
    expect(lead.value.referral).toEqual({ code: "nw", keyword: "L5P" });
  });
});
