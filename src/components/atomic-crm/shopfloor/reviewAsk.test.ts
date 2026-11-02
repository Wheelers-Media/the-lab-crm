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
  it("greets the customer by first name and links the shop's Google review form", () => {
    const text = reviewAsk({
      firstName: "Sam",
      names: ["Universal Fit - Suntek - Ceramic Tint - Front Roll Ups"],
      vehicle: "2022 Ram 3500",
    });

    expect(text).toContain(
      "Hi Sam, thanks for choosing THE LAB for the window tint on your 2022 Ram 3500!",
    );
    expect(text).toContain(REVIEW_LINK);
    expect(text).not.toContain("Suntek");
  });

  it("greets 'there' when the first name is missing", () => {
    expect(reviewAsk({})).toContain("Hi there,");
  });
});
