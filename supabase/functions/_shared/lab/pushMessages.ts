// The alerts the CRM sends to phones, as plain text. Pure, so the wording and
// the deep links can be tested without a database or a push service.

/** The kinds of alert a device can switch on or off. */
export type PushKind = "lead" | "booking" | "deposit" | "order";
export const PUSH_KINDS: PushKind[] = ["lead", "booking", "deposit", "order"];

export interface PushMessage {
  kind: PushKind;
  title: string;
  body: string;
  /** Where tapping the alert goes, as a path on the CRM (hash routes). */
  url: string;
  /** A newer alert with the same tag replaces the old one on the phone. */
  tag: string;
}

const MAX_BODY = 140;

const join = (...parts: Array<string | null | undefined>) =>
  parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, MAX_BODY);

const money = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });

const dealUrl = (dealId?: number | null) =>
  dealId ? `/#/deals/${dealId}/show` : null;

/** A quote or booking request arrived from the website form. */
export const leadMessage = (i: {
  dealId: number;
  name: string;
  service: string;
  vehicle: string;
  intent: "quote" | "book";
  /** "Instagram", "Facebook", "Google" when the visitor came from there. */
  from?: string;
}): PushMessage => ({
  kind: "lead",
  title: i.intent === "book" ? "New booking request" : "New quote request",
  body: join(i.name, i.service, i.vehicle, i.from ? `from ${i.from}` : null),
  url: dealUrl(i.dealId) ?? "/#/deals",
  tag: `lead-${i.dealId}`,
});

export type BookingTrigger =
  | "BOOKING_CREATED"
  | "BOOKING_RESCHEDULED"
  | "BOOKING_CANCELLED";

const BOOKING_TITLES: Record<BookingTrigger, string> = {
  BOOKING_CREATED: "New booking",
  BOOKING_RESCHEDULED: "Booking moved",
  BOOKING_CANCELLED: "Booking cancelled",
};

/** Cal.com booked, moved or cancelled a time. `when` is already in shop time. */
export const bookingMessage = (i: {
  trigger: BookingTrigger;
  uid: string;
  title: string;
  name: string;
  when: string;
}): PushMessage => ({
  kind: "booking",
  title: BOOKING_TITLES[i.trigger],
  body: join(i.title, i.name, i.when),
  url: "/#/calendar",
  tag: `booking-${i.uid}`,
});

/** The $50 booking deposit was paid. */
export const depositMessage = (i: {
  name: string;
  orderNumber: string;
  dealId?: number | null;
}): PushMessage => ({
  kind: "deposit",
  title: "Deposit paid",
  body: join(i.name, "$50 booking deposit"),
  url: dealUrl(i.dealId) ?? "/#/orders",
  tag: `deposit-${i.orderNumber}`,
});

/** A Shopify order was paid. */
export const orderMessage = (i: {
  name: string;
  orderNumber: string;
  total: number;
}): PushMessage => ({
  kind: "order",
  title: `New order ${money(i.total)}`,
  body: join(i.name, `Order ${i.orderNumber}`),
  url: "/#/orders",
  tag: `order-${i.orderNumber}`,
});

/** A device's saved choices; a kind it never mentioned is on. */
export const wantsKind = (prefs: unknown, kind: PushKind): boolean =>
  !(
    prefs &&
    typeof prefs === "object" &&
    (prefs as Record<string, unknown>)[kind] === false
  );
