import {
  type Category,
  categoryFor,
  clean,
  normalizeEmail,
  normalizePhone,
  parseMoney,
  shortName,
  splitName,
} from "../_shared/lab.ts";

export interface Lead {
  intent: "quote" | "book";
  service: string;
  category: Category;
  first: string;
  last: string;
  email: string | null;
  phone: string | null;
  vehicle: string;
  vin: string;
  amount: number | null;
  estimateText: string;
  choices: string[];
  summary: string;
  message: string;
  cameFrom: string;
  smsConsent: boolean;
  dealName: string;
  /** "intake" for a quote request, "qualified" when the customer is already picking a time. */
  stage: "intake" | "qualified";
}

export type ParseResult =
  | { ok: true; lead: Lead }
  | { ok: false; error: string };

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/** Validates the body the website form posts and turns it into a Lead. Never throws. */
export function parseLead(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  const email = normalizeEmail(b.email);
  const phone = normalizePhone(b.phone);
  if (!email && !phone) {
    return { ok: false, error: "An email or a phone number is required" };
  }

  const service = clean(b.service, 200);
  if (!service) return { ok: false, error: "A service is required" };

  const name = clean(b.name, 160);
  const { first, last } = splitName(
    name,
    clean(b.first, 80) || undefined,
    clean(b.last, 80) || undefined,
  );
  if (!first && !last && !email) {
    return { ok: false, error: "A name is required" };
  }

  const intent = b.intent === "book" ? "book" : "quote";
  const category = categoryFor(service);
  const vehicle = clean(b.vehicle, 120);
  const vin = clean(b.vin, 32).toUpperCase();

  const estimate =
    b.estimate && typeof b.estimate === "object"
      ? (b.estimate as Record<string, unknown>)
      : {};
  const estimateTotal = clean(estimate.total, 40);
  const amount = parseMoney(estimateTotal);
  const lines = asArray(estimate.lines)
    .slice(0, 20)
    .map((l) => {
      const line = (l ?? {}) as Record<string, unknown>;
      return `${clean(line.label, 80)}: ${clean(line.price, 40)}`;
    })
    .filter((s) => s !== ": ");
  const estimateText = estimateTotal
    ? [`Starting price ${estimateTotal}`, ...lines].join("\n")
    : "";

  const choices = asArray(b.choices)
    .slice(0, 40)
    .map((c) => {
      const pair = Array.isArray(c) ? c : [];
      return `${clean(pair[0], 80)}: ${clean(pair[1], 300)}`;
    })
    .filter((s) => s !== ": ");

  const who = `${first} ${last}`.trim() || email || phone || "Website lead";
  const dealName = `${shortName(category)} - ${vehicle || who}`.slice(0, 160);

  return {
    ok: true,
    lead: {
      intent,
      service,
      category,
      first,
      last,
      email,
      phone,
      vehicle,
      vin,
      amount,
      estimateText,
      choices,
      summary: clean(b.summary, 600),
      message: clean(b.message, 6000),
      cameFrom: clean(b.cameFrom, 300),
      smsConsent: b.smsConsent === true,
      dealName,
      stage: intent === "book" ? "qualified" : "intake",
    },
  };
}

/** Text for the deal's description: what the customer asked for, in the order Eric reads it. */
export function dealDescription(lead: Lead): string {
  return [
    lead.intent === "book"
      ? "Website booking request: customer is picking a time and paying the $50 deposit."
      : "Website quote request: email the customer a quote.",
    `Service: ${lead.service}`,
    lead.vehicle && `Vehicle: ${lead.vehicle}`,
    lead.vin && `VIN: ${lead.vin}`,
    lead.estimateText,
    lead.choices.length > 0 && `Choices:\n${lead.choices.join("\n")}`,
    lead.summary && `Walkthrough: ${lead.summary}`,
    lead.cameFrom && `Came from: ${lead.cameFrom}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
