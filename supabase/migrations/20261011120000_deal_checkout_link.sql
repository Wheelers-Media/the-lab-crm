-- The latest Shopify checkout link created for a job's quote: url, draft
-- order, pay mode (parts now and labour at pickup, or everything now), the
-- amounts and whether Shopify emailed it. Written by the quote_checkout function.
-- Mirrors supabase/schemas/01_tables.sql.
alter table public.deals add column if not exists checkout jsonb;
