// Quote helpers: which catalog parts fit the customer's truck and request,
// and how a quote splits into parts (paid up front) and labour (paid at pickup).
import type { DealPackageLine, Package, Vehicle, WebsiteQuote } from "../types";

export type LineKind = "part" | "labour";

/** Parts are ordered and paid up front; services, installs and custom work are labour. */
export const lineKind = (line: DealPackageLine): LineKind =>
  line.kind ?? (line.variant_id ? "part" : "labour");

const round2 = (n: number) => Math.round(n * 100) / 100;

export const quoteTotals = (lines: DealPackageLine[] | null | undefined) => {
  let parts = 0;
  let labour = 0;
  for (const line of lines ?? []) {
    const amount = (Number(line.price) || 0) * (Number(line.quantity) || 1);
    if (lineKind(line) === "part") parts += amount;
    else labour += amount;
  }
  return {
    parts: round2(parts),
    labour: round2(labour),
    total: round2(parts + labour),
  };
};

/** A catalog item as a quote line, priced at its first variant. */
export const lineFromCatalog = (pkg: Package): DealPackageLine => {
  const variant = pkg.variants[0];
  return {
    package_id: pkg.id,
    title: pkg.title,
    price: variant?.price ?? pkg.price ?? 0,
    quantity: 1,
    variant_id: pkg.kind === "product" && variant ? variant.id : null,
    kind: pkg.kind === "product" ? "part" : "labour",
  };
};

type Platform =
  | "cummins"
  | "duramax"
  | "powerstroke"
  | "ecodiesel"
  | "titan"
  | "sprinter";

const PLATFORM_WORDS: Array<[Platform, RegExp]> = [
  ["sprinter", /sprinter|mercedes/i],
  ["ecodiesel", /eco\s?diesel|grand cherokee|gladiator|ram 1500/i],
  ["titan", /titan/i],
  ["cummins", /cummins|\bram\b|dodge/i],
  ["duramax", /duramax|chev|gmc|silverado|sierra|colorado|canyon/i],
  ["powerstroke", /power\s?stroke|\bford\b|\bf-?\d{3}\b|super duty/i],
];

// Words a product title uses for each platform
const TITLE_WORDS: Record<Platform, RegExp> = {
  cummins: /cummins/i,
  duramax: /duramax/i,
  powerstroke: /power\s?stroke/i,
  ecodiesel: /eco\s?diesel/i,
  titan: /titan/i,
  sprinter: /sprinter/i,
};

// Parts made for one model only; the truck must be that model
const MODEL_WORDS = [
  /grand cherokee/i,
  /gladiator/i,
  /colorado|canyon/i,
  /sprinter/i,
  /cab\s*&\s*chassis/i,
];

/**
 * The diesel engine a truck has, from its model and year when the engine was
 * not written down: a 2019 Colorado is a 2.8L, a 2019 Sierra 2500 a 6.6L.
 */
export const inferEngine = (
  model: string,
  year: number | null,
): string | null => {
  const m = model.toLowerCase();
  if (/colorado|canyon/.test(m)) return "2.8";
  if (/(silverado|sierra)\s*1500|\blm2\b/.test(m)) return "3.0";
  if (
    /(silverado|sierra)\s*(2500|3500)|\bhd\b|kodiak|topkick|express|savana/.test(
      m,
    )
  )
    return "6.6";
  if (/ram\s*1500|grand cherokee|gladiator|eco\s?diesel/.test(m)) return "3.0";
  if (/sprinter/.test(m)) return "3.0";
  if (/titan/.test(m)) return "5.0";
  if (/f-?150/.test(m)) return "3.0";
  if (/f-?(250|350|450|550)|super duty|excursion/.test(m)) {
    if (year == null) return null;
    if (year >= 2011) return "6.7";
    if (year >= 2008) return "6.4";
    if (year >= 2003) return "6.0";
    return null;
  }
  if (/ram\s*(2500|3500|4500|5500)|cummins|dodge/.test(m)) {
    if (year == null || year === 2007) return null; // 5.9L and 6.7L both built in 2007
    return year >= 2008 ? "6.7" : "5.9";
  }
  return null;
};

const SERVICE_WORDS: Array<[string, RegExp, RegExp]> = [
  // [service, words in the request, words in a product title]
  ["egr", /\begr\b/i, /\begr\b/i],
  ["exhaust", /exhaust|straight pipe|muffler/i, /exhaust|delete pipe/i],
  ["ccv", /\bccv\b/i, /\bccv\b/i],
  [
    "tuning",
    /tun(e|ing)|horsepower|power level/i,
    /ez lynk|hp tuners|efi ?live|tuner|tune/i,
  ],
  ["coolant", /coolant/i, /coolant/i],
];

export type QuoteContext = {
  platform: Platform | null;
  year: number | null;
  engine: string | null;
  /** Make and model, to match parts made for one model. */
  model: string;
  services: string[];
  wantsMuffler: boolean;
  diameter: string | null;
};

