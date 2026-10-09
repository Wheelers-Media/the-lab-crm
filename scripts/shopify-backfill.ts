// One-time history import: loads past Shopify orders into the CRM.
//
//   1. Shopify admin > Orders > Export > "All orders" > "Plain CSV file"
//   2. SHOPIFY_WEBHOOK_SECRET=... CRM_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1 \
//        node scripts/shopify-backfill.ts orders_export.csv            (dry run)
//      ...the same command with --send to import for real
//
// Each order is signed with the webhook secret and sent to shopify_webhook as
// "history/order": the customer and order are recorded, nothing else happens
// (no deal moves, no tasks). Safe to re-run: orders already sent are skipped.
// Keep the CSV out of git: it holds customer names, emails and phone numbers.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import Papa from "papaparse";

import { ordersFromCsv } from "../supabase/functions/_shared/lab/shopifyCsv.ts";
import type { CsvRow } from "../supabase/functions/_shared/lab/shopifyCsv.ts";

const TOPIC = "history/order";

// Progress goes to stdout; problems use console.error
const log = (line: string) => process.stdout.write(`${line}\n`);
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const send = args.includes("--send");

if (!file) {
  console.error(
    "Usage: node scripts/shopify-backfill.ts <orders_export.csv> [--send]",
  );
  process.exit(1);
}

const csv = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const parsed = Papa.parse<CsvRow>(csv, { header: true, skipEmptyLines: true });
if (parsed.errors.length) {
  console.error("CSV problems:", parsed.errors.slice(0, 5));
  process.exit(1);
}
if (!parsed.meta.fields?.includes("Lineitem name")) {
  console.error(
    'This does not look like a Shopify order export (no "Lineitem name" column).',
  );
  process.exit(1);
}

const { orders, skipped } = ordersFromCsv(parsed.data);
const total = orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
log(
  `${orders.length} paid orders ($${total.toFixed(2)}), ${skipped.length} skipped.`,
);
const reasons = new Map<string, number>();
for (const s of skipped)
  reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1);
for (const [reason, count] of reasons) log(`  skipped ${count}: ${reason}`);

if (!send) {
  log("Dry run. Add --send to import.");
  process.exit(0);
}

const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
const base = process.env.CRM_FUNCTIONS_URL?.replace(/\/+$/, "");
if (!secret || !base?.startsWith("https://")) {
  console.error(
    "Set SHOPIFY_WEBHOOK_SECRET and CRM_FUNCTIONS_URL (https://<ref>.supabase.co/functions/v1).",
  );
  process.exit(1);
}
const endpoint = `${base}/shopify_webhook`;

const counts = { imported: 0, duplicate: 0, failed: 0 };
const failures: string[] = [];

const sendOne = async (order: (typeof orders)[number]) => {
  const body = JSON.stringify(order);
  const hmac = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-shopify-topic": TOPIC,
      "x-shopify-hmac-sha256": hmac,
      // Same id on every run, so a re-run skips orders already imported
      "x-shopify-webhook-id": `history-${order.id}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    counts.failed++;
    failures.push(`${order.name}: HTTP ${res.status} ${text.slice(0, 200)}`);
    return;
  }
  if (text.includes('"duplicate":true')) counts.duplicate++;
  else counts.imported++;
};

let next = 0;
const worker = async () => {
  while (next < orders.length) {
    const order = orders[next++];
    try {
      await sendOne(order);
    } catch (error) {
      counts.failed++;
      failures.push(`${order.name}: ${(error as Error).message}`);
    }
    const done = counts.imported + counts.duplicate + counts.failed;
    if (done % 50 === 0) log(`  ${done}/${orders.length}`);
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

log(
  `Done: ${counts.imported} imported, ${counts.duplicate} already there, ${counts.failed} failed.`,
);
if (failures.length) {
  log("Failures:");
  for (const f of failures.slice(0, 20)) log(`  ${f}`);
  process.exit(1);
}
