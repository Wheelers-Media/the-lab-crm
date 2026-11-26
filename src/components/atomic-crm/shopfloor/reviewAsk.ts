// The text that asks a happy customer for a Google review. It is worded from
// the kind of work they actually had done (a detail, a tint, a parts order, a
// tune), never from the package name, so the same text fits every customer and
// nobody who bought an interior detail is told they had a De-luxx Signature.
import { lineKinds, type ServiceKind } from "../operations/serviceKinds";

/** Opens the Google review form for THE LAB (the shop's Google listing). */
export const REVIEW_LINK = "https://g.page/r/CdFTDo4OpyDzEAE/review";

/** Plain words for each kind of work, so a text reads like a person wrote it. */
const KIND_WORD: Record<ServiceKind, string> = {
  detail: "detail",
  tint: "window tint",
  parts: "parts order",
  tune: "tune",
  lighting: "lighting install",
  membership: "monthly membership",
};

export interface ReviewSubjectInput {
  /** Names to read the work from, best first: the order's lines, then the job. */
  names?: Array<string | null | undefined>;
  /** "2022 Ram 3500", when the work was on a vehicle. */
  vehicle?: string | null;
}

/** The kind of work the names point at; the first name that says anything wins. */
export const reviewKind = (
  names: ReviewSubjectInput["names"],
): ServiceKind | null => {
  for (const name of names ?? []) {
    const [kind] = name ? lineKinds(name) : [];
    if (kind) return kind;
  }
  return null;
};

/**
 * What the text calls the work: "your detail", "your parts order", or, when
 * there is a vehicle, "the window tint on your 2022 Ram 3500". Work the names
 * do not explain falls back to the vehicle, then to the visit itself.
 */
export const reviewSubject = ({
  names,
  vehicle,
}: ReviewSubjectInput): string => {
  const kind = reviewKind(names);
  const car = vehicle?.trim();
  if (!kind) return car ? `the work on your ${car}` : "your recent visit";
  if (kind === "membership") return "your monthly membership";
  if (kind === "parts") {
    return car ? `the parts order for your ${car}` : "your parts order";
  }
  return car
    ? `the ${KIND_WORD[kind]} on your ${car}`
    : `your ${KIND_WORD[kind]}`;
};

export interface ReviewAskInput extends ReviewSubjectInput {
  firstName?: string | null;
  /** Picks between wordings so two customers do not get the same text; e.g. the order number. */
  seed?: string | number | null;
}

const PLATFORM_WORD: Array<[RegExp, string]> = [
  [/cummins|\bram\b/i, "Cummins"],
  [/duramax|l5p|chevy|chevrolet|gmc|silverado|sierra/i, "Duramax"],
  [/power ?stroke|\bford\b|f-?[23579]50/i, "Powerstroke"],
];

/** "Cummins", "Duramax" or "Powerstroke" when the order or the truck says so. */
export const dieselPlatform = ({
  names,
  vehicle,
}: ReviewSubjectInput): string | null => {
  const text = [...(names ?? []), vehicle].filter(Boolean).join(" ");
  return PLATFORM_WORD.find(([re]) => re.test(text))?.[1] ?? null;
};

const hashOf = (seed: string): number =>
  [...seed].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);

const pick = <T>(options: T[], seed: string): T =>
  options[hashOf(seed) % options.length];

const ASK = (link: string) =>
  `It means a lot to a family shop like ours: ${link}`;

/**
 * The pre-filled review text, in Eric's voice: plain, grateful and
 * shop-floor. It talks about the work that was really done (a tune, an
 * exhaust, a tint), names the truck's engine when it is a diesel, and
 * rotates wordings by seed so repeat customers are not sent the same text.
 * It never mentions deletes, and nothing is sent until a person taps send.
 */
export const reviewAsk = ({
  firstName,
  seed,
  ...subject
}: ReviewAskInput): string => {
  const name = firstName?.trim() || "there";
  const kind = reviewKind(subject.names);
  const car = subject.vehicle?.trim();
  const ride = car ? `the ${car}` : "your ride";
  const platform = dieselPlatform(subject);
  const salt = `${seed ?? ""}${name}${kind ?? ""}`;
  const joined = (subject.names ?? []).filter(Boolean).join(" ");
  const ask = ASK(REVIEW_LINK);
  const hi = `Hey ${name}, it's Eric at THE LAB.`;

  let body: string;
  if (kind === "tune") {
    const engine = platform ? `the ${platform}` : "the truck";
    body = pick(
      [
        `Hope ${engine} is pulling the way we built it to. If you're happy with the tune, a quick Google review helps us more than you'd think. ${ask}`,
        `How's the tune feeling out on the road? If ${engine} is running the way you wanted, would you leave us a quick Google review? ${ask}`,
      ],
      salt,
    );
  } else if (kind === "parts") {
    const exhaust = /exhaust|downpipe|muffler/i.test(joined);
    const engine = platform ? `the ${platform}` : "the truck";
    body = pick(
      exhaust
        ? [
            `How does ${engine} sound and feel with the new exhaust? If you're stoked with it, a quick Google review means a lot to us. ${ask}`,
            `Hope the new exhaust has ${engine} sounding right. If we looked after you, a quick Google review goes a long way. ${ask}`,
          ]
        : [
            `Hope the new parts have ${engine} running just how you wanted. If we looked after you, a quick Google review goes a long way. ${ask}`,
            `Thanks for trusting us with ${engine}. If everything's running the way it should, would you leave us a quick Google review? ${ask}`,
          ],
      salt,
    );
  } else if (kind === "detail") {
    body = pick(
      [
        `Hope ${ride} is still looking sharp. If you're happy with the detail, a quick Google review helps a lot. ${ask}`,
        `Christine and I hope you're loving how ${ride} turned out. If you are, a quick Google review would mean the world. ${ask}`,
      ],
      salt,
    );
  } else if (kind === "tint") {
    body = `Hope you're liking the tint on ${ride}. If it turned out the way you wanted, a quick Google review helps us a lot. ${ask}`;
  } else if (kind === "lighting") {
    body = `How's the new lighting on ${ride}? If you're happy with it, a quick Google review goes a long way. ${ask}`;
  } else if (kind === "membership") {
    body = `Thanks for being part of the monthly membership. If you're happy with how we look after ${ride}, a quick Google review helps a lot. ${ask}`;
  } else {
    body = `Thanks for trusting us with ${ride}. If you're happy with the work, a quick Google review helps a lot. ${ask}`;
  }
  return `${hi} ${body}\n\nAppreciate you. Eric`;
};
