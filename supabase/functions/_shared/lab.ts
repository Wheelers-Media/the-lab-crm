// Pure helpers shared by the THE LAB integrations (website form, Shopify, Cal.com).
// No Deno or network imports here, so Vitest can run them in Node.

/** Keeps digits only. */
export const digits = (value: unknown): string =>
  String(value ?? "").replace(/\D/g, "");

/** Trims, strips control characters (tabs and line breaks stay) and caps the length. */
export function clean(value: unknown, max = 500): string {
  let text = "";
  for (const ch of String(value ?? "")) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl =
      (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
    if (!isControl) text += ch;
  }
  return text.trim().slice(0, max);
}

/** Lower-cased email, or null when it does not look like one. */
export function normalizeEmail(value: unknown): string | null {
  const email = clean(value, 254).toLowerCase();
  return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(email) ? email : null;
}

/** "+1XXXXXXXXXX" for a North American number, "+<digits>" for other lengths, null when unusable. */
export function normalizePhone(value: unknown): string | null {
  const d = digits(value);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length > 10 && d.length <= 15) return `+${d}`;
  return null;
}

/**
 * Every way a North American number is likely to be stored. Contacts keep the number as typed, so a lookup
 * tries each of these as an exact match.
 */
export function phoneFormats(e164: string): string[] {
  const d = digits(e164);
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return [e164];
  const a = n.slice(0, 3);
  const b = n.slice(3, 6);
  const c = n.slice(6);
  return [
    `+1${n}`,
    n,
    `1${n}`,
    `(${a}) ${b}-${c}`,
    `${a}-${b}-${c}`,
    `${a}.${b}.${c}`,
    `${a} ${b} ${c}`,
    `+1 ${a} ${b} ${c}`,
    `+1 (${a}) ${b}-${c}`,
    `+1-${a}-${b}-${c}`,
    `+1 ${a}-${b}-${c}`,
  ];
}

/** Whole dollars from text like "$1,260 CAD" or "from $300". Null when there is no number. */
export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const match = String(value ?? "")
    .replace(/,/g, "")
    .match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1])) : null;
}

export function splitName(
  name: string,
  first?: string,
  last?: string,
): { first: string; last: string } {
  if (first || last) return { first: clean(first, 80), last: clean(last, 80) };
  const parts = clean(name, 160).split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** Deal categories configured in the CRM (defaultDealCategories). */
export type Category =
  | "window-tint"
  | "sxs-tint"
  | "detailing"
  | "lighting"
  | "install"
  | "gridiron"
  | "tuning"
  | "diesel-parts"
  | "gift-certificate"
  | "other";

/** Maps the service label(s) the website form sends to a deal category. */
export function categoryFor(service: string): Category {
  const s = service.toLowerCase();
  if (/gift/.test(s)) return "gift-certificate";
  if (/sxs|side-by-side|utv/.test(s) && /tint/.test(s)) return "sxs-tint";
  if (/tint/.test(s)) return "window-tint";
  if (/detail/.test(s)) return "detailing";
  if (/gridiron/.test(s)) return "gridiron";
  if (/light/.test(s)) return "lighting";
  if (/tuning|tune/.test(s)) return "tuning";
  if (/egr|exhaust|ccv|bumper|lift/.test(s)) return "diesel-parts";
  if (/install|custom/.test(s)) return "install";
  return "other";
}

const SHORT: Record<Category, string> = {
  "window-tint": "Tint",
  "sxs-tint": "SxS tint",
  detailing: "Detailing",
  lighting: "Lighting",
  install: "Install",
  gridiron: "Gridiron",
  tuning: "Tuning",
  "diesel-parts": "Parts",
  "gift-certificate": "Gift certificate",
  other: "Request",
};

export const shortName = (category: Category): string => SHORT[category];

/** Origins allowed to call the website endpoint from a browser. */
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?thelabfsj\.ca$/,
  /^https:\/\/the-lab-[a-z0-9-]+-nathans-projects-e8dc0632\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

export const isAllowedOrigin = (origin: string | null): boolean =>
  !!origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
