# Connecting the shop's Google calendars to THE LAB CRM

What this turns on:

- **Google to CRM**: events typed into **THE LAB | Detailing Bay** or **THE LAB | Vehicle Customization** show on the CRM calendar (and count towards bay capacity). The vehicle line and the notes come along, and a phone number in the notes links the customer when it matches a contact.
- **Changes follow**: a time moved or an event cancelled in Google updates the CRM.
- **CRM to Google**: an appointment added in the CRM is put on the right calendar. A time edit or a cancellation made in the CRM follows to Google. When both sides were edited, the later edit wins.
- **Cal.com is left alone**: Cal.com already writes its bookings to these calendars and tells the CRM by webhook ([calcom-setup.md](calcom-setup.md)). Those events are recognised and not imported twice.

Left out on purpose: whole-day entries (such as "Dolly maintenance") take no bay time, so they are not appointments. The Calendar screen says how many it left out.

## One-time setup (about 10 minutes)

The CRM reads and writes the calendars as a **service account**: a robot Google user that never expires and needs no sign-in screen.

1. **Google Cloud**: open [console.cloud.google.com](https://console.cloud.google.com), pick or create a project (for example "THE LAB CRM") and, under **APIs & Services** → **Library**, enable **Google Calendar API**.
2. **Service account**: **IAM & Admin** → **Service accounts** → **Create service account**. Name it `the-lab-crm`. It needs no project roles. Open it, then **Keys** → **Add key** → **Create new key** → **JSON**. A file downloads. Keep it private: it is the password.
3. **Share both calendars with it**: in Google Calendar, signed in as `info@luxxautomotiveboutique.com`, open each of the two calendars → **Settings and sharing** → **Share with specific people** → **Add people**. Paste the service account's email (the `client_email` in the JSON file, like `the-lab-crm@your-project.iam.gserviceaccount.com`) and set **Make changes to events**.
4. **Give the CRM the key**: in the Supabase dashboard, **Edge Functions** → **Secrets**, add:

   | Name | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | the whole contents of the JSON file (or that file base64-encoded) |
   | `CRM_URL` | optional: `https://the-lab-crm.vercel.app`, put in event notes as a link back |

5. Open the CRM **Calendar**. The line under the title should read "Synced 9:14 a.m.". Use the **Google Calendar** button to sync again.

The calendar ids are built in. If a calendar is ever replaced, set `GOOGLE_CALENDAR_DETAILING_ID` or `GOOGLE_CALENDAR_ERIC_ID` to the new calendar's id (**Settings and sharing** → **Integrate calendar** → **Calendar ID**).

## How it behaves

- It runs when someone opens the Calendar (unless it ran in the last five minutes) and when **Google Calendar** is pressed. Nothing runs in the background, so a change made in Google appears in the CRM the next time the Calendar is opened or synced.
- It looks one week back and 120 days ahead.
- **THE LAB | Detailing Bay** events become Detailing Bay appointments; **THE LAB | Vehicle Customization** events become Eric appointments.
- An appointment that began in Google is owned by Google: edit it there. An appointment that began in the CRM can be edited in either place.
- Each run is logged in the `integration_events` table (source `google_calendar`), with the error if one failed.

## If something is wrong

| The Calendar says | What it means |
|---|---|
| Not connected yet | `GOOGLE_SERVICE_ACCOUNT_JSON` is not set on the Supabase project. |
| Google refused the service account key | The Google Calendar API is not enabled for that project, or the key was deleted. Make a new JSON key. |
| Google cannot open this calendar | That calendar is not shared with the service account email, or it was shared as "See all event details" only. Share it with **Make changes to events**. |
