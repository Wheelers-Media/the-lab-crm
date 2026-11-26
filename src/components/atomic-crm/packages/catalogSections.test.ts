import { describe, expect, it } from "vitest";

import {
  matchesCatalogQuery,
  sectionCounts,
  sectionOf,
} from "./catalogSections";

const item = (title: string, over = {}) => ({
  title,
  category: null,
  product_type: null,
  tags: [],
  vendor: "",
  ...over,
});

describe("sectionOf", () => {
  it("files the store's parts under the website's headings", () => {
    expect(
      sectionOf(item("2020-2022 Cummins 6.7L - EZ LYNK Auto Agent 3")),
    ).toBe("tuning");
    expect(sectionOf(item("2017-2025 Duramax 6.6L EGR Cooler Kit"))).toBe(
      "egr",
    );
    expect(sectionOf(item('2020 Powerstroke 4" Downpipe'))).toBe("exhaust");
    expect(sectionOf(item("Cummins CCV Reroute Kit"))).toBe("ccv");
    expect(sectionOf(item("THE LAB T-Shirt"))).toBe("merch");
  });

  it("files Gridiron bumpers under bumpers and accessories", () => {
    expect(
      sectionOf(item("2023 Ford F-250 Winch Bumper", { vendor: "Gridiron" })),
    ).toBe("accessories");
  });

  it("files the Boutique's services under tint, detailing and lighting", () => {
    expect(sectionOf(item("Ceramic Tint - Front Roll Ups"))).toBe("tint");
    expect(sectionOf(item("De-luxx Signature (Small SUV, Truck)"))).toBe(
      "detailing",
    );
    expect(sectionOf(item("Custom Light Bar Install"))).toBe("lighting");
    expect(sectionOf(item("SxS Ceramic Tint"))).toBe("sxs");
    expect(sectionOf(item("The Monthly Signature Membership"))).toBe(
      "membership",
    );
  });

  it("trusts Shopify's own product type over a guess from the title", () => {
    expect(sectionOf(item("Mystery kit", { product_type: "Exhaust" }))).toBe(
      "exhaust",
    );
    expect(sectionOf(item("Mystery kit", { tags: ["CCV"] }))).toBe("ccv");
  });

  it("falls back to other when nothing says what it is", () => {
    expect(sectionOf(item("Gift thing"))).toBe("other");
  });
});

describe("sectionCounts", () => {
  it("counts each section, including empty ones as zero", () => {
    const counts = sectionCounts([
      item("EGR Cooler"),
      item("EGR Plate"),
      item("Hat"),
    ]);
    expect(counts.egr).toBe(2);
    expect(counts.merch).toBe(1);
    expect(counts.tuning).toBe(0);
  });
});

describe("matchesCatalogQuery", () => {
  const pkg = {
    ...item("Polar Exhaust", { vendor: "Polar", tags: ["Powerstroke"] }),
    variants: [{ id: "1", title: "Black", price: 1, sku: "PD-123" }],
  };
  it("needs every word and reads vendor, tags and SKUs", () => {
    expect(matchesCatalogQuery(pkg, "polar powerstroke")).toBe(true);
    expect(matchesCatalogQuery(pkg, "pd-123")).toBe(true);
    expect(matchesCatalogQuery(pkg, "polar duramax")).toBe(false);
    expect(matchesCatalogQuery(pkg, "")).toBe(true);
  });
});
