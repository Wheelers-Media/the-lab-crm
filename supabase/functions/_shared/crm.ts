// Database helpers shared by the THE LAB receivers (website form, Shopify, Cal.com).
// Everything is additive: contacts are found or created, and events add notes, tasks and stage changes.
// Nothing is deleted, and existing contact details are never overwritten.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { phoneFormats } from "./lab.ts";

export interface Contact {
  id: number;
  email_jsonb: { email: string; type?: string }[] | null;
  phone_jsonb: { number: string; type?: string }[] | null;
}

function must<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

/** The person new records belong to: the first active administrator. Null when there is none. */
export async function ownerSaleId(db: SupabaseClient): Promise<number | null> {
  const rows = must(
    await db
      .from("sales")
      .select("id")
      .eq("administrator", true)
      .neq("disabled", true)
      .order("id", { ascending: true })
      .limit(1),
    "Could not read the owner",
  );
  return rows?.[0]?.id ?? null;
}

/** Matches by email first, then by phone number in any of the usual written formats. */
export async function findContact(
  db: SupabaseClient,
  { email, phone }: { email: string | null; phone: string | null },
): Promise<Contact | null> {
  if (email) {
    const rows = must(
      await db
        .from("contacts")
        .select("id, email_jsonb, phone_jsonb")
        .contains("email_jsonb", JSON.stringify([{ email }]))
        .order("id", { ascending: true })
        .limit(1),
      "Could not look up the contact by email",
    );
    if (rows?.[0]) return rows[0] as Contact;
  }
  if (phone) {
    const hits = await Promise.all(
      phoneFormats(phone).map((number) =>
        db
          .from("contacts")
          .select("id, email_jsonb, phone_jsonb")
          .contains("phone_jsonb", JSON.stringify([{ number }]))
          .order("id", { ascending: true })
          .limit(1),
      ),
    );
    for (const hit of hits) {
      const rows = must(hit, "Could not look up the contact by phone");
      if (rows?.[0]) return rows[0] as Contact;
    }
  }
  return null;
}

/** Finds the customer or creates them; an existing contact only gains details it did not have. */
export async function findOrCreateContact(
  db: SupabaseClient,
  input: {
    first: string;
    last: string;
    email: string | null;
    phone: string | null;
  },
  salesId: number | null,
): Promise<{ contact: Contact; created: boolean }> {
  const existing = await findContact(db, input);
  const now = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = { last_seen: now };
    const emails = existing.email_jsonb ?? [];
    const phones = existing.phone_jsonb ?? [];
    const hasEmail = input.email
      ? emails.some((e) => e.email?.toLowerCase() === input.email)
      : true;
    const hasPhone = input.phone
      ? phones.some((p) =>
          phoneFormats(input.phone as string).includes(p.number),
        )
      : true;
    if (!hasEmail) {
      patch.email_jsonb = [...emails, { email: input.email, type: "Home" }];
    }
    if (!hasPhone) {
      patch.phone_jsonb = [...phones, { number: input.phone, type: "Home" }];
    }
    must(
      await db.from("contacts").update(patch).eq("id", existing.id),
      "Could not update the contact",
    );
    return { contact: existing, created: false };
  }

  const rows = must(
    await db
      .from("contacts")
      .insert({
        first_name: input.first,
        last_name: input.last,
        email_jsonb: input.email ? [{ email: input.email, type: "Home" }] : [],
        phone_jsonb: input.phone ? [{ number: input.phone, type: "Home" }] : [],
        status: "warm",
        tags: [],
        sales_id: salesId,
        first_seen: now,
        last_seen: now,
      })
      .select("id, email_jsonb, phone_jsonb"),
    "Could not create the contact",
  );
  return { contact: rows[0] as Contact, created: true };
}

/** An open deal for the same customer and service created since `sinceIso`, if any. */
export async function findRecentOpenDeal(
  db: SupabaseClient,
  contactId: number,
  category: string,
  sinceIso: string,
): Promise<{ id: number; stage: string } | null> {
  const rows = must(
    await db
      .from("deals")
      .select("id, stage")
      .contains("contact_ids", [contactId])
      .eq("category", category)
      .not("stage", "in", "(won,lost)")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1),
    "Could not look for a recent deal",
  );
  return rows?.[0] ?? null;
}

export async function createDeal(
  db: SupabaseClient,
  deal: {
    name: string;
    category: string;
    stage: string;
    description: string;
    amount: number | null;
    contactId: number;
    salesId: number | null;
  },
): Promise<number> {
  const rows = must(
    await db
      .from("deals")
      .insert({
        name: deal.name,
        category: deal.category,
        stage: deal.stage,
        description: deal.description,
        amount: deal.amount,
        contact_ids: [deal.contactId],
        sales_id: deal.salesId,
        index: 0,
      })
      .select("id"),
    "Could not create the deal",
  );
  return rows[0].id as number;
}

export async function addDealNote(
  db: SupabaseClient,
  dealId: number,
  text: string,
  salesId: number | null,
  type = "website",
): Promise<void> {
  must(
    await db
      .from("deal_notes")
      .insert({ deal_id: dealId, type, text, sales_id: salesId }),
    "Could not add the deal note",
  );
}

export async function addContactNote(
  db: SupabaseClient,
  contactId: number,
  text: string,
  salesId: number | null,
  status = "warm",
): Promise<void> {
  must(
    await db
      .from("contact_notes")
      .insert({ contact_id: contactId, text, sales_id: salesId, status }),
    "Could not add the contact note",
  );
}

export async function addTask(
  db: SupabaseClient,
  task: {
    contactId: number;
    type: string;
    text: string;
    dueDate: string;
    salesId: number | null;
  },
): Promise<void> {
  must(
    await db.from("tasks").insert({
      contact_id: task.contactId,
      type: task.type,
      text: task.text,
      due_date: task.dueDate,
      sales_id: task.salesId,
    }),
    "Could not add the task",
  );
}

/** How many deals were created since `sinceIso`. Used as a flood guard on the public endpoint. */
export async function countDealsSince(
  db: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const result = await db
    .from("deals")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (result.error) {
    throw new Error(`Could not count recent deals: ${result.error.message}`);
  }
  return result.count ?? 0;
}
