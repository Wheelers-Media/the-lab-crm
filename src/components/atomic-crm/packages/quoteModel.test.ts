import { describe, expect, it } from "vitest";

import type { Package, WebsiteQuote } from "../types";
import {
  lineFromCatalog,
  quoteContext,
  quoteTotals,
  suggestProducts,
} from "./quoteModel";

let nextId = 1;
const product = (title: string, extra: Partial<Package> = {}): Package => ({
  id: nextId++,
  shopify_product_id: String(nextId),
  title,
  shopify_title: title,
  vendor: "Polar Diesel",
  category: "diesel-parts",
  bay: "parts",
  price: 500,
  price_max: null,
  variants: [{ id: `v${nextId}`, title: "Default Title", price: 500 }],
  status: "active",
  synced_at: "2026-10-01T00:00:00Z",
  shopify_updated_at: null,
  kind: "product",
  product_type: null,
  handle: null,
  image_url: null,
  inventory: null,
  ...extra,
});

const catalog = [
  product('2017-2025 Duramax 6.6L - Polar - 5" Exhaust'),
  product('2017-2025 Duramax 6.6L - Polar - 5" Exhaust With Muffler'),
  product("2017-2025 Duramax 6.6L - Polar - EGR Delete Kit"),
  product("2011-2016 Duramax 6.6L - Polar - EGR Delete Kit"),
  product("2019-2024 Cummins 6.7L - Polar - EGR Delete Kit"),
  product("2020-2023 Duramax 3.0L - Polar - EGR Delete Kit"),
  product("EZ LYNK Auto Agent 3"),
  product("Window tint - Full vehicle", { kind: "package", bay: "boutique" }),
];

const quote = (
  choices: Array<[string, string]>,
): Pick<WebsiteQuote, "choices" | "summary"> & WebsiteQuote => ({
  total: "",
  lines: [],
  summary: "",
  source: "form",
  page: "/contact/",
  choices: choices.map(([label, value]) => ({ label, value })),
});

describe("quoteContext", () => {
  it("reads the platform, year and engine from the customer's vehicle", () => {
    // Arrange
    const vehicle = {
      year: 2020,
      make: "GMC",
      model: "Sierra 2500",
      engine: "6.6L Duramax",
      platform: null,
    };

    // Act
    const ctx = quoteContext({ name: "Tuning - Sierra", vehicle });

    // Assert
    expect(ctx).toMatchObject({
      platform: "duramax",
      year: 2020,
      engine: "6.6",
      services: ["tuning"],
    });
  });

  it("does not treat mods already on the truck as a service request", () => {
    // Arrange
    const q = quote([
      ["Service Requested", "Exhaust Systems"],
      ["Mods already on the truck", "DPF / EGR / DEF removed"],
      ["Exhaust: Straight Pipe?", "I need muffler"],
      ["Exhaust: Diameter Size", 'Full 5"'],
    ]);

    // Act
    const ctx = quoteContext({ quote: q });

    // Assert
    expect(ctx.services).toEqual(["exhaust"]);
    expect(ctx.wantsMuffler).toBe(true);
    expect(ctx.diameter).toBe("5");
  });
});

describe("suggestProducts", () => {
  it("suggests only parts that fit the truck's platform, year and engine", () => {
    // Arrange
    const ctx = quoteContext({
      name: "EGR Solutions",
      vehicle: {
        year: 2019,
        make: "Chevrolet",
        model: "Silverado 2500",
        engine: "6.6L",
      },
    });

    // Act
    const titles = suggestProducts(catalog, ctx).map((p) => p.title);

    // Assert
    expect(titles).toEqual(["2017-2025 Duramax 6.6L - Polar - EGR Delete Kit"]);
  });

  it("puts the muffler kit first when the customer said they need a muffler", () => {
    // Arrange
    const ctx = quoteContext({
      quote: quote([
        ["Service Requested", "Exhaust Systems"],
        ["Exhaust: Straight Pipe?", "I need muffler"],
      ]),
      vehicle: {
        year: 2021,
        make: "GMC",
        model: "Sierra 3500",
        engine: "6.6L Duramax",
      },
    });

    // Act
    const titles = suggestProducts(catalog, ctx).map((p) => p.title);

    // Assert
    expect(titles[0]).toBe(
      '2017-2025 Duramax 6.6L - Polar - 5" Exhaust With Muffler',
    );
    expect(titles).not.toContain(
      "2019-2024 Cummins 6.7L - Polar - EGR Delete Kit",
    );
  });

  it("suggests tuning devices that fit any truck for a tuning request", () => {
    // Arrange
    const ctx = quoteContext({
      name: "Custom Tuning - Ram 2500",
      vehicle: {
        year: 2020,
        make: "Ram",
        model: "2500",
        engine: "6.7L Cummins",
      },
    });

    // Act
    const titles = suggestProducts(catalog, ctx).map((p) => p.title);

    // Assert
    expect(titles).toEqual(["EZ LYNK Auto Agent 3"]);
  });

  it("suggests nothing when it cannot tell the truck or the service", () => {
    // Arrange
    const ctx = quoteContext({ name: "Walk-in" });

    // Act
    const result = suggestProducts(catalog, ctx);

    // Assert
    expect(result).toEqual([]);
  });
});

describe("quoteTotals", () => {
  it("splits parts paid up front from labour paid at pickup", () => {
    // Arrange
    const lines = [
      lineFromCatalog(catalog[0]),
      {
        package_id: null,
        title: "Install",
        price: 350,
        quantity: 1,
        kind: "labour" as const,
      },
      { ...lineFromCatalog(catalog[2]), quantity: 2 },
    ];

    // Act
    const totals = quoteTotals(lines);

    // Assert
    expect(totals).toEqual({ parts: 1500, labour: 350, total: 1850 });
  });

  it("counts older job lines without a kind as labour", () => {
    // Arrange
    const lines = [
      { package_id: 4, title: "Ceramic coating", price: 900, quantity: 1 },
    ];

    // Act
    const totals = quoteTotals(lines);

    // Assert
    expect(totals).toEqual({ parts: 0, labour: 900, total: 900 });
  });
});
