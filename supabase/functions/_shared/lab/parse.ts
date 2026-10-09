// Pure helpers for THE LAB connectors: no network or database access, so they
// run unchanged in Deno (edge functions) and Node (vitest).

export type ContactInput = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
};

export const DETAILING_BAY = "detailing-bay";
export const ERIC = "eric";

const MAX = { name: 80, email: 254, phone: 40, text: 8000, short: 200 };

export const clip = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const normalizeEmail = (value: unknown): string => {
  const email = clip(value, MAX.email).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

/** 10 digits (an optional leading 1 is dropped) -> "(250) 261-9502"; anything else -> "" */
export const formatPhone = (value: unknown): string => {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : "";
};

/** Capitalise the first letter of each name part; leave the rest as typed. */
export const capName = (value: unknown): string =>
  clip(value, MAX.name).replace(
    /(^|[\s'-])(\p{L})/gu,
    (_m, a: string, b: string) => a + b.toUpperCase(),
  );

export const splitName = (
  full: string,
): { firstName: string; lastName: string } => {
  const parts = capName(full).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

/** Parses "$1,234.50 CAD" or "1234.5" into whole dollars; 0 when absent. */
export const parseAmount = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

// ---------------------------------------------------------------------------
// Website quote and booking form (thelabfsj.ca intake.js)
// ---------------------------------------------------------------------------

export type WebsiteLead = {
  contact: ContactInput;
  intent: "quote" | "book";
  form: "boutique" | "build";
  service: string;
  category: string;
  vehicle: string;
  vin: string;
  estimateTotal: number;
  estimateText: string;
  details: string;
  smsConsent: boolean;
  page: string;
};

const SERVICE_CATEGORY: Array<[RegExp, string]> = [
  [/detail/i, "detailing"],
  [/sxs|side-by-side|off-road sxs/i, "sxs-tint"],
  [/tint/i, "window-tint"],
  [/light/i, "lighting"],
  [/tuning|egr|ccv/i, "tuning"],
  [/exhaust/i, "diesel-parts"],
  [/bumper|gridiron/i, "gridiron"],
  [/install|lift|accessor|other/i, "install"],
];

export const serviceToCategory = (service: string): string => {
  for (const [pattern, category] of SERVICE_CATEGORY) {
    if (pattern.test(service)) return category;
  }
  return "other";
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const parseWebsiteLead = (body: unknown): ParseResult<WebsiteLead> => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request" };
  }
  const b = body as Record<string, unknown>;
  if (clip(b.website, 10)) return { ok: false, error: "Rejected" }; // honeypot

  const email = normalizeEmail(b.email);
  const phone = formatPhone(b.phone);
  if (!email && !phone)
    return { ok: false, error: "An email or phone number is required" };

  let firstName = capName(b.first);
  let lastName = capName(b.last);
  if (!firstName && !lastName && b.name)
    ({ firstName, lastName } = splitName(String(b.name)));

  const vehicle = [clip(b.year, 4), clip(b.make, 40), clip(b.model, 60)]
    .filter(Boolean)
    .join(" ");
  const service = clip(b.service, MAX.short) || "General request";
  const estimate = (b.estimate ?? {}) as Record<string, unknown>;
  const estimateText = clip(estimate.total, 60);
  const form = b.form === "build" ? "build" : "boutique";
  // Parts and tuning requests are always priced to the vehicle, so they are quotes.
  const intent = form === "boutique" && b.intent === "book" ? "book" : "quote";

  return {
    ok: true,
    value: {
      contact: { email, phone, firstName, lastName },
      intent,
      form,
      service,
      category: serviceToCategory(service),
      vehicle,
      vin: clip(b.vin, 17).toUpperCase(),
      estimateTotal: Math.round(parseAmount(estimateText)),
      estimateText,
      details: clip(b.details, MAX.text),
      smsConsent: b.sms_consent === true,
      page: clip(b.page, MAX.short),
    },
  };
};

export const websiteDealName = (lead: WebsiteLead): string =>
  [lead.service.split(",")[0].trim(), lead.vehicle]
    .filter(Boolean)
    .join(" - ")
    .slice(0, 120);

// ---------------------------------------------------------------------------
// Shopify orders and checkouts
// ---------------------------------------------------------------------------

const LINE_RULES: Array<[string, RegExp]> = [
  ["Deposit", /secure booking deposit/],
  ["Gift card", /gift card/],
  [
    "Tuning",
    /amdp|ez ?lynk|tuning|hp tuners|sotf|flash oem|gdp |edge insight|can ?bus|bypass cable/,
  ],
  [
    "Tint",
    /tint|suntek|brow|film|windshield|quarter glass|back pillar|front window|side window|full back window|glue cleanup|rear glass/,
  ],
  [
    "Detailing",
    /detail|signature|membership|ozone|odou?r|wash|decontamination|bio bomb|seat cover cleaning|car seat cleaning|head ?light restoration|engine bay|leather conditioner|pet hair|urine|personal belongings|maintenance|large suv/,
  ],
  ["Lighting", /light(?! truck)|led|bulb|baja|speed ?demon|kc hilites|harness/],
  [
    "Diesel parts",
    /polar|exhaust|delete|downpipe|muffler|silencer|cp4|grid heater|turbo|intake|up ?pipe|uppipe|clamp|elbow|tip|flex plate|s&b|flange|silicon boot|egr|resonator/,
  ],
  [
    "Mechanical",
    /mechanical|coolant|antifreeze|cabin air filter|rotat|brake|caliper|hub bearing|map sensor|shock|leveling kit|air lift|relay/,
  ],
  [
    "Accessories",
    /flap|kick ?plate|seat cover|running board|tailgate|ventvisor|ventshade|mirror cap|gas strut|topper|camper|bracket|backing plate|emblem/,
  ],
  ["Merch", /t-shirt|hat |hoodie/],
];
const IGNORED_LINES =
  /^(shop supplies.*|mechanical shop supplies|shipping.*|duty fees.*|tip|custom sale|test amount|additional labour)$/;

export const cleanLineName = (name: string): string =>
  name.replace(/^Universal Fit - THE LAB - /, "").trim();

export const categorizeLines = (names: string[]): string[] => {
  const found = new Set<string>();
  for (const raw of names) {
    const name = cleanLineName(raw).toLowerCase();
    if (IGNORED_LINES.test(name)) continue;
    const rule = LINE_RULES.find(([, pattern]) => pattern.test(name));
    if (rule) found.add(rule[0]);
  }
  return [...found].sort();
};

export const isDepositLine = (name: string): boolean =>
  /secure booking deposit/i.test(name);

export type LineItem = {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
};

export type ShopifyOrder = {
  shopifyOrderId: string;
  orderNumber: string;
  contact: ContactInput;
  source: string;
  financialStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotal: number;
  total: number;
  refundedAmount: number;
  lineItems: LineItem[];
  categories: string[];
  isDeposit: boolean;
  orderedAt: string;
  cancelledAt: string | null;
  checkoutToken: string;
  note: string;
};

type AnyRecord = Record<string, unknown>;
const rec = (value: unknown): AnyRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};

const contactFromShopify = (p: AnyRecord): ContactInput => {
  const customer = rec(p.customer);
  const billing = rec(p.billing_address);
  const shipping = rec(p.shipping_address);
  return {
    email: normalizeEmail(p.email ?? p.contact_email ?? customer.email),
    phone: formatPhone(
      p.phone ?? customer.phone ?? billing.phone ?? shipping.phone,
    ),
    firstName: capName(
      customer.first_name ?? billing.first_name ?? shipping.first_name,
    ),
    lastName: capName(
      customer.last_name ?? billing.last_name ?? shipping.last_name,
    ),
    company: clip(billing.company, 120),
  };
};

const lineItemsFrom = (value: unknown): LineItem[] =>
  (Array.isArray(value) ? value : []).map((raw) => {
    const item = rec(raw);
    return {
      name: cleanLineName(clip(item.name ?? item.title, 300)),
      quantity: Number(item.quantity) || 1,
      price: parseAmount(item.price),
      sku: clip(item.sku, 80) || undefined,
    };
  });

export const parseShopifyOrder = (
  payload: unknown,
): ParseResult<ShopifyOrder> => {
  const p = rec(payload);
  if (p.id == null) return { ok: false, error: "Missing order id" };
  const lineItems = lineItemsFrom(p.line_items);
  const refunds = Array.isArray(p.refunds) ? p.refunds : [];
  const refunded = refunds.reduce((sum: number, r) => {
    const transactions = Array.isArray(rec(r).transactions)
      ? (rec(r).transactions as unknown[])
      : [];
    return (
      sum +
      transactions.reduce((s: number, t) => s + parseAmount(rec(t).amount), 0)
    );
  }, 0);
  return {
    ok: true,
    value: {
      shopifyOrderId: String(p.id),
      orderNumber: clip(p.name, 40) || `#${String(p.order_number ?? p.id)}`,
      contact: contactFromShopify(p),
      source: clip(p.source_name, 40),
      financialStatus: clip(p.financial_status, 40),
      fulfillmentStatus: clip(p.fulfillment_status, 40),
      currency: clip(p.currency, 3) || "CAD",
      subtotal: parseAmount(p.subtotal_price),
      total: parseAmount(p.total_price),
      refundedAmount: refunded,
      lineItems,
      categories: categorizeLines(lineItems.map((l) => l.name)),
      isDeposit: lineItems.some((l) => isDepositLine(l.name)),
      orderedAt:
        clip(p.processed_at ?? p.created_at, 40) || new Date().toISOString(),
      cancelledAt: clip(p.cancelled_at, 40) || null,
      checkoutToken: clip(p.checkout_token, 120),
      note: clip(p.note, 2000),
    },
  };
};

export type ShopifyCheckout = {
  token: string;
  contact: ContactInput;
  customerName: string;
  total: number;
  lineItems: LineItem[];
  recoveryUrl: string;
  completedAt: string | null;
  updatedAt: string;
};

export const parseShopifyCheckout = (
  payload: unknown,
): ParseResult<ShopifyCheckout> => {
  const p = rec(payload);
  const token = clip(p.token ?? p.cart_token, 120);
  if (!token) return { ok: false, error: "Missing checkout token" };
  const contact = contactFromShopify(p);
  return {
    ok: true,
    value: {
      token,
      contact,
      customerName: [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(" "),
      total: parseAmount(p.total_price),
      lineItems: lineItemsFrom(p.line_items),
      recoveryUrl: clip(p.abandoned_checkout_url, 500),
      completedAt: clip(p.completed_at, 40) || null,
      updatedAt: clip(p.updated_at, 40) || new Date().toISOString(),
    },
  };
};

export const orderNoteText = (o: ShopifyOrder): string => {
  const status = o.cancelledAt ? "cancelled" : o.financialStatus || "paid";
  const source =
    {
      pos: "In-shop (POS)",
      shopify_draft_order: "Draft order",
      web: "Online store",
    }[o.source] ??
    (o.source || "Shopify");
  const lines = o.lineItems
    .map((l) => `- ${l.quantity} x ${l.name} ($${l.price.toFixed(2)})`)
    .join("\n");
  const note = o.note ? `\n\nOrder note: ${o.note}` : "";
  return `**Shopify order ${o.orderNumber}** - ${source} - $${o.total.toFixed(2)} ${status}\n\n${lines}${note}`;
};

// ---------------------------------------------------------------------------
// Cal.com bookings
// ---------------------------------------------------------------------------

export type CalBooking = {
  trigger: string;
  uid: string;
  previousUid: string;
  title: string;
  eventSlug: string;
  resource: typeof DETAILING_BAY | typeof ERIC;
  category: string;
  startAt: string;
  endAt: string;
  contact: ContactInput;
  notes: string;
};

const responseValue = (responses: AnyRecord, key: string): string => {
  const entry = responses[key];
  if (entry && typeof entry === "object")
    return clip(rec(entry).value, MAX.text);
  return clip(entry, MAX.text);
};

export const parseCalBooking = (body: unknown): ParseResult<CalBooking> => {
  const b = rec(body);
  const trigger = clip(b.triggerEvent, 60);
  if (!trigger) return { ok: false, error: "Missing triggerEvent" };
  const p = rec(b.payload);
  const responses = rec(p.responses);
  const attendee = rec(Array.isArray(p.attendees) ? p.attendees[0] : undefined);
  const slug = clip(p.type ?? p.eventTypeSlug, 120);
  const title = clip(p.title ?? p.eventTitle, 200) || "Appointment";
  const isDetailing = /detail/i.test(`${slug} ${title}`);
  const nameSource =
    responseValue(responses, "name") || clip(attendee.name, MAX.name);
  return {
    ok: true,
    value: {
      trigger,
      uid: clip(p.uid, 120),
      previousUid: clip(
        p.rescheduleUid ?? p.fromReschedule ?? p.rescheduledFromUid,
        120,
      ),
      title,
      eventSlug: slug,
      resource: isDetailing ? DETAILING_BAY : ERIC,
      category: isDetailing
        ? "detailing"
        : serviceToCategory(`${slug} ${title}`),
      startAt: clip(p.startTime, 40),
      endAt: clip(p.endTime, 40),
      contact: {
        email: normalizeEmail(
          responseValue(responses, "email") || attendee.email,
        ),
        phone: formatPhone(
          responseValue(responses, "attendeePhoneNumber") ||
            responseValue(responses, "phone") ||
            attendee.phoneNumber,
        ),
        ...splitName(nameSource),
      },
      notes:
        responseValue(responses, "notes") ||
        clip(p.description ?? p.additionalNotes, MAX.text),
    },
  };
};
