import { describe, expect, it } from "vitest";

import { REVIEW_LINK, reviewAsk, reviewSubject } from "./reviewAsk";

describe("reviewSubject", () => {
  it("reads the kind of work out of a package name, not the package", () => {
    expect(
      reviewSubject({ names: ["De-luxx Signature (Small SUV, Truck)"] }),
    ).toBe("your detail");
    expect(
      reviewSubject({
        names: ["Universal Fit - THE LAB - Headlight Restoration"],
      }),
    ).toBe("your detail");
  });

  it("names the vehicle when the work was on one", () => {
    expect(
      reviewSubject({
        names: ["Universal Fit - Suntek - Ceramic Tint - Front Roll Ups"],
        vehicle: "2022 Ram 3500",
      }),
    ).toBe("the window tint on your 2022 Ram 3500");
    expect(
      reviewSubject({
        names: ['2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler'],
        vehicle: "2021 Ram 3500",
      }),
    ).toBe("the parts order for your 2021 Ram 3500");
  });

  it("keeps a parts order and a membership general", () => {
    expect(
      reviewSubject({
        names: ['2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler'],
      }),
    ).toBe("your parts order");
    expect(
      reviewSubject({ names: ["The Lab Monthly Signature Membership"] }),
    ).toBe("your monthly membership");
  });

  it("falls back to the vehicle, then to the visit, when the names say nothing", () => {
    expect(
      reviewSubject({
        names: ["Gridiron bumper install"],
        vehicle: "2021 Ram 3500",
      }),
    ).toBe("the work on your 2021 Ram 3500");
    expect(reviewSubject({ names: ["Gridiron bumper install"] })).toBe(
      "your recent visit",
    );
    expect(reviewSubject({})).toBe("your recent visit");
  });

  it("keeps reading when the first line on an order is a deposit", () => {
    expect(
      reviewSubject({
        names: [
          "$50 Secure Booking Deposit",
          "Universal Fit - THE LAB - Standard Interior Detail 5 & 6 Seater",
        ],
      }),
    ).toBe("your detail");
  });
});

describe("reviewAsk", () => {
  it("greets by first name in Eric's voice and links the Google review form", () => {
    const text = reviewAsk({
      firstName: "Sam",
      names: ["Universal Fit - Suntek - Ceramic Tint - Front Roll Ups"],
      vehicle: "2022 Ram 3500",
    });

    expect(text).toContain("Hey Sam, it's the team at THE LAB.");
    expect(text).toContain("tint on the 2022 Ram 3500");
    expect(text).toContain(REVIEW_LINK);
    expect(text).not.toContain("Suntek");
  });

  it("talks diesel to a tune customer and names the engine", () => {
    const text = reviewAsk({
      firstName: "Dale",
      names: ["EZ LYNK Custom Tune - Cummins 6.7L"],
      vehicle: "2021 Ram 3500",
    });

    expect(text).toMatch(/Cummins/);
    expect(text).toMatch(/tune/i);
    expect(text).not.toMatch(/parts order/i);
  });

  it("mentions the exhaust, never a delete, for an exhaust order", () => {
    const text = reviewAsk({
      firstName: "Jo",
      names: ['2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler'],
    });

    expect(text).toMatch(/exhaust/i);
    expect(text).toMatch(/Duramax/);
    expect(text).not.toMatch(/delete/i);
  });

  it("varies the wording between customers but not for the same one", () => {
    const base = { names: ["EZ LYNK Custom Tune"] };
    const texts = new Set(
      ["A", "B", "C", "D", "E", "F"].map((firstName) =>
        reviewAsk({ ...base, firstName }).replace(/Hey \w+/, ""),
      ),
    );
    expect(texts.size).toBeGreaterThan(1);
    expect(reviewAsk({ ...base, firstName: "A" })).toBe(
      reviewAsk({ ...base, firstName: "A" }),
    );
  });

  it("greets 'there' when the first name is missing", () => {
    expect(reviewAsk({})).toContain("Hey there,");
  });
});
