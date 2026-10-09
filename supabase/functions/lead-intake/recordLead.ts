import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  addContactNote,
  addDealNote,
  addTask,
  createDeal,
  findOrCreateContact,
  findRecentOpenDeal,
  ownerSaleId,
} from "../_shared/crm.ts";
import { dealDescription, type Lead } from "./parseLead.ts";

/** A repeat submission for the same service inside this window adds a note instead of a second deal. */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

export interface RecordedLead {
  contactId: number;
  dealId: number;
  newContact: boolean;
  duplicate: boolean;
}

/** Puts a website request into the CRM: a contact, a deal in the right stage, notes and a "Send quote" task. */
export async function recordLead(
  db: SupabaseClient,
  lead: Lead,
  now = new Date(),
): Promise<RecordedLead> {
  const salesId = await ownerSaleId(db);
  const { contact, created } = await findOrCreateContact(db, lead, salesId);

  const since = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
  const recent = await findRecentOpenDeal(db, contact.id, lead.category, since);
  const kind = lead.intent === "book" ? "booking" : "quote";
  const detail = lead.message || dealDescription(lead);

  if (recent) {
    await addDealNote(
      db,
      recent.id,
      `Sent again from the website (${kind}).\n\n${detail}`,
      salesId,
    );
    return {
      contactId: contact.id,
      dealId: recent.id,
      newContact: created,
      duplicate: true,
    };
  }

  const dealId = await createDeal(db, {
    name: lead.dealName,
    category: lead.category,
    stage: lead.stage,
    description: dealDescription(lead),
    amount: lead.amount,
    contactId: contact.id,
    salesId,
  });
  await addDealNote(db, dealId, detail, salesId);
  await addContactNote(
    db,
    contact.id,
    `Website ${kind} request: ${lead.dealName}`,
    salesId,
  );

  // A quote request needs Eric to send a price; a booking is already moving, and Cal.com will move it on.
  if (lead.intent === "quote") {
    await addTask(db, {
      contactId: contact.id,
      type: "send-quote",
      text: `Send quote: ${lead.dealName}${lead.amount ? ` (starting price $${lead.amount})` : ""}`,
      dueDate: now.toISOString(),
      salesId,
    });
  }

  return {
    contactId: contact.id,
    dealId,
    newContact: created,
    duplicate: false,
  };
}
