import { describe, expect, it } from "vitest";
import { dealDescription, parseLead } from "./parseLead.ts";

const tint = {
  intent: "quote",
  service: "Window Tinting",
  name: "jane  doe",
  email: " Jane@Example.com ",
  phone: "(250) 555-0123",
  vehicle: "2019 GMC Canyon",
  estimate: {
    total: "$1,260 CAD",
    lines: [{ label: "Front windows (pair)", price: "$260 CAD" }],
  },
  choices: [["Window Tint Preference", "Premium Ceramic"]],
  summary: "Ceramic film, Crew cab truck",
  message: "full email body",
  smsConsent: true,
};

describe("parseLead", () => {
  it("turns a tint quote into a lead for the Intake stage", () => {
    const r = parseLead(tint);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead).toMatchObject({
      category: "window-tint",
      stage: "intake",
      email: "jane@example.com",
      phone: "+12505550123",
      first: "jane",
      last: "doe",
      amount: 1260,
      dealName: "Tint - 2019 GMC Canyon",
      smsConsent: true,
    });
  });

  it("puts a booking request in Qualified", () => {
    const r = parseLead({ ...tint, intent: "book" });
    expect(r.ok && r.lead.stage).toBe("qualified");
  });

  it("needs an email or a phone number", () => {
    const r = parseLead({ ...tint, email: "", phone: "abc" });
    expect(r.ok).toBe(false);
  });

  it("needs a service", () => {
    expect(parseLead({ ...tint, service: " " }).ok).toBe(false);
  });

  it("rejects bodies that are not objects", () => {
    expect(parseLead(null).ok).toBe(false);
    expect(parseLead("hello").ok).toBe(false);
  });

  it("keeps working with a missing estimate and odd choices", () => {
    const r = parseLead({
      service: "Custom Tuning",
      name: "Sam",
      email: "sam@example.com",
      choices: ["bad", null, ["Label", "x"]],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.category).toBe("tuning");
    expect(r.lead.amount).toBeNull();
    expect(r.lead.choices).toEqual(["Label: x"]);
  });

  it("describes the request for the deal", () => {
    const r = parseLead(tint);
    if (!r.ok) throw new Error("should parse");
    const text = dealDescription(r.lead);
    expect(text).toContain("Website quote request");
    expect(text).toContain("Vehicle: 2019 GMC Canyon");
    expect(text).toContain("Starting price $1,260 CAD");
    expect(text).toContain("Front windows (pair): $260 CAD");
  });
});
