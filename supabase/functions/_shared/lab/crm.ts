// Database operations shared by THE LAB connectors. Runs with the service role.
import { supabaseAdmin } from "../supabaseAdmin.ts";
import type { NamedBooking } from "./bookingMatch.ts";
import { nameTokens, titleNames } from "./bookingMatch.ts";
import type { ContactInput } from "./parse.ts";
import type { Candidate } from "./depositMatch.ts";

/** The shop's clock; bookings and orders are grouped by its days. */
export const SHOP_TIME_ZONE = "America/Dawson_Creek";

const TAG_COLORS = [
  "#bcd4e6",
  "#c5dedd",
  "#fde2e4",
  "#fff1e6",
  "#d6e2e9",
  "#dbe7e4",
];

// Deal stages that are still in progress (won = Converted, lost = Not now)
export const OPEN_STAGES = ["intake", "qualified", "quoted", "booked"];

/** "Mon, Oct 13, 2:00 p.m." in the shop's time zone. */
export const shopTimeText = (iso: string): string =>
  new Date(iso).toLocaleString("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const fail = (context: string, error: { message: string } | null): never => {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
};

export type IntegrationEvent = {
  source: string;
  eventType: string;
  externalId?: string | null;
  clientHash?: string | null;
  payload?: unknown;
};

/**
 * Records an incoming event. Returns null when the same (source, externalId) was
 * already recorded, so retried webhooks are processed once.
 */
export const recordEvent = async (
  event: IntegrationEvent,
): Promise<number | null> => {
  const { data, error } = await supabaseAdmin
    .from("integration_events")
    .insert({
      source: event.source,
      event_type: event.eventType,
      external_id: event.externalId ?? null,
      client_hash: event.clientHash ?? null,
      payload: event.payload ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null; // duplicate delivery
    fail("record event", error);
  }
  return data!.id as number;
};

export const finishEvent = async (
  id: number,
  status: "processed" | "failed" | "ignored",
  message?: string,
) => {
  await supabaseAdmin
    .from("integration_events")
    .update({ status, error: message?.slice(0, 2000) ?? null })
    .eq("id", id);
};

export const countRecentEvents = async (
  source: string,
  clientHash: string,
  minutes: number,
): Promise<number> => {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("integration_events")
    .select("id", { count: "exact", head: true })
    .eq("source", source)
    .eq("client_hash", clientHash)
    .gte("created_at", since);
  if (error) fail("count events", error);
  return count ?? 0;
};

// Automatic records belong to the shop account Eric and Christine use; until
// that account exists they fall back to the first active admin.
const SHOP_ACCOUNT_EMAIL = "info@luxxautomotiveboutique.com";

let cachedSalesId: number | null = null;
export const defaultSalesId = async (): Promise<number | null> => {
  if (cachedSalesId) return cachedSalesId;
  const { data } = await supabaseAdmin
    .from("sales")
    .select("id, email, administrator")
    .eq("disabled", false)
    .order("id");
  const rows = (data ?? []) as Array<{
    id: number;
    email: string | null;
    administrator: boolean;
  }>;
  const owner =
    rows.find((r) => r.email?.toLowerCase() === SHOP_ACCOUNT_EMAIL) ??
    rows.find((r) => r.administrator) ??
    rows[0];
  // Only cache the shop account, so creating it later takes effect
  if (owner?.email?.toLowerCase() === SHOP_ACCOUNT_EMAIL)
    cachedSalesId = owner.id;
  return owner?.id ?? null;
};

export const ensureTagIds = async (names: string[]): Promise<number[]> => {
  const ids: number[] = [];
  for (const [i, name] of names.entries()) {
    // Matches an existing tag regardless of capitals or spacing, so
    // "Shopify customer" and "shopify customer " stay one tag
    const { data, error } = await supabaseAdmin.rpc("get_or_create_tag", {
      p_name: name,
      p_color: TAG_COLORS[i % TAG_COLORS.length],
    });
    if (error || !data) fail("create tag", error);
    ids.push((data as { id: number }).id);
  }
  return [...new Set(ids)];
};

type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: Array<{ email: string; type: string }> | null;
  phone_jsonb: Array<{ number: string; type: string }> | null;
  tags: number[] | null;
  first_seen: string | null;
  last_seen: string | null;
};