/** What the customer drives and asked for, from the job, the website answers and the vehicle. */
export const quoteContext = ({
  name,
  quote,
  vehicle,
}: {
  name?: string | null;
  quote?: WebsiteQuote | null;
  vehicle?: Pick<
    Vehicle,
    "year" | "make" | "model" | "engine" | "platform"
  > | null;
}): QuoteContext => {
  const answers = (quote?.choices ?? [])
    .map((c) => `${c.label}: ${c.value}`)
    .join("\n");
  const vehicleText = [vehicle?.make, vehicle?.model, vehicle?.engine]
    .filter(Boolean)
    .join(" ");
  const text = [name, answers, quote?.summary, vehicleText]
    .filter(Boolean)
    .join("\n");

  const fromVehicle =
    vehicle?.platform && vehicle.platform in TITLE_WORDS
      ? (vehicle.platform as Platform)
      : null;
  const platform =
    fromVehicle ??
    PLATFORM_WORDS.find(([, re]) => re.test(vehicleText || text))?.[0] ??
    null;

  const yearMatch = text.match(/\b(19[89]\d|20[0-4]\d)\b/);
  const year = vehicle?.year ?? (yearMatch ? Number(yearMatch[1]) : null);
  const model = [vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
  const written = (vehicle?.engine ?? text).match(/\b(\d\.\d)\s?l\b/i)?.[1];
  const engine =
    written ?? inferEngine(`${model} ${vehicle?.engine ?? ""}`, year);
  // Only what they asked for; "mods already on the truck" also mentions EGR
  const asked = [
    name,
    ...(quote?.choices ?? [])
      .filter((c) => /service|interested|looking for/i.test(c.label))
      .map((c) => c.value),
  ]
    .filter(Boolean)
    .join("\n");
  const services = SERVICE_WORDS.filter(([, words]) => words.test(asked)).map(
    ([service]) => service,
  );
  const diameter = text.match(/full\s(\d)"/i)?.[1] ?? null;
  return {
    platform,
    year,
    engine,
    model,
    services,
    wantsMuffler: /need muffler|with muffler/i.test(text),
    diameter,
  };
};

/** "2017-2025 Duramax ..." -> [2017, 2025]; "2019+ ..." -> [2019, 9999]. */
const yearRange = (title: string): [number, number] | null => {
  const range = title.match(/\b(\d{4})(?:\.\d)?\s*[-–]\s*(\d{4})\b/);
  if (range) return [Number(range[1]), Number(range[2])];
  const open = title.match(/\b(\d{4})\+/);
  return open ? [Number(open[1]), 9999] : null;
};

const titleEngine = (title: string) =>
  title.match(/\b(\d\.\d)\s?l\b/i)?.[1] ?? null;

/**
 * Parts that fit the truck and match what was asked for, best first.
 * A part for another platform, engine, model or model year never shows,
 * and a part made for one engine only shows once the truck's engine is known.
 */
export const suggestProducts = (
  catalog: Package[],
  ctx: QuoteContext,
  limit = 8,
): Package[] => {
  if (!ctx.platform && !ctx.services.length) return [];
  const scored: Array<[number, Package]> = [];
  for (const pkg of catalog) {
    if (pkg.kind !== "product" || pkg.status !== "active") continue;
    const title = pkg.title;
    const platformInTitle = (Object.keys(TITLE_WORDS) as Platform[]).filter(
      (p) => TITLE_WORDS[p].test(title),
    );
    // Parts for a different truck are out; universal parts stay in
    if (
      platformInTitle.length &&
      ctx.platform &&
      !platformInTitle.includes(ctx.platform)
    )
      continue;
    const range = yearRange(title);
    if (range && ctx.year && (ctx.year < range[0] || ctx.year > range[1]))
      continue;
    // A part for one engine needs the truck's engine to be that engine
    const engine = titleEngine(title);
    if (engine && engine !== ctx.engine) continue;
    const modelOnly = MODEL_WORDS.find((re) => re.test(title));
    if (modelOnly && !modelOnly.test(ctx.model)) continue;

    let score = 0;
    if (ctx.platform && platformInTitle.includes(ctx.platform)) score += 3;
    if (range && ctx.year) score += 2;
    if (engine && ctx.engine) score += 1;
    const serviceHits = SERVICE_WORDS.filter(
      ([service, , inTitle]) =>
        ctx.services.includes(service) && inTitle.test(title),
    ).length;
    score += serviceHits * 4;
    if (ctx.services.length && !serviceHits) continue;
    if (ctx.services.includes("exhaust")) {
      if (ctx.diameter && title.includes(`${ctx.diameter}"`)) score += 1;
      if (/muffler/i.test(title) === ctx.wantsMuffler) score += 1;
    }
    if (pkg.inventory != null && pkg.inventory <= 0) score -= 1;
    if (score > 0) scored.push([score, pkg]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title))
    .slice(0, limit)
    .map(([, pkg]) => pkg);
};
