import { describe, expect, it } from "vitest";

import { stampSmsConsent } from "./contactModel";
import { customerPlace, leadSourceName } from "./customerProfile";

const NOW = new Date("2026-10-09T18:00:00Z");

describe("stampSmsConsent", () => {
  it("records when a customer first agrees to texts", () => {
    expect(stampSmsConsent({ sms_consent: true }, NOW).sms_consent_at).toBe(
      NOW.toISOString(),
    );
  });

  it("keeps the original consent date on later saves", () => {
    const at = "2026-01-02T00:00:00.000Z";
    expect(
      stampSmsConsent({ sms_consent: true, sms_consent_at: at }, NOW)
        .sms_consent_at,
    ).toBe(at);
  });

  it("clears the date when the customer withdraws", () => {
    expect(
      stampSmsConsent(
        { sms_consent: false, sms_consent_at: "2026-01-02T00:00:00.000Z" },
        NOW,
      ).sms_consent_at,
    ).toBeNull();
  });
});

describe("customer profile labels", () => {
  it("joins city and province", () => {
    expect(customerPlace({ city: "Fort St. John", province: "BC" })).toBe(
      "Fort St. John, BC",
    );
    expect(customerPlace({ city: null, province: "BC" })).toBe("BC");
  });

  it("names the sources the connectors write", () => {
    expect(leadSourceName("cal.com")).toBe("Cal.com booking");
    expect(leadSourceName("shopify")).toBe("Shopify order");
    expect(leadSourceName("tiktok")).toBe("tiktok");
  });
});
