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
}

/**
 * The pre-filled review text: the customer's first name, the work in plain
 * words, and the shop's Google review link.
 */
export const reviewAsk = ({ firstName, ...subject }: ReviewAskInput): string =>
  `Hi ${firstName?.trim() || "there"}, thanks for choosing THE LAB for ${reviewSubject(subject)}! If you're happy with how it turned out, a quick Google review helps us a lot: ${REVIEW_LINK}\n\nThank you!`;
