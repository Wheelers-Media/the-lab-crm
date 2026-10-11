// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  htmlToText,
  packageFromGraphql,
  packageFromProduct,
  packageTitle,
} from "./packages.ts";
import { archivedBulbs, polarExhaust } from "./shopifyFixtures.ts";

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

describe("packageFromGraphql", () => {
  it("maps a real product: ids, brand, shipping tag, stock and the freight weight", () => {
    const row = packageFromGraphql(polarExhaust)!;

    expect(row).toMatchObject({
      shopify_product_id: "7466040983646",
      title: '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
      vendor: "Polar Diesel",
      kind: "product",
      category: "diesel-parts",
      bay: "parts",
      status: "active",
      price: 1083,
      inventory: -1,
      handle: "2017-2025-duramax-6-6l-4-polar-exhaust-with-muffler",
    });
    expect(row.tags).toContain("Shipping: Exhaust");
    expect(row.variants[0]).toEqual({
      id: "42069908979806",
      title: "Default Title",
      price: 1083,
      sku: "PD-1-32934141",
      inventory: -1,
      compare_at: undefined,
      weight_kg: 35,
      cost: undefined,
    });
  });

  it("keeps the pictures once, cover first, with their captions", () => {
    const row = packageFromGraphql(polarExhaust)!;

    expect(row.image_url).toBe("https://cdn.shopify.com/files/muffler.jpg?v=1");
    expect(row.images).toEqual([
      { url: "https://cdn.shopify.com/files/muffler.jpg?v=1" },
      {
        url: "https://cdn.shopify.com/files/muffler2.jpg?v=1",
        alt: "Side view",
      },
    ]);
  });

  it("turns the HTML description into plain text with bullets and decoded characters", () => {
    const row = packageFromGraphql(polarExhaust)!;

    expect(row.description).toBe(
      [
        "Polar Diesel exhaust kits are designed to concur the elements.",
        "",
        "Technical Specifications:",
        "",
        "• Standard muffler included",
        "• 2017-2025 Chevrolet/GMC Duramax 6.6L L5P",
        "• Depending on Box & Cab configuration, one cut will need to be made.",
        "",
        "WARNING: This product is designed and intended strictly for Off-Road and Sanctioned Racing Use Only.",
      ].join("\n"),
    );
  });

  it("reads cost and a sale price when Shopify shares them, and the archived status", () => {
    const row = packageFromGraphql(archivedBulbs)!;

    expect(row.status).toBe("archived");
    expect(row.variants[0]).toMatchObject({ cost: 97.95, compare_at: 199.99 });
    expect(row.variants[0].weight_kg).toBeUndefined(); // 0 means "not set"
    expect(row.images).toEqual([]);
    expect(row.image_url).toBeNull();
  });

  it("still maps a product when the inventory item was not readable", () => {
    const limited = {
      ...polarExhaust,
      variants: {
        nodes: [
          { ...polarExhaust.variants.nodes[0], inventoryItem: undefined },
        ],
      },
    };

    const row = packageFromGraphql(limited)!;

    expect(row.price).toBe(1083);
    expect(row.variants[0].weight_kg).toBeUndefined();
    expect(row.variants[0].cost).toBeUndefined();
    expect(row.inventory).toBe(-1);
  });

  it("leaves stock empty when the product does not track it, and skips unreadable products", () => {
    expect(
      packageFromGraphql({ ...polarExhaust, tracksInventory: false })
        ?.inventory,
    ).toBeNull();
    expect(packageFromGraphql({ ...polarExhaust, id: null })).toBeNull();
    expect(packageFromGraphql(null)).toBeNull();
  });
});

describe("packageFromProduct details", () => {
  it("takes description, pictures, tags, sale price and weight from the webhook shape", () => {
    const row = packageFromProduct(
      product({
        vendor: "Speed Demon",
        title: "Rock Light Kit",
        body_html: "<p>Bright.</p><ul><li>12 lights</li><li>Remote</li></ul>",
        tags: "lighting, Shipping: Standard, lighting",
        images: [
          { src: "https://cdn.shopify.com/a.jpg", alt: "Front" },
          { src: "http://insecure.example/b.jpg" },
        ],
        variants: [
          {
            id: 1,
            title: "Default Title",
            price: "100.00",
            compare_at_price: "130.00",
            weight: 2500,
            weight_unit: "g",
          },
        ],
      }),
    )!;

    expect(row.description).toBe("Bright.\n\n• 12 lights\n• Remote");
    expect(row.tags).toEqual(["lighting", "Shipping: Standard"]);
    expect(row.images).toEqual([
      { url: "https://cdn.shopify.com/a.jpg", alt: "Front" },
    ]);
    expect(row.variants[0]).toMatchObject({ compare_at: 130, weight_kg: 2.5 });
  });
});

describe("htmlToText", () => {
  it("drops scripts and tags, decodes entities and keeps line breaks", () => {
    expect(
      htmlToText(
        "<p>Fits 2017&ndash;2025 &#39;L5P&#39;&nbsp;trucks<br>Free&amp;fast</p><script>alert(1)</script><style>p{}</style>",
      ),
    ).toBe("Fits 2017–2025 'L5P' trucks\nFree&fast");
  });

  it("is empty for nothing", () => {
    expect(htmlToText(null)).toBe("");
    expect(htmlToText("<p></p>")).toBe("");
  });
});
