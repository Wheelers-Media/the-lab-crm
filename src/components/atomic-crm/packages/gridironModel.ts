// Gridiron bumpers on a quote: what the customer asked for on the website
// form, and which of the store's Gridiron listings fit their truck. Gridiron
// titles in Shopify are inconsistent ("2019 Ram 2500 - GRIDIRON - + /3500
// Full Tube Front Bumper", "GRIDIRON 2017-2022 Ford F250-F550 Base Front
// Bumper"), so fitment is read from the year, make, model numbers and model
// names in the title. Anything Gridiron sells can be ordered: when the store
// has no listing for the truck, the quote says so instead of guessing.
import type { Package, WebsiteQuote } from "../types";
import type { QuoteContext } from "./quoteModel";

export type BumperStyle = "base" | "prerunner" | "full tube";
export type BumperFinish = "black" | "custom colour" | "bed liner";

export interface BumperRequest {
  position: "front" | "rear" | null;
  style: BumperStyle | null;
  isWinch: boolean;
  finish: BumperFinish | null;
  /** What they wrote, for the notice: "Front bumper: Full Tube, Custom colour". */
  summary: string;
}

const BUMPER_FIELD = /gridiron|bumper/i;
const FINISH_FIELD = /finish|colou?r|coat/i;
const NO_BUMPER = /^\s*(no|none|n\/a|not sure|no bumper)\b/i;

const styleIn = (text: string): BumperStyle | null =>
  /full[\s-]*tube/i.test(text)
    ? "full tube"
    : /pre[\s-]*runner/i.test(text)
      ? "prerunner"
      : /\bbase\b/i.test(text)
        ? "base"
        : null;

const finishIn = (text: string): BumperFinish | null =>
  /bed\s*liner/i.test(text)
    ? "bed liner"
    : /custom|colou?r match/i.test(text)
      ? "custom colour"
      : /black/i.test(text)
        ? "black"
        : null;

/**
 * The bumper the customer asked for, from the website answers, or null when
 * the job is not about a Gridiron bumper. A job filed under Gridiron, or named
 * for bumpers, counts even when the form left the details out.
 */
export const bumperRequest = ({
  name,
  category,
  quote,
}: {
  name?: string | null;
  category?: string | null;
  quote?: Pick<WebsiteQuote, "choices"> | null;
}): BumperRequest | null => {
  const choices = quote?.choices ?? [];
  const asked = choices.filter(
    (c) =>
      BUMPER_FIELD.test(c.label) &&
      !FINISH_FIELD.test(c.label) &&
      c.value?.trim() &&
      !NO_BUMPER.test(c.value),
  );
  const finishText = choices
    .filter((c) => /finish/i.test(c.label))
    .map((c) => c.value)
    .join(" ");
  const isGridironJob =
    category === "gridiron" || /bumper|gridiron/i.test(name ?? "");
  if (!asked.length && !isGridironJob) return null;

  const text = asked.map((c) => c.value).join(" ");
  const finish = finishIn(finishText);
  const summary = [
    ...asked.map((c) => c.value.trim()),
    ...(finishText.trim() ? [finishText.trim()] : []),
  ].join(", ");
  return {
    position: /\brear\b/i.test(text)
      ? "rear"
      : /\bfront\b/i.test(text)
        ? "front"
        : null,
    style: styleIn(text),
    isWinch: /winch/i.test(text),
    finish,
    summary,
  };
};

// ---- Fitment ---------------------------------------------------------------

const MAKES: Array<[string, RegExp]> = [
  ["ford", /\bford\b/i],
  ["ram", /\bram\b|\bdodge\b/i],
  ["chevrolet", /\bchevrolet\b|\bchevy\b/i],
  ["gmc", /\bgmc\b/i],
  ["jeep", /\bjeep\b/i],
  ["toyota", /\btoyota\b/i],
  ["hummer", /\bhummer\b/i],
];

// The diesel platform tells the make when the vehicle record does not
const PLATFORM_MAKES: Partial<Record<string, string[]>> = {
  powerstroke: ["ford"],
  cummins: ["ram"],
  duramax: ["chevrolet", "gmc"],
};

// Listings made for one model only; the truck must be that model
const MODEL_ONLY = [
  /power wagon/i,
  /interceptor|expedition/i,
  /wagoneer/i,
  /tacoma/i,
  /tundra/i,
  /wrangler/i,
  /suburban/i,
  /avalanche/i,
];

const YEAR = "(19[89]\\d|20[0-4]\\d)(?:\\.5)?";
const YEAR_RANGE = new RegExp(`${YEAR}\\s*[-–]\\s*${YEAR}`);
const SINGLE_YEAR = new RegExp(YEAR);

/** [from, to] from the title: "2017-2022" -> both; "2019 ... +" -> open-ended. */
export const titleYears = (title: string): [number, number] | null => {
  const range = title.match(YEAR_RANGE);
  if (range) return [Number(range[1]), Number(range[2])];
  const single = title.match(SINGLE_YEAR);
  if (!single) return null;
  const year = Number(single[1]);
  return /\+/.test(title) ? [year, 9999] : [year, year];
};

