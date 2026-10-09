// Database operations shared by THE LAB connectors. Runs with the service role.
import { supabaseAdmin } from "../supabaseAdmin.ts";
import type { ContactInput } from "./parse.ts";

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

let cachedSalesId: number | null = null;
export const defaultSalesId = async (): Promise<number | null> => {
  if (cachedSalesId) return cachedSalesId;
  const { data } = await supabaseAdmin
    .from("sales")
    .select("id")
    .eq("administrator", true)
    .eq("disabled", false)
    .order("id")
    .limit(1);
  cachedSalesId = (data?.[0]?.id as number) ?? null;
  return cachedSalesId;
};

export const ensureTagIds = async (names: string[]): Promise<number[]> => {
  const ids: number[] = [];
  for (const [i, name] of names.entries()) {
    const { data } = await supabaseAdmin
      .from("tags")
      .select("id")
      .eq("name", name)
      .limit(1);
    if (data?.[0]) {
      ids.push(data[0].id as number);
      continue;
    }
    const { data: created, error } = await supabaseAdmin
      .from("tags")
      .insert({ name, color: TAG_COLORS[i % TAG_COLORS.length] })
      .select("id")
      .single();
    if (error) fail("create tag", error);
    ids.push(created!.id as number);
  }
  return ids;
};

type ContactRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email_jsonb: Array<{ email: string; type: string }> | null;
  phone_jsonb: Array<{ number: string; type: string }> | null;
  tags: number[] | null;
};

const CONTACT_FIELDS =
  "id, first_name, last_name, email_jsonb, phone_jsonb, tags";

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

/**
 * Finds the contact by email, then phone. Creates one when there is no match.
 * Existing contacts only gain information (a missing name, email, phone or tag);
 * nothing already on the record is overwritten.
 */
export const findOrCreateContact = async (
  input: ContactInput,
  tagNames: string[] = [],
): Promise<{ id: number; created: boolean } | null> => {
  if (!input.email && !input.phone && !input.firstName && !input.lastName)
    return null;
  const tagIds = tagNames.length ? await ensureTagIds(tagNames) : [];
  const existing = await findContact(input);
  const now = new Date().toISOString();

  if (existing) {
    const emails = existing.email_jsonb ?? [];
    const phones = existing.phone_jsonb ?? [];
    const update: Record<string, unknown> = { last_seen: now };
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
      first_seen: now,
      last_seen: now,
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
  stage: string;
  category: string;
  amount: number;
  leadSource: string;
  description?: string;
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
      description: deal.description ?? null,
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
