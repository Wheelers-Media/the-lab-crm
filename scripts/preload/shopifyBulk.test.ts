import { describe, expect, it } from "vitest";

import { buildPayload, checkoutToken, parseJsonl } from "./shopifyBulk.ts";

const ORDER = {
  id: "gid://shopify/Order/5001",
  name: "#1752",
  createdAt: "2026-10-08T17:00:00Z",
  cancelledAt: null,
  test: false,
  displayFinancialStatus: "PAID",
  sourceName: "web",
  currencyCode: "CAD",
  note: "Drop off Monday",
  email: null,
  phone: null,
  subtotalPriceSet: { shopMoney: { amount: "260.0" } },
  totalPriceSet: { shopMoney: { amount: "273.0" } },
  totalRefundedSet: { shopMoney: { amount: "0.0" } },
  customer: { id: "gid://shopify/Customer/77" },
  billingAddress: {
    firstName: "jane",
    lastName: "doe",
    company: "Doe Hauling",
    phone: "250-261-9502",
  },
  shippingAddress: null,
};
const LINE = {
  name: "Universal Fit - THE LAB - Ceramic Tint - Front Roll Ups",
  quantity: 1,
  originalUnitPriceSet: { shopMoney: { amount: "260.0" } },
  __parentId: "gid://shopify/Order/5001",
};
const CUSTOMER = {
  id: "gid://shopify/Customer/77",
  firstName: "Jane",
  lastName: "Doe",
  note: "Prefers mornings",
  tags: [],
  createdAt: "2025-01-02T00:00:00Z",
  numberOfOrders: "3",
  defaultEmailAddress: {
    emailAddress: "Jane@Example.com",
    marketingState: "SUBSCRIBED",
  },
  defaultPhoneNumber: {
    phoneNumber: "+12502619502",
    marketingState: "NOT_SUBSCRIBED",
  },
  defaultAddress: {
    company: "Doe Hauling",
    city: "Fort St. John",
    provinceCode: "BC",
    phone: null,
  },
};
const CART = {
  id: "gid://shopify/AbandonedCheckout/9",
  createdAt: "2026-10-07T00:00:00Z",
  updatedAt: "2026-10-07T01:00:00Z",
  completedAt: null,
  abandonedCheckoutUrl:
    "https://thelabfsj.ca/123/checkouts/ac/abcdef0123456789abcd/recover?key=x",
  totalPriceSet: { shopMoney: { amount: "4299.00" } },
  customer: null,
  billingAddress: { firstName: "Sam", lastName: "Ray", phone: "2505550101" },
};

const build = (overrides: Partial<typeof ORDER> = {}) =>
  buildPayload({
    orders: [{ ...ORDER, ...overrides }, LINE],
    customers: [CUSTOMER],
    checkouts: [
      CART,
      {
        title: "Gridiron Prerunner",
        quantity: 1,
        __parentId: CART.id,
      },
    ],
  });

