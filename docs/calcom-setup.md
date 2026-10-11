# Connecting Cal.com to THE LAB CRM

What this turns on:

- **Bookings**: every booking on `cal.com/the-lab/detailing-drop-off` and `cal.com/the-lab/eric-services` lands on the CRM calendar, moves the customer's job to Booked and adds a drop-off task.
- **Reschedules and cancellations**: the calendar slot and the task follow the booking. A cancellation adds a "Follow up to rebook" task.
- **$50 deposit**: it is paid in the Shopify store, not in Cal.com. When the Shopify order arrives the CRM finds the booking it pays for (see [shopify-setup.md](shopify-setup.md)). A booking made after the deposit was paid picks the deposit up too, so the order of the two does not matter.

## Webhook

In Cal.com: **Settings** → **Developer** → **Webhooks** → **New**.

| Field | Value |
|---|---|
| Subscriber URL | `https://<project-ref>.supabase.co/functions/v1/calcom_webhook` |
| Secret | the same value as the `CALCOM_WEBHOOK_SECRET` secret on the Supabase project |
| Triggers | **Booking Created**, **Booking Rescheduled**, **Booking Cancelled** |

`<project-ref>` is in the Supabase dashboard URL (`supabase.com/dashboard/project/<project-ref>`).

Use Cal.com's **Ping test** to check the URL and secret. A ping answers `ok` and creates nothing.

Every delivery is logged in the `integration_events` table (source `calcom`), with the error if one failed.
