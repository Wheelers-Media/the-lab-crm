// @vitest-environment node
import { describe, expect, it } from "vitest";

import { packageFromProduct, packageTitle } from "./packages.ts";

const product = (over: Record<string, unknown> = {}) => ({
  id: 9001,
  title: "Universal Fit - Suntek - Ceramic Tint - Panoramic Roof",
  vendor: "The Lab",
  status: "unlisted",
  updated_at: "2026-10-01T00:00:00Z",
  variants: [{ id: 1, title: "Default Title", price: "250.00" }],
  ...over,
});

describe("packageFromProduct", () => {
  it("copies a shop service with a short title, category and price", () => {
    expect(packageFromProduct(product())).toMatchObject({
      shopify_product_id: "9001",
      title: "Ceramic Tint - Panoramic Roof",
      category: "window-tint",
      bay: "boutique",
      price: 250,
      price_max: 250,
      status: "unlisted",
    });
  });

  it("keeps the price range of products with options", () => {
    const row = packageFromProduct(
      product({
        title:
          "2019 Ram 2500 - GRIDIRON - + /3500 Prerunner Winch Front Bumper",
        vendor: "Gridiron Bumper Corp.",
        status: "active",
        variants: [
          { id: 1, title: "Black", price: "4299.00" },
          { id: 2, title: "Custom colour", price: "4899.00" },
        ],
      }),
    );
    expect(row).toMatchObject({
      category: "gridiron",
      price: 4299,
      price_max: 4899,
    });
    expect(row?.variants).toHaveLength(2);
  });

  it("sorts detailing, memberships, gift cards and labour", () => {
    const cat = (title: string) =>
      packageFromProduct(product({ title }))?.category;
    expect(cat("De-luxx Signature (Small SUV, Truck)")).toBe("detailing");
    expect(cat("The Monthly Signature Membership")).toBe("membership");
    expect(cat("The Lab Gift Card")).toBe("gift-certificate");
    expect(cat("Universal Fit - THE LAB - Mechanical Shop Rate")).toBe(
      "install",
    );
    expect(cat("SxS Ceramic Tint - Full")).toBe("sxs-tint");
  });

  it("marks shop services as packages and the rest as products", () => {
    const kind = (over: Record<string, unknown>) =>
      packageFromProduct(product(over))?.kind;
    expect(kind({})).toBe("package");
    expect(kind({ vendor: "Gridiron Bumper Corp." })).toBe("package");
    expect(kind({ vendor: "Polar Diesel", title: "5in Exhaust" })).toBe(
      "product",
    );
    expect(kind({ title: "$50 Secure Booking Deposit" })).toBe("product");
    expect(kind({ title: "The Lab - Where Legends Are Made Hoodie" })).toBe(
      "product",
    );
  });

  it("files parts in the Parts Store bay with stock and picture", () => {
    const row = packageFromProduct(
      product({
        title: "EZ LYNK Auto Agent 3",
        vendor: "EZ LYNK",
        product_type: "Programmer/Monitor",
        handle: "ez-lynk-auto-agent-3",
        image: { src: "https://cdn.shopify.com/a.jpg" },
        variants: [
          {
            id: 7,
            title: "Default Title",
            price: "1099.00",
            sku: "EZL-AA3",
            inventory_management: "shopify",
            inventory_quantity: 3,
          },
        ],
      }),
    );
    expect(row).toMatchObject({
      kind: "product",
      category: "tuning",
      bay: "parts",
      product_type: "Programmer/Monitor",
      handle: "ez-lynk-auto-agent-3",
      image_url: "https://cdn.shopify.com/a.jpg",
      inventory: 3,
    });
    expect(row?.variants[0]).toMatchObject({ sku: "EZL-AA3", inventory: 3 });
  });

  it("leaves stock empty when Shopify does not track it", () => {
    expect(packageFromProduct(product())?.inventory).toBeNull();
  });

  it("ignores products without an id or title", () => {
    expect(packageFromProduct(product({ id: null }))).toBeNull();
    expect(packageFromProduct(product({ title: "" }))).toBeNull();
  });
});

describe("packageTitle", () => {
  it("drops the Universal Fit prefix only", () => {
    expect(packageTitle("Universal Fit - THE LAB - Exterior Wash")).toBe(
      "Exterior Wash",
    );
    expect(packageTitle("Standard Signature (Large SUV/Van)")).toBe(
      "Standard Signature (Large SUV/Van)",
    );
  });
});
