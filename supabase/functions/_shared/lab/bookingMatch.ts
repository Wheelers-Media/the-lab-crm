// Ties a booking typed into Google Calendar to the customer who pays for it.
// Christine and Eric write the customer's name as the event title ("Cory
// Langdon", "Cory Langdon — ceramic coating"); nothing links that event to the
// customer record Shopify makes when he pays. These helpers decide whether a
// title names a customer, and which booking a payer's order belongs to.
//
// Pure: no database or network access, so vitest runs them in Node and the
// edge functions import them unchanged.

/** A booking as the rule sees it: the title typed in Google, not a customer. */
export type NamedBooking = {
  id: number;
  /** The customer already on the booking, when someone linked one. */
  contactId: number | null;
  title: string;
  /** When the booking starts; the oldest wins when two are equally good. */
  when: string;
};

export type BookingMatch =
  | { kind: "match"; booking: NamedBooking }
  | { kind: "ambiguous"; bookings: NamedBooking[] }
  | { kind: "none" };

/**
 * Words of a name or a booking title: lower case, no accents, no punctuation,
 * no possessive. "Cory  Langdon's" -> ["cory", "langdon"].
 */
export const nameTokens = (text: string): string[] =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

const hasRun = (haystack: string[], needle: string[]): boolean => {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    if (needle.every((word, j) => haystack[i + j] === word)) return true;
  }
  return false;
};

/**
 * True when the text names this person. The first and last name must sit next
 * to each other, in either order ("Cory Langdon", "Langdon, Cory"), and a name
 * with more parts may appear in full ("Cory Van Der Berg"). One word on its own
 * never matches: a first name is not enough to pick a customer.
 */
export const titleNames = (text: string, name: string): boolean => {
  const person = nameTokens(name);
  if (person.length < 2) return false;
  const words = nameTokens(text);
  const first = person[0];
  const last = person[person.length - 1];
  return (
    hasRun(words, [first, last]) ||
    hasRun(words, [last, first]) ||
    hasRun(words, person)
  );
};

const oldestFirst = (bookings: NamedBooking[]): NamedBooking[] =>
  [...bookings].sort((a, b) => a.when.localeCompare(b.when));

/**
 * The booking a payer's order belongs to: one that names them, on the day they
 * paid. A booking already linked to the payer wins; otherwise two bookings
 * under the same name are left for a person to sort out.
 */
export const pickBookingForCustomer = (
  bookings: NamedBooking[],
  who: { name: string; contactId?: number | null },
): BookingMatch => {
  const named = bookings.filter((b) => titleNames(b.title, who.name));
  if (!named.length) return { kind: "none" };
  if (who.contactId != null) {
    const mine = named.filter((b) => b.contactId === who.contactId);
    if (mine.length) return { kind: "match", booking: oldestFirst(mine)[0] };
  }
  if (named.length === 1) return { kind: "match", booking: named[0] };
  // Two bookings under one name are only safe to pick between when they are
  // already known to be the same customer's jobs.
  const owners = new Set(named.map((b) => b.contactId ?? `booking-${b.id}`));
  if (owners.size > 1) return { kind: "ambiguous", bookings: named };
  return { kind: "match", booking: oldestFirst(named)[0] };
};

// Words that end the name part of a title: the job, the vehicle or filler.
// "John Hartman delete", "Chris Burke PPF", "Dodge detail".
const NOT_A_NAME = new Set(
  (
    "detail detailing details maintenance maintaince maint tint tinting ppf " +
    "wash washes delete deletes install installs installation ceramic coating " +
    "correction paint painting polish clean cleaning interior exterior engine " +
    "lights light lighting exhaust egr tune tuning tuner quote booking " +
    "appointment drop dropoff off pickup pick bay the lab with and for x2 " +
    "deluxx de luxx signature standard membership truck car suv " +
    "dodge ram ford chevy chevrolet gmc toyota nissan jeep honda hyundai kia " +
    "cummins duramax powerstroke dually"
  ).split(" "),
);

/**
 * The person a Google booking is for, from its title: the words before the
 * first separator, job word or vehicle. "Noah bumstead maintaince x2" ->
 * Noah Bumstead; "Tristen Yanota - Detailing Bay Drop-off" -> Tristen Yanota.
 * Null when the title starts with something other than a name ("Dodge
 * detail"). A single word comes back as a first name only; the caller only
 * creates a customer from that when there is a phone number too.
 */
export const personFromTitle = (
  title: string,
): { firstName: string; lastName: string } | null => {
  const head = title.split(/\s[-–—|]\s|[|:(,/]/)[0] ?? "";
  const words: string[] = [];
  for (const raw of head.trim().split(/\s+/)) {
    const word = raw.replace(/[^\p{L}'’-]/gu, "");
    if (!word || /\d/.test(raw)) break;
    if (NOT_A_NAME.has(nameTokens(word)[0] ?? "")) break;
    words.push(word);
    if (words.length === 3) break;
  }
  if (!words.length) return null;
  const cap = (w: string) =>
    w
      .toLowerCase()
      .replace(
        /(^|[-'’])(\p{L})/gu,
        (_m, a: string, b: string) => a + b.toUpperCase(),
      );
  return {
    firstName: cap(words[0]),
    lastName: words.slice(1).map(cap).join(" "),
  };
};
