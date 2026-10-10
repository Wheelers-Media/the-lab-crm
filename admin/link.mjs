// One-off: makes a password reset link for sales user 1 (the owner) without
// sending email (Supabase's built-in mailer is rate-limited). The link is
// encrypted for the requester's public key before it is committed; nothing
// secret is printed. Repository is public.
import { createCipheriv, publicEncrypt, randomBytes, constants } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_ID;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const mgmt = async (path, init = {}) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}`);
  return res.json();
};

const keys = await mgmt("/api-keys?reveal=true");
const pick =
  keys.find((k) => k.name === "service_role" && k.api_key) ??
  keys.find((k) => k.type === "secret" && k.api_key);
if (!pick) throw new Error("no server key found");
const serviceKey = pick.api_key;

const [{ email }] = await mgmt("/database/query", {
  method: "POST",
  body: JSON.stringify({ query: "select u.email from public.sales s join auth.users u on u.id = s.user_id where s.id = 1" }),
});

const res = await fetch(`https://${ref}.supabase.co/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "recovery", email, redirect_to: "https://the-lab-crm.vercel.app/auth-callback.html" }),
});
const body = await res.json();
if (!res.ok) throw new Error(`generate_link ${res.status} ${String(body.msg ?? body.error_code ?? "").slice(0, 80)}`);
const link = body.action_link ?? body.properties?.action_link;
if (!link) throw new Error("no link in response");

const aesKey = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
const data = Buffer.concat([cipher.update(link, "utf8"), cipher.final()]);
const wrapped = publicEncrypt(
  { key: readFileSync("admin/link_public.pem"), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
  aesKey,
);
writeFileSync("admin/link.enc", JSON.stringify({
  key: wrapped.toString("base64"), iv: iv.toString("base64"),
  tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64"),
}));
console.log("link made and encrypted");
