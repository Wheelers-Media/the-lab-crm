// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCalSignature, verifyShopifySignature } from "./signatures";

const body = JSON.stringify({ id: 1, total_price: "50.00" });
const secret = "test-secret";

describe("verifyShopifySignature", () => {
  it("accepts the base64 HMAC Shopify sends and rejects anything else", async () => {
    const good = createHmac("sha256", secret).update(body).digest("base64");
    expect(await verifyShopifySignature(body, good, secret)).toBe(true);
    expect(await verifyShopifySignature(body + " ", good, secret)).toBe(false);
    expect(await verifyShopifySignature(body, good, "other-secret")).toBe(
      false,
    );
    expect(await verifyShopifySignature(body, null, secret)).toBe(false);
  });

  it("rejects every request when the secret is not configured", async () => {
    const good = createHmac("sha256", secret).update(body).digest("base64");
    expect(await verifyShopifySignature(body, good, undefined)).toBe(false);
  });
});

describe("verifyCalSignature", () => {
  it("accepts the hex HMAC Cal.com sends and rejects anything else", async () => {
    const good = createHmac("sha256", secret).update(body).digest("hex");
    expect(await verifyCalSignature(body, good, secret)).toBe(true);
    expect(await verifyCalSignature(body, good.toUpperCase(), secret)).toBe(
      true,
    );
    expect(await verifyCalSignature(body, good.slice(1) + "0", secret)).toBe(
      false,
    );
  });
});
