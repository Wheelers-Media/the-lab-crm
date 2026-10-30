import { describe, expect, it } from "vitest";

import { urlBase64ToBytes, VAPID_PUBLIC_KEY } from "./vapid";

describe("urlBase64ToBytes", () => {
  it("turns the public key into the 65 bytes a push service expects", () => {
    const bytes = urlBase64ToBytes(VAPID_PUBLIC_KEY);

    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4); // an uncompressed P-256 point
  });

  it("reads URL-safe characters and missing padding", () => {
    // "subjects?" encodes to "c3ViamVjdHM_" in URL-safe base64
    expect(Array.from(urlBase64ToBytes("c3ViamVjdHM_"))).toEqual(
      Array.from(new TextEncoder().encode("subjects?")),
    );
  });
});
