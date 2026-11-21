/**
 * The public half of the key that signs CRM alerts. It is not a secret. The
 * private half lives only in the Supabase function secret VAPID_PRIVATE_KEY,
 * and this value must match supabase/functions/_shared/lab/push.ts.
 */
export const VAPID_PUBLIC_KEY =
  "BEcT-_WD593swCVLqZ0a8TQ4xFOb2nLORXDqxEV6bXn-ssWFaP4UiSfouR4sVGdQ0bWS5sLnwz3KsdlA9JswvKc";

/** The browser wants the key as bytes; it is stored as URL-safe base64. */
export const urlBase64ToBytes = (value: string): Uint8Array => {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
