-- The secret in the customer's status link. Every job, old and new, gets 128
-- random bits; only the job_status function reads a job by it.
-- Mirrors supabase/schemas/01_tables.sql.
alter table public.deals
    add column if not exists status_token text not null default replace(gen_random_uuid()::text, '-', '') unique;
