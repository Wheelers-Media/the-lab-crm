// Webhook signature checks (HMAC-SHA256 via WebCrypto, available in Deno and Node 20+).

const encoder = new TextEncoder();

const hmacSha256 = async (
  secret: string,
  body: string,
): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(body)),
  );
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

/** Constant-time comparison of two strings. */
export const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** Shopify: X-Shopify-Hmac-Sha256 is the base64 HMAC-SHA256 of the raw body. */
export const verifyShopifySignature = async (
  rawBody: string,
  header: string | null,
  secret: string | undefined,
): Promise<boolean> => {
  if (!header || !secret) return false;
  return safeEqual(toBase64(await hmacSha256(secret, rawBody)), header.trim());
};

/** Cal.com: x-cal-signature-256 is the hex HMAC-SHA256 of the raw body. */
export const verifyCalSignature = async (
  rawBody: string,
  header: string | null,
  secret: string | undefined,
): Promise<boolean> => {
  if (!header || !secret) return false;
  return safeEqual(
    toHex(await hmacSha256(secret, rawBody)),
    header.trim().toLowerCase(),
  );
};

/** Short, non-reversible fingerprint of a client address for rate limiting. */
export const hashClient = async (
  value: string,
  salt: string,
): Promise<string> =>
  toHex(await hmacSha256(salt || "the-lab", value)).slice(0, 32);
