// Matches a $50 booking deposit (a Shopify order) to the Cal.com booking it
// pays for. Pure helpers: no network or database access, so they run
// unchanged in Deno (edge functions) and Node (vitest).

/** Lower case, no accents, single spaces: "  José   O'Neil " -> "jose o'neil". */
export const nameKey = (...parts: Array<string | null | undefined>): string =>
  parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");

/**
 * The same person by name: first and last names are equal, middle names and
 * capitals are ignored. A lone first name is too weak to match anyone.
 */
export const sameName = (a: string, b: string): boolean => {
  const x = nameKey(a).split(" ").filter(Boolean);
  const y = nameKey(b).split(" ").filter(Boolean);
  if (x.length < 2 || y.length < 2) return false;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
};

/** A booking waiting for its deposit, or a deposit waiting for its booking. */
export type Candidate = {
  id: number;
  contactId: number | null;
  /** The customer's full name as filed on the booking or the order. */
  name: string;
  /** When the booking starts or the deposit was paid; the oldest is used first. */
  when: string;
};

export type Match<T extends Candidate> =
  | { kind: "match"; item: T; by: "customer" | "name" }
  | { kind: "ambiguous"; items: T[] }
  | { kind: "none" };

const oldestFirst = <T extends Candidate>(items: T[]): T =>
  [...items].sort((a, b) => a.when.localeCompare(b.when))[0];

/**
 * Picks the candidate for a payer or booker. A candidate on the same customer
 * record wins; otherwise the customer's name decides. When two different
 * customers share the name there is no safe choice, so it is left to a person.
 */
export const pickByCustomer = <T extends Candidate>(
  candidates: T[],
  who: { contactId: number | null; name: string },
): Match<T> => {
  if (who.contactId != null) {
    const mine = candidates.filter((c) => c.contactId === who.contactId);
    if (mine.length)
      return { kind: "match", item: oldestFirst(mine), by: "customer" };
  }
  const named = who.name
    ? candidates.filter((c) => sameName(c.name, who.name))
    : [];
  if (!named.length) return { kind: "none" };
  const owners = new Set(named.map((c) => c.contactId ?? `candidate-${c.id}`));
  if (owners.size > 1) return { kind: "ambiguous", items: named };
  return { kind: "match", item: oldestFirst(named), by: "name" };
};
