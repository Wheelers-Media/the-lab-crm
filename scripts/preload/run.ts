// Shopify preload runner (GitHub Actions, see .github/workflows/shopify-preload.yml).
//
// Reads the decrypted request file (links to Shopify bulk-operation exports),
// downloads the exports, converts them, and loads them into the CRM database
// through the Supabase Management API. Prints counts only: the repository is
// public, so no customer details ever reach the log.
//
//   PRELOAD_REQUEST=request.json SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_ID=... \
//     node scripts/preload/run.ts [--send]
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { buildPayload, parseJsonl } from "./shopifyBulk.ts";

type Request = {
  orders?: string;
  customers?: string;
  checkouts?: string;
  products?: string;
};

const log = (line: string) => process.stdout.write(`${line}\n`);
const send = process.argv.includes("--send");

const requestPath = process.env.PRELOAD_REQUEST;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_ID;
if (!requestPath || !token || !ref) {
  console.error(
    "Set PRELOAD_REQUEST, SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID.",
  );
  process.exit(1);
}

const request = JSON.parse(readFileSync(requestPath, "utf8")) as Request;

const download = async (label: string, url?: string) => {
  if (!url) return [];
  if (!/^https:\/\/storage\.googleapis\.com\//.test(url))
    throw new Error(`${label}: not a Shopify export link`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: download failed (${res.status})`);
  const rows = parseJsonl(await res.text());
  log(`${label}: ${rows.length} export lines`);
  return rows;
};

const sql = async (query: string): Promise<unknown> => {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  // The log is public: drop anything that looks like an email or a phone
  if (!res.ok)
    throw new Error(
      `database ${res.status}: ${text
        .split("\n")[0]
        .slice(0, 300)
        .replace(/\S+@\S+/g, "[email]")
        .replace(/\d[\d\s().-]{6,}\d/g, "[number]")}`,
    );
  return JSON.parse(text);
};

/** Dollar-quoted JSON literal with a tag that cannot occur in the data. */
const literal = (value: unknown): string => {
  const json = JSON.stringify(value);
  let tag = "";
  do tag = `$p${randomBytes(6).toString("hex")}$`;
  while (json.includes(tag));
  return `${tag}${json}${tag}::jsonb`;
};

const chunks = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

const sum = (results: Array<Record<string, number>>) =>
  results.reduce<Record<string, number>>((acc, r) => {
    for (const [k, v] of Object.entries(r)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});

const load = async (fn: string, rows: unknown[], size: number) => {
  const results: Array<Record<string, number>> = [];
  for (const batch of chunks(rows, size)) {
    const out = (await sql(
      `select lab_preload.${fn}(${literal(batch)}) as result`,
    )) as Array<{ result: Record<string, number> }>;
    results.push(out[0].result);
  }
  return sum(results);
};

const main = async () => {
  const payload = buildPayload({
    orders: await download("orders", request.orders),
    customers: await download("customers", request.customers),
    checkouts: await download("carts", request.checkouts),
    products: await download("products", request.products),
  });
  const revenue = payload.orders
    .filter((o) => !o.cancelledAt)
    .reduce((s, o) => s + Math.max(0, o.total - o.refundedAmount), 0);
  log(
    `ready: ${payload.packages.length} packages, ${payload.customers.length} customers, ${payload.orders.length} orders ($${revenue.toFixed(2)} net), ${payload.checkouts.length} open carts`,
  );
  for (const [reason, count] of Object.entries(payload.skipped))
    log(`  skipped ${count}: ${reason}`);
  if (!send) {
    log("Dry run. Nothing was written.");
    return;
  }

  await sql(readFileSync(new URL("./preload.sql", import.meta.url), "utf8"));
  try {
    log(
      `packages: ${JSON.stringify(await load("load_packages", payload.packages, 100))}`,
    );
    // Customers first so orders attach to the richer customer records
    log(
      `customers: ${JSON.stringify(await load("load_customers", payload.customers, 100))}`,
    );
    log(
      `orders: ${JSON.stringify(await load("load_orders", payload.orders, 50))}`,
    );
    log(
      `carts: ${JSON.stringify(await load("load_checkouts", payload.checkouts, 50))}`,
    );
  } finally {
    await sql("drop schema if exists lab_preload cascade");
  }
  const totals = (await sql(
    "select (select count(*) from public.packages where status <> 'deleted') as packages, (select count(*) from public.contacts) as customers, (select count(*) from public.orders) as orders, (select count(*) from public.shopify_checkouts where completed_at is null) as open_carts",
  )) as Array<Record<string, number>>;
  log(`CRM now has: ${JSON.stringify(totals[0])}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Preload failed");
  process.exit(1);
});
