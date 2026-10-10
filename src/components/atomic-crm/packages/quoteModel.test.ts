import { describe, expect, it } from "vitest";

import type { Package, WebsiteQuote } from "../types";
import {
  groupByType,
  inferEngine,
  labourLine,
  searchCatalog,
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
  it("leads with what was asked for and never shows parts for another truck", () => {
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
    expect(titles[0]).toBe("2017-2025 Duramax 6.6L - Polar - EGR Delete Kit");
    expect(titles).not.toContain(
      "2011-2016 Duramax 6.6L - Polar - EGR Delete Kit",
    );
    expect(titles).not.toContain(
      "2020-2023 Duramax 3.0L - Polar - EGR Delete Kit",
    );
    expect(titles).not.toContain(
      "2019-2024 Cummins 6.7L - Polar - EGR Delete Kit",
    );
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

  it("puts tuning devices first for a tuning request, then the truck's own parts", () => {
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
    expect(titles).toEqual([
      "EZ LYNK Auto Agent 3",
      "2019-2024 Cummins 6.7L - Polar - EGR Delete Kit",
    ]);
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

// Real Polar Diesel titles from the Shopify catalog
const polar = [
  product('2017-2025 Duramax 6.6L - Polar - 5" Exhaust'),
  product("2017-2025 Duramax 6.6L - Polar - EGR Delete Kit"),
  product("2016-2022 Duramax 2.8L - Polar - EGR Delete Kit"),
  product('2016-2022 Duramax - Polar - 2.8L Colorado/Canyon 3" Exhaust'),
  product("2020-2023 Duramax 3.0L - Polar - EGR Delete Kit"),
  product("2020-2024 Duramax 3.0L - Polar - Delete Pipe"),
  product("2008-2010 Ford Powerstroke 6.4L - Polar - EGR Delete Kit"),
  product("2011-2026 Ford Powerstroke 6.7L - Polar - EGR Delete Kit"),
  product(
    "2014-2018 Ram 1500 - Polar - & 2019+ Classic 3.0L EcoDiesel Delete Pipe",
  ),
  product("2014-2018 - Polar - 3.0L EcoDiesel Jeep Grand Cherokee Delete Pipe"),
  product("2019-2024 Cummins 6.7L - Polar - EGR Delete Kit"),
  product("Polar - Diesel Universal Exhaust Clamp"),
];

const titlesFor = (vehicle: {
  year: number | null;
  make: string;
  model: string;
  engine?: string;
}) =>
  suggestProducts(
    polar,
    quoteContext({
      name: "Quote",
      vehicle: { engine: null, platform: null, ...vehicle },
    }),
    20,
  ).map((p) => p.title);

describe("suggestions by vehicle", () => {
  it("never shows 6.6L or 3.0L parts for a 2.8L Colorado", () => {
    // Arrange / Act
    const titles = titlesFor({
      year: 2019,
      make: "Chevrolet",
      model: "Colorado",
    });

    // Assert
    expect(titles.sort()).toEqual([
      '2016-2022 Duramax - Polar - 2.8L Colorado/Canyon 3" Exhaust',
      "2016-2022 Duramax 2.8L - Polar - EGR Delete Kit",
    ]);
  });

  it("knows a Sierra 2500 is a 6.6L even when the engine was not entered", () => {
    // Arrange / Act
    const titles = titlesFor({
      year: 2021,
      make: "GMC",
      model: "Sierra 2500 HD",
    });

    // Assert
    expect(titles.sort()).toEqual([
      '2017-2025 Duramax 6.6L - Polar - 5" Exhaust',
      "2017-2025 Duramax 6.6L - Polar - EGR Delete Kit",
    ]);
  });

  it("uses the model year to tell a 6.4L Super Duty from a 6.7L", () => {
    // Arrange / Act
    const titles = titlesFor({ year: 2009, make: "Ford", model: "F-250" });

    // Assert
    expect(titles).toEqual([
      "2008-2010 Ford Powerstroke 6.4L - Polar - EGR Delete Kit",
    ]);
  });

  it("keeps Jeep parts off a Ram 1500 with the same 3.0L EcoDiesel", () => {
    // Arrange / Act
    const titles = titlesFor({ year: 2017, make: "Ram", model: "1500" });

    // Assert
    expect(titles).toEqual([
      "2014-2018 Ram 1500 - Polar - & 2019+ Classic 3.0L EcoDiesel Delete Pipe",
    ]);
  });

  it("shows no engine-specific parts when the engine cannot be worked out", () => {
    // Arrange / Act
    const titles = titlesFor({ year: 2007, make: "Dodge", model: "Ram 2500" });

    // Assert
    expect(titles).toEqual([]);
  });
});

describe("groupByType", () => {
  it("groups a truck's parts by type with the requested type first", () => {
    // Arrange
    const parts = [
      product('2017-2025 Duramax 6.6L - Polar - 5" Exhaust'),
      product("2017-2025 Duramax 6.6L - Polar - Downpipe"),
      product("2017-2025 Duramax 6.6L - Polar - Delete Pipe"),
      product("2017-2025 Duramax 6.6L - Polar - EGR Delete Kit"),
    ];

    // Act
    const groups = groupByType(parts, ["egr"]).map((g) => g.type);

    // Assert
    expect(groups).toEqual(["EGR", "Exhaust", "Delete pipes", "Downpipes"]);
  });
});

describe("searchCatalog", () => {
  it("finds parts by any words in the name or SKU, truck fits first", () => {
    // Arrange
    const ctx = quoteContext({
      vehicle: {
        year: 2018,
        make: "Ram",
        model: "2500",
        engine: null,
        platform: null,
      },
    });
    const catalog = [
      product("2019-2024 Cummins 6.7L - Polar - EGR Delete Kit"),
      product("2010-2018 Cummins 6.7L - Polar - EGR Delete Kit", {
        variants: [
          {
            id: "v1",
            title: "Default Title",
            price: 600,
            sku: "PD-2-21934000",
          },
        ],
      }),
    ];

    // Act
    const byWords = searchCatalog(catalog, "egr cummins", ctx).map(
      (p) => p.title,
    );
    const bySku = searchCatalog(catalog, "pd-2-2193", ctx).map((p) => p.title);

    // Assert
    expect(byWords).toEqual([
      "2010-2018 Cummins 6.7L - Polar - EGR Delete Kit",
      "2019-2024 Cummins 6.7L - Polar - EGR Delete Kit",
    ]);
    expect(bySku).toEqual(["2010-2018 Cummins 6.7L - Polar - EGR Delete Kit"]);
  });
});

describe("labourLine", () => {
  it("bills labour at $125 an hour with the hours as the quantity", () => {
    // Arrange / Act
    const totals = quoteTotals([labourLine(2.5)]);

    // Assert
    expect(totals).toEqual({ parts: 0, labour: 312.5, total: 312.5 });
  });
});

describe("inferEngine", () => {
  it("reads the diesel engine from the model and year", () => {
    // Arrange
    const cases: Array<[string, number | null, string | null]> = [
      ["Chevrolet Silverado 1500", 2021, "3.0"],
      ["Ford F-350", 2005, "6.0"],
      ["Ram 3500", 2006, "5.9"],
      ["Nissan Titan XD", 2018, "5.0"],
      ["Ford F-350", null, null],
    ];

    // Act
    const results = cases.map(([model, year]) => inferEngine(model, year));

    // Assert
    expect(results).toEqual(cases.map(([, , engine]) => engine));
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
