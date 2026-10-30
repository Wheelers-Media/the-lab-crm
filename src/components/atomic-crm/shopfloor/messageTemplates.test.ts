import { describe, expect, it } from "vitest";

import type { DealCheckout } from "../types";
import { smsHref, templatesFor } from "./messageTemplates";

const checkout = (over: Partial<DealCheckout> = {}): DealCheckout => ({
  url: "https://shop.example/pay/abc",
  draft_order_name: "#D12",
  mode: "parts",
  due_now: 1250.5,
  due_at_pickup: 375,
  emailed: false,
  created_at: "2026-10-10T12:00:00Z",
  ...over,
});

describe("templatesFor", () => {
  it("puts the text that fits where the vehicle is first", () => {
    const ctx = { firstName: "Sam", vehicle: "2022 Ram 3500" };

    const ready = templatesFor({ work_status: "ready" }, ctx);
    const parts = templatesFor({ work_status: "waiting_parts" }, ctx);
    const done = templatesFor({ work_status: "picked_up" }, ctx);

    expect(ready[0].id).toBe("ready");
    expect(parts[0].id).toBe("parts");
    expect(done[0].id).toBe("review");
  });

  it("greets by first name and names the vehicle", () => {
    const [ready] = templatesFor(
      { work_status: "ready" },
      { firstName: "Sam", vehicle: "2022 Ram 3500" },
    );

    expect(ready.body).toContain("Hi Sam,");
    expect(ready.body).toContain("your 2022 Ram 3500 is ready for pickup");
    expect(ready.body).toContain("(250) 261-9502");
  });

  it("falls back to a plain greeting and 'vehicle' when nothing is known", () => {
    const [ready] = templatesFor({ work_status: "ready" }, {});

    expect(ready.body).toContain("Hi there,");
    expect(ready.body).toContain("your vehicle is ready");
  });

  it("sends the status link as its own text and adds it to the ready text, only when the job has a token", () => {
    const none = templatesFor({ work_status: "ready" }, { firstName: "Sam" });
    const tokened = templatesFor(
      { work_status: "ready", status_token: "ab12" },
      { firstName: "Sam", job: "Ceramic tint" },
    );

    expect(none.some((t) => t.id === "status")).toBe(false);
    expect(none[0].body).not.toContain("thelabfsj.ca/status");
    const status = tokened.find((t) => t.id === "status")!;
    expect(status.body).toContain("https://thelabfsj.ca/status/?t=ab12");
    expect(tokened[0].body).toContain("https://thelabfsj.ca/status/?t=ab12");
  });

  it("puts the check-in text first for a quote nobody has answered", () => {
    const quoted = templatesFor(
      { stage: "quoted" },
      { firstName: "Sam", job: "Ceramic tint" },
    );
    const other = templatesFor({ stage: "booked" }, { firstName: "Sam" });

    expect(quoted[0].id).toBe("followup");
    expect(quoted[0].body).toContain(
      "checking in on the quote for your Ceramic tint",
    );
    expect(other[0].id).not.toBe("followup");
  });

  it("offers the pay link only once a checkout link exists, and says what it covers", () => {
    const without = templatesFor({}, { firstName: "Sam" });
    const withLink = templatesFor(
      { checkout: checkout() },
      { firstName: "Sam", job: "Exhaust install" },
    );

    expect(without.some((t) => t.id === "quote")).toBe(false);
    const quote = withLink.find((t) => t.id === "quote")!;
    expect(quote.body).toContain("https://shop.example/pay/abc");
    expect(quote.body).toContain("The labour is paid when you pick up");
    expect(quote.body).toContain("$1,250.50");
  });

  it("says a pay-everything link covers everything", () => {
    const withLink = templatesFor(
      { checkout: checkout({ mode: "all", due_now: 1625.5 }) },
      {},
    );

    expect(withLink.find((t) => t.id === "quote")!.body).toContain(
      "It covers everything ($1,625.50)",
    );
  });
});

describe("smsHref", () => {
  const body = "Hi Sam, ready & waiting";

  it("uses & before the body on iPhones and ? on Android", () => {
    expect(smsHref("(250) 261-9502", body, "Mozilla/5.0 (iPhone)")).toMatch(
      /^sms:2502619502&body=/,
    );
    expect(
      smsHref("(250) 261-9502", body, "Mozilla/5.0 (Linux; Android 14)"),
    ).toMatch(/^sms:2502619502\?body=/);
  });

  it("encodes the text so & and spaces survive", () => {
    const href = smsHref("+1 250 261 9502", body, "Android");

    expect(href).toBe(
      "sms:+12502619502?body=Hi%20Sam%2C%20ready%20%26%20waiting",
    );
  });
});