const CONTACT_FIELDS =
  "id, first_name, last_name, email_jsonb, phone_jsonb, tags, first_seen, last_seen";

const earlier = (a: string | null, b: string) => (a && a < b ? a : b);
const later = (a: string | null, b: string) => (a && a > b ? a : b);

export const findContact = async (
  input: ContactInput,
): Promise<ContactRow | null> => {
  if (input.email) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(CONTACT_FIELDS)
      .filter("email_jsonb", "cs", JSON.stringify([{ email: input.email }]))
      .order("id")
      .limit(1);
    if (error) fail("find contact by email", error);
    if (data?.[0]) return data[0] as ContactRow;
  }
  if (input.phone) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select(CONTACT_FIELDS)
      .filter("phone_jsonb", "cs", JSON.stringify([{ number: input.phone }]))
      .order("id")
      .limit(1);
    if (error) fail("find contact by phone", error);
    if (data?.[0]) return data[0] as ContactRow;
  }
  return null;
};

const findContactById = async (id: number): Promise<ContactRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(CONTACT_FIELDS)
    .eq("id", id)
    .limit(1);
  if (error) fail("find contact by id", error);
  return (data?.[0] as ContactRow) ?? null;
};

/**
 * Finds the contact by email, then phone. Creates one when there is no match.
 * Existing contacts only gain information (a missing name, email, phone or tag);
 * nothing already on the record is overwritten.
 */
export const findOrCreateContact = async (
  input: ContactInput,
  tagNames: string[] = [],
  // When the customer was seen; history imports pass the order date
  seenAt: string = new Date().toISOString(),
  // A customer already identified another way (a deposit matched to a booking
  // by name): the email and phone used to pay are added to their record
  // instead of creating a second customer
  contactId?: number,
): Promise<{ id: number; created: boolean } | null> => {
  if (!input.email && !input.phone && !input.firstName && !input.lastName)
    return null;
  const tagIds = tagNames.length ? await ensureTagIds(tagNames) : [];
  const existing = contactId
    ? ((await findContactById(contactId)) ?? (await findContact(input)))
    : await findContact(input);

  if (existing) {
    const emails = existing.email_jsonb ?? [];
    const phones = existing.phone_jsonb ?? [];
    const update: Record<string, unknown> = {
      first_seen: earlier(existing.first_seen, seenAt),
      last_seen: later(existing.last_seen, seenAt),
    };
    if (
      input.email &&
      !emails.some((e) => e.email?.toLowerCase() === input.email)
    ) {
      update.email_jsonb = [...emails, { email: input.email, type: "Home" }];
    }
    if (input.phone && !phones.some((p) => p.number === input.phone)) {
      update.phone_jsonb = [...phones, { number: input.phone, type: "Home" }];
    }
    if (!existing.first_name && input.firstName)
      update.first_name = input.firstName;
    if (!existing.last_name && input.lastName)
      update.last_name = input.lastName;
    const tags = [...new Set([...(existing.tags ?? []), ...tagIds])];
    if (tags.length !== (existing.tags ?? []).length) update.tags = tags;
    const { error } = await supabaseAdmin
      .from("contacts")
      .update(update)
      .eq("id", existing.id);
    if (error) fail("update contact", error);
    return { id: existing.id, created: false };
  }

  // Only create a contact when there is a way to reach them
  if (!input.email && !input.phone) return null;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      first_name: input.firstName || "",
      last_name: input.lastName || input.email || input.phone || "",
      email_jsonb: input.email ? [{ email: input.email, type: "Home" }] : [],
      phone_jsonb: input.phone ? [{ number: input.phone, type: "Home" }] : [],
      tags: tagIds,
      first_seen: seenAt,
      last_seen: seenAt,
      has_newsletter: false,
      sales_id: await defaultSalesId(),
    })
    .select("id")
    .single();
  if (error) fail("create contact", error);
  return { id: data!.id as number, created: true };
};

