-- Where the Google Calendar event behind an appointment lives, so the calendar
-- can open it there (the event the appointment came from, or the one the sync
-- created). Written by the google_calendar_sync function.
-- Mirrors supabase/schemas/08_the_lab.sql.
alter table public.appointments add column if not exists external_url text;
