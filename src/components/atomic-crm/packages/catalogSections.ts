// The shop's catalog sorted the way the website and the shop talk about it:
// tuning, EGR, exhaust, CCV, bumpers and accessories, merch, then the
// Boutique's tint, detailing and lighting. Used by the Products tab and the
// quote builder so both show every part of the store under the same names.
import type { Package } from "../types";

export type SectionId =
  | "tuning"
  | "egr"
  | "exhaust"
  | "ccv"
  | "accessories"
  | "merch"
  | "tint"
  | "detailing"
  | "lighting"
  | "sxs"
  | "membership"
  | "labour"
  | "other";

export interface Section {
  id: SectionId;
  label: string;
  group: "Performance Shop" | "Boutique" | "Everything else";
  /** One line: what is in it, for someone who has never opened the store. */
  hint: string;
}

/** In the order the website lists them. */
export const SECTIONS: Section[] = [
  {
    id: "tuning",
    label: "Tuning",
    group: "Performance Shop",
    hint: "HP Tuners, EZ LYNK and custom tunes",
  },
  {
    id: "egr",
    label: "EGR solutions",
    group: "Performance Shop",
    hint: "EGR kits, coolers and plates",
  },
  {
    id: "exhaust",
    label: "Exhaust systems",
    group: "Performance Shop",
    hint: "Downpipes, pipes, mufflers and tips",
  },
  {
    id: "ccv",
    label: "CCV solutions",
    group: "Performance Shop",
    hint: "Crankcase ventilation reroutes",
  },
  {
    id: "accessories",
    label: "Bumpers and accessories",
    group: "Performance Shop",
    hint: "Gridiron bumpers, steel and armor",
  },
  {
    id: "merch",
    label: "THE LAB merch",
    group: "Performance Shop",
    hint: "Apparel and essentials",
  },
  {
    id: "tint",
    label: "Window tint",
    group: "Boutique",
    hint: "Ceramic tint by the window or whole vehicle",
  },
  {
    id: "detailing",
    label: "Detailing",
    group: "Boutique",
    hint: "Interior, exterior and Signature details",
  },
  {
    id: "lighting",
    label: "Custom lighting",
    group: "Boutique",
    hint: "LED headlights and light bars",
  },
  {
    id: "sxs",
    label: "SxS services",
    group: "Boutique",
    hint: "Side-by-side tint and detailing",
  },
  {
    id: "membership",
    label: "Memberships",
    group: "Boutique",
    hint: "The Monthly Signature",
  },
  {
    id: "labour",
    label: "Labour and install",
    group: "Everything else",
    hint: "Shop rate, installs and small jobs",
  },
  {
    id: "other",
    label: "Other",
    group: "Everything else",
    hint: "Anything that fits nowhere else",
  },
];

export const sectionLabel = (id: SectionId): string =>
  SECTIONS.find((s) => s.id === id)?.label ?? "Other";

// What Shopify's own product type or tags say, which beats guessing from the title
const NAMED: Array<[RegExp, SectionId]> = [
  [/^merch/i, "merch"],
  [/^ccv/i, "ccv"],
  [/^egr/i, "egr"],
  [/^exhaust/i, "exhaust"],
  [/^tun(e|ing)/i, "tuning"],
  [/^(accessor|bumper)/i, "accessories"],
];

// Words in the title, most specific first
const TITLE_RULES: Array<[RegExp, SectionId]> = [
  [/t-shirt|hoodie|\bhat\b|toque|beanie|sticker|apparel|merch/i, "merch"],
  [/membership|monthly signature|syndicate/i, "membership"],
  [/\bsxs\b|side[- ]by[- ]side|\butv\b/i, "sxs"],
  [/\btint/i, "tint"],
  [/detail|signature|de-luxx|ozone|headlight restoration/i, "detailing"],
  [/gridiron|bumper|winch|armor|armour/i, "accessories"],
  [/ez ?lynk|hp ?tuners|efi ?live|\btun(e|ing|er)\b|\bsotf\b/i, "tuning"],
  [/\bccv\b|crankcase|venturi/i, "ccv"],
  [/\begr\b/i, "egr"],
  [/exhaust|downpipe|muffler|\bdpf\b|delete pipe|\btip\b|elbow/i, "exhaust"],
  [/light|\bled\b|lamp/i, "lighting"],
  [/shop rate|labou?r|tire rotation|emblem|install/i, "labour"],
];

const CATEGORY_SECTION: Record<string, SectionId> = {
  tuning: "tuning",
  "window-tint": "tint",
  detailing: "detailing",
  lighting: "lighting",
  gridiron: "accessories",
  membership: "membership",
  "sxs-tint": "sxs",
  install: "labour",
};

/** The store section a package or product belongs under. */
export const sectionOf = (
  pkg: Pick<Package, "title" | "category" | "product_type" | "tags" | "vendor">,
): SectionId => {
  for (const hint of [pkg.product_type, ...(pkg.tags ?? [])]) {
    const named = hint?.trim() && NAMED.find(([re]) => re.test(hint.trim()));
    if (named) return named[1];
  }
  const title = pkg.title ?? "";
  const byTitle = TITLE_RULES.find(([re]) => re.test(title));
  if (byTitle) return byTitle[1];
  if (/gridiron/i.test(pkg.vendor ?? "")) return "accessories";
  return (pkg.category && CATEGORY_SECTION[pkg.category]) || "other";
};

export type SectionCounts = Record<SectionId, number>;

const emptyCounts = (): SectionCounts =>
  Object.fromEntries(SECTIONS.map((s) => [s.id, 0])) as SectionCounts;

/** How many items each section holds. */
export const sectionCounts = (
  catalog: Array<Parameters<typeof sectionOf>[0]>,
): SectionCounts => {
  const counts = emptyCounts();
  for (const pkg of catalog) counts[sectionOf(pkg)] += 1;
  return counts;
};

/** What shows in a catalog browser: not deleted, and optionally in one section. */
export const inSection = <
  T extends Parameters<typeof sectionOf>[0] & Pick<Package, "status">,
>(
  catalog: T[],
  section: SectionId | null,
): T[] =>
  catalog.filter(
    (pkg) =>
      pkg.status !== "deleted" && (!section || sectionOf(pkg) === section),
  );

/** Every word must appear in the name, vendor, type, tags or a SKU. */
export const matchesCatalogQuery = (
  pkg: Pick<Package, "title" | "vendor" | "product_type" | "tags" | "variants">,
  query: string,
): boolean => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [
    pkg.title,
    pkg.vendor,
    pkg.product_type,
    ...(pkg.tags ?? []),
    ...(pkg.variants ?? []).map((v) => `${v.title} ${v.sku ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
};