export const addContactNote = async (
  contactId: number,
  text: string,
  date?: string,
) => {
  const { error } = await supabaseAdmin.from("contact_notes").insert({
    contact_id: contactId,
    text,
    date: date ?? new Date().toISOString(),
    sales_id: await defaultSalesId(),
  });
  if (error) fail("add contact note", error);
};

export const addDealNote = async (dealId: number, text: string) => {
  const { error } = await supabaseAdmin.from("deal_notes").insert({
    deal_id: dealId,
    text,
    date: new Date().toISOString(),
    sales_id: await defaultSalesId(),
  });
  if (error) fail("add deal note", error);
};

export const createTask = async (
  contactId: number,
  type: string,
  text: string,
  dueDate?: string,
): Promise<number> => {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      contact_id: contactId,
      type,
      text,
      due_date: dueDate ?? new Date().toISOString(),
      sales_id: await defaultSalesId(),
    })
    .select("id")
    .single();
  if (error) fail("create task", error);
  return data!.id as number;
};

type DealRow = {
  id: number;
  name: string;
  stage: string;
  amount: number | null;
};

/** The contact's most recently updated deal that is still in progress. */
export const findOpenDeal = async (
  contactId: number,
): Promise<DealRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("id, name, stage, amount")
    .contains("contact_ids", [contactId])
    .in("stage", OPEN_STAGES)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) fail("find open deal", error);
  return (data?.[0] as DealRow) ?? null;
};

export type NewDeal = {
  name: string;
  contactId: number;
  vehicleId?: number | null;
  stage: string;
  category: string;
  amount: number;
  leadSource: string;
  description?: string;
  /** Package lines: [{ package_id, title, price, quantity }] */
  packages?: Array<{
    package_id: number | null;
    title: string;
    price: number;
    quantity: number;
  }>;
  /** The website quote that started the job */
  quote?: unknown;
};

export const createDeal = async (deal: NewDeal): Promise<number> => {
  const { count } = await supabaseAdmin
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage", deal.stage);
  const { data, error } = await supabaseAdmin
    .from("deals")
    .insert({
      name: deal.name,
      contact_ids: [deal.contactId],
      stage: deal.stage,
      category: deal.category,
      amount: Math.max(0, Math.round(deal.amount)),
      lead_source: deal.leadSource,
      vehicle_id: deal.vehicleId ?? null,
      description: deal.description ?? null,
      packages: deal.packages ?? [],
      quote: deal.quote ?? null,
      expected_closing_date: new Date().toISOString().slice(0, 10),
      sales_id: await defaultSalesId(),
      index: count ?? 0,
    })
    .select("id")
    .single();
  if (error) fail("create deal", error);
  return data!.id as number;
};

export const moveDeal = async (dealId: number, stage: string) => {
  const { error } = await supabaseAdmin
    .from("deals")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) fail("move deal", error);
};

export type VehicleInput = {
  year: number | null;
  make: string;
  model: string;
  vin?: string;
};

