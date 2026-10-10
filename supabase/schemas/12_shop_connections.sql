-- The store token from "Connect Shopify" (the shopify_connect function),
-- read by quote_checkout to make checkout links. Server-only: row level
-- security is on with no policies, so only the service role can read it.
-- Source of truth; migration 20261011150000_shop_connections.sql.
create table public.shop_connections (
    shop text primary key,
    access_token text not null,
    scope text,
    connected_at timestamp with time zone not null default now()
);

alter table public.shop_connections enable row level security;
revoke all on table public.shop_connections from anon, authenticated;
grant all on table public.shop_connections to service_role;
