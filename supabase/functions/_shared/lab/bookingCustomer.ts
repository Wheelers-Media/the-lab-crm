// The customer behind a booking typed into Google Calendar, made when there is
// none yet. Christine books in the Google Calendar app, so most bookings name
// someone the CRM has never seen: without a customer record the booking never
// reaches a profile and the job never reaches the pipeline.
import { supabaseAdmin } from "../supabaseAdmin.ts";
import { personFromTitle } from "./bookingMatch.ts";
import {
  addContactNote,
  defaultSalesId,
  findContact,
  findContactsNamedIn,
} from "./crm.ts";

export type BookingCustomer =
  | { kind: "found"; id: number }
  | { kind: "created"; id: number }
  // Two customers share the name and nothing picks one: left for a person
  | { kind: "ambiguous" }
  // The title does not name anyone ("Dodge detail")
  | { kind: "none" };

const shortDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Dawson_Creek",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

/**
 * Finds the customer a booking is for, by the name in its title and then the
 * phone in its notes, and creates one when nobody matches. A single first
 * name ("Jude") only becomes a customer when a phone number comes with it.
 */
export const customerForBooking = async ({
  title,
  phone,
  startAt,
}: {
  title: string;
  phone: string | null;
  startAt: string;
}): Promise<BookingCustomer> => {
  const named = await findContactsNamedIn(title);
  if (named.length === 1) return { kind: "found", id: named[0].id };
  if (phone) {
    const byPhone = await findContact({ phone });
    if (byPhone) return { kind: "found", id: byPhone.id };
  }
  if (named.length > 1) return { kind: "ambiguous" };

  const person = personFromTitle(title);
  if (!person || (!person.lastName && !phone)) return { kind: "none" };

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      first_name: person.firstName,
      last_name: person.lastName,
      email_jsonb: [],
      phone_jsonb: phone ? [{ number: phone, type: "Mobile" }] : [],
      tags: [],
      first_seen: startAt,
      last_seen: startAt,
      has_newsletter: false,
      sales_id: await defaultSalesId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`create customer from booking: ${error.message}`);
  const id = data!.id as number;
  await addContactNote(
    id,
    `Added from the Google Calendar booking "${title}" on ${shortDay(startAt)}.`,
    startAt,
  );
  return { kind: "created", id };
};
