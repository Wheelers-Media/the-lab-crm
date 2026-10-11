// Test-only: real answers from the Shopify Admin API (trimmed to the fields the
// catalog sync reads). Not imported by any function, so never deployed.
// Real answers from the Shopify Admin API (trimmed to the fields the sync reads)
export const polarExhaust = {
  id: "gid://shopify/Product/7466040983646",
  title: '2017-2025 Duramax 6.6L - Polar - 4" Exhaust With Muffler',
  handle: "2017-2025-duramax-6-6l-4-polar-exhaust-with-muffler",
  vendor: "Polar Diesel",
  productType: "",
  tags: [
    "duramax",
    "exhaust",
    "exhaust muffler",
    "full exhaust",
    "Shipping: Exhaust",
  ],
  status: "ACTIVE",
  updatedAt: "2026-10-10T22:22:46Z",
  descriptionHtml:
    "<p>Polar Diesel exhaust kits are designed to concur the elements.</p>\n<p><strong>Technical Specifications:</strong></p>\n<ul>\n<li>Standard muffler included</li>\n<li>2017-2025 Chevrolet/GMC Duramax 6.6L L5P</li>\n<li>Depending on Box &amp; Cab configuration, one cut will need to be made.</li>\n</ul>\n<p><em>WARNING: This product is designed and intended strictly for Off-Road and Sanctioned Racing Use Only.</em></p>\n",
  tracksInventory: true,
  featuredMedia: {
    preview: {
      image: { url: "https://cdn.shopify.com/files/muffler.jpg?v=1" },
    },
  },
  media: {
    nodes: [
      {
        image: {
          url: "https://cdn.shopify.com/files/muffler.jpg?v=1",
          altText: "",
        },
      },
      {
        image: {
          url: "https://cdn.shopify.com/files/muffler2.jpg?v=1",
          altText: "Side view",
        },
      },
    ],
  },
  variants: {
    nodes: [
      {
        id: "gid://shopify/ProductVariant/42069908979806",
        title: "Default Title",
        sku: "PD-1-32934141",
        price: "1083.00",
        compareAtPrice: null,
        inventoryQuantity: -1,
        inventoryItem: {
          tracked: true,
          unitCost: null,
          measurement: { weight: { value: 35, unit: "KILOGRAMS" } },
        },
      },
    ],
  },
};

export const archivedBulbs = {
  id: "gid://shopify/Product/7466037805150",
  title: "Universal – H13 LED Replacement Headlight Bulbs 5,000 Lumens",
  handle: "h13-replacement-led-headlight-bulbs-5000-lumens",
  vendor: "Speed Demon",
  productType: "",
  tags: ["Shipping: Standard"],
  status: "ARCHIVED",
  updatedAt: "2026-06-23T22:30:49Z",
  descriptionHtml: "<p>Brighter than stock — crisp, white light.</p>",
  tracksInventory: true,
  featuredMedia: null,
  media: { nodes: [] },
  variants: {
    nodes: [
      {
        id: "gid://shopify/ProductVariant/42069889220702",
        title: "Default Title",
        sku: "10-20100",
        price: "165.99",
        compareAtPrice: "199.99",
        inventoryQuantity: 0,
        inventoryItem: {
          tracked: true,
          unitCost: { amount: "97.95" },
          measurement: { weight: { value: 0, unit: "KILOGRAMS" } },
        },
      },
    ],
  },
};
