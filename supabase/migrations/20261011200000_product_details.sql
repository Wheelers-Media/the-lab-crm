-- Product details for the product page and cards: the description as plain
-- text, up to eight images and the tags. Filled by the product webhook and the
-- "Sync from Shopify" action (catalog_sync). Variant details (compare-at
-- price, weight, cost) live in the existing variants JSON.
-- Mirrors supabase/schemas/10_packages.sql.
alter table public.packages add column if not exists description text;
alter table public.packages add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.packages add column if not exists tags text[] not null default '{}';

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'packages_images_is_array') then
    alter table public.packages
      add constraint packages_images_is_array check (jsonb_typeof(images) = 'array');
  end if;
end
$do$;