const sameText = (a: string | null | undefined, b: string) =>
  (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The customer's vehicle for a request: matched on VIN, then on year, make and
 * model; added to their profile when it is new. Returns null when the request
 * names no vehicle. Existing details are only filled in, never overwritten.
 */
export const findOrCreateVehicle = async (
  contactId: number,
  input: VehicleInput,
): Promise<number | null> => {
  const vin = (input.vin ?? "").trim().toUpperCase();
  if (!vin && !input.make && !input.model) return null;
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("id, year, make, model, vin")
    .eq("contact_id", contactId);
  if (error) fail("find vehicle", error);
  const rows = (data ?? []) as Array<{
    id: number;
    year: number | null;
    make: string | null;
    model: string | null;
    vin: string | null;
  }>;
  const match =
    (vin && rows.find((v) => (v.vin ?? "").toUpperCase() === vin)) ||
    rows.find(
      (v) =>
        (input.year == null || v.year === input.year) &&
        sameText(v.make, input.make) &&
        sameText(v.model, input.model),
    );
  if (match) {
    const fill: Record<string, unknown> = {};
    if (!match.vin && vin) fill.vin = vin;
    if (match.year == null && input.year != null) fill.year = input.year;
    if (Object.keys(fill).length) {
      await supabaseAdmin.from("vehicles").update(fill).eq("id", match.id);
    }
    return match.id;
  }
  const { data: created, error: createError } = await supabaseAdmin
    .from("vehicles")
    .insert({
      contact_id: contactId,
      year: input.year,
      make: input.make || null,
      model: input.model || null,
      vin: vin || null,
      is_primary: rows.length === 0,
      sales_id: await defaultSalesId(),
    })
    .select("id")
    .single();
  if (createError) fail("create vehicle", createError);
  return created!.id as number;
};

/** The vehicle to use when a booking does not say which: the primary, or the only one. */
export const defaultVehicleFor = async (
  contactId: number,
): Promise<{ id: number; label: string } | null> => {
  const { data } = await supabaseAdmin
    .from("vehicles")
    .select("id, year, make, model, is_primary")
    .eq("contact_id", contactId)
    .order("is_primary", { ascending: false })
    .order("id");
  const rows = (data ?? []) as Array<{
    id: number;
    year: number | null;
    make: string | null;
    model: string | null;
    is_primary: boolean;
  }>;
  const pick = rows.length === 1 ? rows[0] : rows.find((r) => r.is_primary);
  if (!pick) return null;
  return {
    id: pick.id,
    label: [pick.year, pick.make, pick.model].filter(Boolean).join(" "),
  };
};

/** Records SMS consent and where the customer first came from, without overwriting. */
export const noteContactProfile = async (
  contactId: number,
  profile: { smsConsent?: boolean; leadSource?: string },
) => {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("sms_consent, lead_source")
    .eq("id", contactId)
    .single();
  const update: Record<string, unknown> = {};
  if (profile.smsConsent && !data?.sms_consent) {
    update.sms_consent = true;
    update.sms_consent_at = new Date().toISOString();
  }
  if (profile.leadSource && !data?.lead_source) {
    update.lead_source = profile.leadSource;
  }
  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin
      .from("contacts")
      .update(update)
      .eq("id", contactId);
    if (error) fail("update contact profile", error);
  }
};

/** How the contact embedded in a row reads: PostgREST returns an object or a list. */
type EmbeddedContact =
  | { first_name: string | null; last_name: string | null }
  | Array<{ first_name: string | null; last_name: string | null }>
  | null;

const embeddedName = (contact: EmbeddedContact): string => {
  const c = Array.isArray(contact) ? contact[0] : contact;
  return [c?.first_name, c?.last_name].filter(Boolean).join(" ");
};

export type UnpaidBooking = Candidate & { dealId: number | null };

/** Bookings that are still to come (or only just started) and have no deposit yet. */
export const findUnpaidBookings = async (): Promise<UnpaidBooking[]> => {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, deal_id, contact_id, start_at, contacts(first_name, last_name)",
    )
    .eq("status", "booked")
    .eq("deposit_paid", false)
    .gte("start_at", since)
    .order("start_at")
    .limit(500);
  if (error) fail("find unpaid bookings", error);
  return (
    (data ?? []) as unknown as Array<{
      id: number;
      deal_id: number | null;
      contact_id: number | null;
      start_at: string;
      contacts: EmbeddedContact;
    }>
  ).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    dealId: row.deal_id,
    name: embeddedName(row.contacts),
    when: row.start_at,
  }));
};