/** Ford "F250-F550" -> [250, 550]; Ram/GM "2500/3500/4500" -> [2500, 4500]. */
const modelNumbers = (text: string): number[] => {
  const ford = [...text.matchAll(/\bF-?(\d{3})\b/gi)].map((m) => Number(m[1]));
  if (ford.length) return ford;
  return [...text.matchAll(/\b([1-5]500)\b/g)].map((m) => Number(m[1]));
};

const truckMakes = (
  ctx: Pick<QuoteContext, "model" | "platform">,
): string[] => {
  const fromModel = MAKES.filter(([, re]) => re.test(ctx.model)).map(
    ([make]) => make,
  );
  if (fromModel.length) return fromModel;
  return (ctx.platform && PLATFORM_MAKES[ctx.platform]) || [];
};

/**
 * Whether a Gridiron listing fits the truck. A listing with no year (D-rings,
 * light covers, merchandise) is not tied to a truck and never "fits" here.
 */
export const gridironFits = (
  title: string,
  ctx: Pick<QuoteContext, "model" | "platform" | "year">,
): boolean => {
  const years = titleYears(title);
  if (!years || ctx.year == null) return false;
  if (ctx.year < years[0] || ctx.year > years[1]) return false;

  const listed = MAKES.filter(([, re]) => re.test(title)).map(([m]) => m);
  const makes = truckMakes(ctx);
  if (
    !makes.length ||
    (listed.length && !listed.some((m) => makes.includes(m)))
  )
    return false;

  const only = MODEL_ONLY.find((re) => re.test(title));
  if (only && !only.test(ctx.model)) return false;

  const range = modelNumbers(title);
  const truck = modelNumbers(ctx.model)[0];
  if (range.length && truck != null) {
    const lo = Math.min(...range);
    const hi = Math.max(...range);
    if (truck < lo || truck > hi) return false;
  }
  return true;
};

// ---- Matching the request ---------------------------------------------------

const MERCH = /beanie|hat\b|snapback|shirt|hoodie|sticker|decal/i;

export const isGridiron = (
  pkg: Pick<Package, "category" | "vendor" | "title">,
) =>
  pkg.category === "gridiron" ||
  /gridiron/i.test(pkg.vendor ?? "") ||
  /gridiron/i.test(pkg.title);

const positionOf = (title: string): "front" | "rear" | null =>
  /rear bumper/i.test(title)
    ? "rear"
    : /front bumper/i.test(title)
      ? "front"
      : null;

const matchesRequest = (title: string, req: BumperRequest): boolean =>
  (req.position == null || positionOf(title) === req.position) &&
  (req.style == null || styleIn(title) === req.style) &&
  /winch/i.test(title) === req.isWinch;

const score = (title: string, req: BumperRequest | null): number => {
  if (!req) return positionOf(title) ? 1 : 0;
  let s = 0;
  if (req.position && positionOf(title) === req.position) s += 8;
  if (req.style && styleIn(title) === req.style) s += 4;
  if (/winch/i.test(title) === req.isWinch) s += 2;
  if (positionOf(title)) s += 1;
  return s;
};

export interface GridironMatch {
  /** Gridiron listings for sale that fit the truck, the asked-for one first. */
  fits: Package[];
  /** The listing that is exactly what they asked for, when the store has it. */
  exact: Package | null;
}

export const gridironForTruck = (
  catalog: Package[],
  ctx: Pick<QuoteContext, "model" | "platform" | "year">,
  req: BumperRequest | null,
): GridironMatch => {
  const fits = catalog
    .filter(
      (p) =>
        p.status === "active" &&
        isGridiron(p) &&
        !MERCH.test(p.title) &&
        gridironFits(p.title, ctx),
    )
    .sort(
      (a, b) =>
        score(b.title, req) - score(a.title, req) ||
        a.title.localeCompare(b.title),
    );
  const exact =
    req && req.position && req.style
      ? (fits.find((p) => matchesRequest(p.title, req)) ?? null)
      : null;
  return { fits, exact };
};

/** The variant that matches the finish they asked for, else the first. */
export const finishVariant = (
  pkg: Pick<Package, "variants">,
  finish: BumperFinish | null,
): string => {
  const pick = (re: RegExp) => pkg.variants.find((v) => re.test(v.title))?.id;
  const id =
    finish === "custom colour"
      ? (pick(/custom colou?r powder/i) ?? pick(/custom/i))
      : finish === "bed liner"
        ? pick(/bed\s*liner/i)
        : finish === "black"
          ? pick(/black/i)
          : undefined;
  return id ?? pkg.variants[0]?.id ?? "";
};

/** "Full Tube front bumper", "front bumper", "Gridiron bumper". */
export const bumperName = (req: BumperRequest): string => {
  const style =
    req.style === "full tube"
      ? "Full Tube"
      : req.style === "prerunner"
        ? "Prerunner"
        : req.style === "base"
          ? "Base"
          : "";
  const parts = [style, req.isWinch ? "winch" : "", req.position ?? ""]
    .filter(Boolean)
    .join(" ");
  return parts ? `${parts} bumper` : "Gridiron bumper";
};
