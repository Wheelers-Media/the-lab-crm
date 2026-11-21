import { describe, expect, it } from "vitest";

import type { Order, Vehicle } from "../types";
import { nextSales } from "./nextSaleModel";
import { suggestionText } from "./suggestionTexts";

const NOW = new Date("2026-11-21T18:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

let nextId = 1;
const order = (daysBack: number, name: string): Order => ({
  id: nextId++,
  shopify_order_id: null,
  order_number: `#${nextId}`,
  contact_id: 7,
  deal_id: null,
  source: "web",
  financial_status: "paid",
  fulfillment_status: null,
  currency: "CAD",
  subtotal: 300,
  total: 300,
  refunded_amount: 0,
  line_items: [{ name, quantity: 1, price: 300 }],
  categories: [],
  is_deposit: false,
  ordered_at: daysAgo(daysBack),
  cancelled_at: null,
  created_at: daysAgo(daysBack),
});

const vehicle = (extra: Partial<Vehicle>): Vehicle => ({
  id: 1,
  contact_id: 7,
  is_primary: true,
  ...extra,
});

const ram = vehicle({
  year: 2020,
  make: "Ram",
  model: "3500",
  platform: "cummins",
  engine: "2019+ 6.7L Cummins (HO)",
  size_class: "truck",
});

const suggest = (orders: Order[], v?: Vehicle | null) =>
  nextSales({ orders, appointments: [], deals: [], vehicle: v, now: NOW });

describe("vehicle-aware suggestions", () => {
  it("offers side-by-side tint, with its fact-sheet prices, instead of truck tint", () => {
    const sxs = vehicle({ make: "Polaris", model: "RZR", platform: "sxs" });
    const sales = suggest([order(40, "Exterior Standard")], sxs);
    const ids = sales.map((s) => s.id);
    expect(ids).toContain("sxs-tint");
    expect(ids).not.toContain("tint");
    expect(sales.find((s) => s.id === "sxs-tint")?.price).toBe(
      "Carbon from $180, ceramic from $260",
    );
  });

  it("offers the matching website power package to a diesel owner with no tune", () => {
    const sales = suggest([order(40, "Complete Standard Signature")], ram);
    const pkg = sales.find((s) => s.id === "power-package");
    expect(pkg?.reason).toContain("2019-2021 6.7L Cummins");
  });

  it("offers the power package in place of a plain tune to a parts buyer", () => {
    const ids = suggest([order(40, "Cummins exhaust")], ram).map((s) => s.id);
    expect(ids).toContain("power-package");
    expect(ids).not.toContain("tune");
  });

  it("does not offer a power package once they have a tune", () => {
    const ids = suggest([order(40, "EZ LYNK tune")], ram).map((s) => s.id);
    expect(ids).not.toContain("power-package");
  });

  it("prices ceramic tint for a crew cab truck from the fact sheet", () => {
    const tint = suggest([order(40, "Complete Standard Signature")], ram).find(
      (s) => s.id === "tint",
    );
    expect(tint?.price).toBe("From $850-$1,100 ceramic");
    expect(tint?.reason).toContain("2020 Ram 3500");
  });

  it("falls back to the front roll-ups price when the size is not on file", () => {
    const tint = suggest([order(40, "Complete Standard Signature")], null).find(
      (s) => s.id === "tint",
    );
    expect(tint?.price).toBe("Front roll-ups from $260 ceramic");
  });

  it("suggests a windshield brow to tint customers who do not have one", () => {
    expect(
      suggest([order(40, "Ceramic tint, crew cab truck")], ram).map(
        (s) => s.id,
      ),
    ).toContain("brow");
    expect(
      suggest(
        [
          order(40, "Ceramic tint, crew cab truck"),
          order(40, "Windshield brow tint"),
        ],
        ram,
      ).map((s) => s.id),
    ).not.toContain("brow");
  });
});

describe("suggestion texts", () => {
  const ctx = { firstName: "Mike", vehicle: ram, membershipPrice: 249 };

  it("names the customer and the truck and ends with how to reach the shop", () => {
    for (const sale of suggest(
      [order(70, "Complete Standard Signature"), order(400, "Cummins exhaust")],
      ram,
    )) {
      const text = suggestionText(sale, ctx);
      expect(text.startsWith("Hi Mike,")).toBe(true);
      expect(text).toMatch(/\(250\) 261-9502|cal\.com\/the-lab/);
    }
  });

  it("says how long it has been for a detail that is due", () => {
    const due = suggest([order(65, "Complete Standard Signature")], ram).find(
      (s) => s.id === "detail-due",
    );
    expect(due).toBeDefined();
    expect(suggestionText(due!, ctx)).toContain(
      "it's been about two months since the 2020 Ram 3500 was in for a detail",
    );
  });

  it("quotes the crew cab ceramic price in the tint text", () => {
    const tint = suggest([order(40, "Complete Standard Signature")], ram).find(
      (s) => s.id === "tint",
    )!;
    expect(suggestionText(tint, ctx)).toContain(
      "Full ceramic on a crew cab truck starts at $850-$1,100",
    );
  });

  it("never mentions delete parts or emissions in any text", () => {
    const sales = suggest([order(40, "Cummins exhaust")], ram);
    for (const sale of sales) {
      expect(suggestionText(sale, ctx)).not.toMatch(
        /delete|egr|dpf|def\b|ccv|emission/i,
      );
    }
  });

  it("falls back to 'there' and 'truck' when the name and vehicle are missing", () => {
    const [first] = suggest([], null);
    expect(suggestionText(first, {})).toBe(
      "Hi there, thanks for reaching out to THE LAB. What can we help you with on the truck? Text or call (250) 261-9502 any time.",
    );
  });
});