/** The shop's calendar day for an instant: "2026-10-27". */
const shopDayKey = (iso: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

/**
 * Bookings that start on the shop day of `iso`, linked to a customer or not.
 * The window is wide enough for any time zone; the day itself decides.
 */
export const findBookingsOnDay = async (
  iso: string,
): Promise<NamedBooking[]> => {
  const at = new Date(iso).getTime();
  const day = shopDayKey(iso);
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id, contact_id, title, start_at")
    .gte("start_at", new Date(at - 36 * 3_600_000).toISOString())
    .lt("start_at", new Date(at + 36 * 3_600_000).toISOString())
    .in("status", ["booked", "completed"])
    .order("start_at")
    .limit(200);
  if (error) fail("find bookings on day", error);
  return (
    (data ?? []) as unknown as Array<{
      id: number;
      contact_id: number | null;
      title: string;
      start_at: string;
    }>
  )
    .filter((row) => shopDayKey(row.start_at) === day)
    .map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      title: row.title,
      when: row.start_at,
    }));
};

/** Puts the customer on the booking. A booking already linked is left alone. */
export const linkBooking = async (
  bookingId: number,
  contactId: number,
): Promise<boolean> => {
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update({ contact_id: contactId })
    .eq("id", bookingId)
    .is("contact_id", null)
    .select("id");
  if (error) fail("link booking", error);
  return (data ?? []).length > 0;
};

/** Customers whose name appears in a booking title; several may share it. */
export const findContactsNamedIn = async (
  title: string,
): Promise<ContactRow[]> => {
  // Look the title's words up as last names first: whoever the booking is for,
  // one of those words is their last name.
  const words = nameTokens(title).slice(0, 6);
  if (!words.length) return [];
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select(CONTACT_FIELDS)
    .or(words.map((word) => `last_name.ilike.%${word}%`).join(","))
    .limit(50);
  if (error) fail("find customer by name", error);
  return ((data ?? []) as ContactRow[]).filter((contact) =>
    titleNames(
      title,
      [contact.first_name, contact.last_name].filter(Boolean).join(" "),
    ),
  );
};

/**
 * The customer behind a booking typed into Google: the name in the title comes
 * first, then the phone number in the notes. Two customers sharing a name are
 * not guessed between unless the phone picks one.
 */
export const resolveCustomerForBooking = async ({
  title,
  phone,
}: {
  title: string;
  phone: string | null;
}): Promise<ContactRow | null> => {
  const named = await findContactsNamedIn(title);
  if (named.length === 1) return named[0];
  if (phone) {
    const byPhone = await findContact({ phone });
    if (byPhone) return byPhone;
  }
  return null;
};

export type UnclaimedDeposit = Candidate & {
  dealId: number | null;
  orderNumber: string;
};

/** Deposits paid in the last two weeks that no booking has claimed yet. */
export const findUnclaimedDeposits = async (): Promise<UnclaimedDeposit[]> => {
  const since = new Date(Date.now() - 14 * 24 * 3_600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, order_number, deal_id, contact_id, ordered_at, contacts(first_name, last_name)",
    )
    .eq("is_deposit", true)
    .is("appointment_id", null)
    .is("cancelled_at", null)
    .gte("ordered_at", since)
    .order("ordered_at")
    .limit(500);
  if (error) fail("find unclaimed deposits", error);
  return (
    (data ?? []) as unknown as Array<{
      id: number;
      order_number: string;
      deal_id: number | null;
      contact_id: number | null;
      ordered_at: string;
      contacts: EmbeddedContact;
    }>
  ).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    dealId: row.deal_id,
    orderNumber: row.order_number,
    name: embeddedName(row.contacts),
    when: row.ordered_at,
  }));
};