describe("buildPayload", () => {
  it("joins the customer to an order that has no email of its own", () => {
    const { orders } = build();
    expect(orders).toHaveLength(1);
    expect(orders[0].contact).toMatchObject({
      email: "jane@example.com",
      phone: "(250) 261-9502",
      firstName: "Jane",
      lastName: "Doe",
    });
  });

  it("reads order money, lines and categories like the live webhook", () => {
    const [order] = build().orders;
    expect(order).toMatchObject({
      shopifyOrderId: "5001",
      orderNumber: "#1752",
      total: 273,
      subtotal: 260,
      refundedAmount: 0,
      financialStatus: "paid",
      categories: ["Tint"],
      isDeposit: false,
    });
    expect(order.lineItems).toEqual([
      { name: "Ceramic Tint - Front Roll Ups", quantity: 1, price: 260 },
    ]);
    expect(order.noteText).toContain("**Shopify order #1752**");
    expect(order.noteText).toContain("Order note: Drop off Monday");
  });

  it("keeps refunds and skips test and unpaid orders", () => {
    expect(
      build({
        displayFinancialStatus: "PARTIALLY_REFUNDED",
        totalRefundedSet: { shopMoney: { amount: "50.0" } },
      }).orders[0].refundedAmount,
    ).toBe(50);
    expect(build({ test: true }).skipped).toEqual({ "test order": 1 });
    expect(build({ displayFinancialStatus: "PENDING" }).skipped).toEqual({
      "status pending": 1,
    });
  });

  it("maps customer profile and marketing consent", () => {
    const [customer] = build().customers;
    expect(customer).toMatchObject({
      email: "jane@example.com",
      phone: "(250) 261-9502",
      company: "Doe Hauling",
      city: "Fort St. John",
      province: "BC",
      emailMarketing: true,
      smsMarketing: false,
      orderCount: 3,
    });
  });

  it("keeps open carts with their recovery token and lines", () => {
    const [cart] = build().checkouts;
    expect(cart).toMatchObject({
      token: "abcdef0123456789abcd",
      total: 4299,
      customerName: "Sam Ray",
      completedAt: null,
    });
    expect(cart.contact.phone).toBe("(250) 555-0101");
    expect(cart.lineItems[0]).toMatchObject({ name: "Gridiron Prerunner" });
  });
});

describe("catalog", () => {
  const build = () =>
    buildPayload({
      orders: [],
      customers: [],
      checkouts: [],
      products: [
        {
          id: "gid://shopify/Product/1",
          title: "Universal Fit - Suntek - Ceramic Tint - Full Windshield",
          vendor: "The Lab",
          status: "UNLISTED",
          updatedAt: "2026-10-01T00:00:00Z",
          tracksInventory: false,
          featuredMedia: null,
        },
        {
          id: "gid://shopify/ProductVariant/11",
          title: "Default Title",
          price: "300.00",
          sku: "",
          inventoryQuantity: 0,
          __parentId: "gid://shopify/Product/1",
        },
        {
          id: "gid://shopify/Product/2",
          title: "5in Turbo-Back Exhaust",
          vendor: "Polar Diesel",
          handle: "5in-turbo-back",
          productType: "",
          status: "ACTIVE",
          tracksInventory: true,
          featuredMedia: {
            preview: { image: { url: "https://cdn.shopify.com/x.jpg" } },
          },
        },
        {
          id: "gid://shopify/ProductVariant/21",
          title: "Default Title",
          price: "899.00",
          sku: "PD-5TB",
          inventoryQuantity: 2,
          __parentId: "gid://shopify/Product/2",
        },
      ],
    });

  it("turns shop services into packages with Shopify prices", () => {
    expect(build().packages[0]).toMatchObject({
      shopify_product_id: "1",
      title: "Ceramic Tint - Full Windshield",
      category: "window-tint",
      kind: "package",
      price: 300,
      status: "unlisted",
      inventory: null,
      image_url: null,
    });
  });

  it("keeps parts as products with stock and picture", () => {
    const { packages, skipped } = build();
    expect(packages[1]).toMatchObject({
      shopify_product_id: "2",
      kind: "product",
      bay: "parts",
      category: "diesel-parts",
      price: 899,
      inventory: 2,
      handle: "5in-turbo-back",
      image_url: "https://cdn.shopify.com/x.jpg",
    });
    expect(packages[1].variants[0]).toMatchObject({ sku: "PD-5TB" });
    expect(skipped).toEqual({});
  });
});

describe("helpers", () => {
  it("falls back to the GraphQL id when a cart link has no token", () => {
    expect(checkoutToken("", "gid://shopify/AbandonedCheckout/9")).toBe(
      "gid-9",
    );
  });

  it("reads JSON lines and ignores blank lines", () => {
    expect(parseJsonl('{"a":1}\n\n{"b":2}\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
