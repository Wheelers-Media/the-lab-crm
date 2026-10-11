-- Links a $50 deposit order to the booking it paid for, so the CRM can tell
-- which deposits still wait for their booking (and the other way round).
-- Written by shopify_webhook and calcom_webhook. Mirrors
-- supabase/schemas/08_the_lab.sql.
alter table public.orders add column if not exists appointment_id bigint;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_appointment_id_fkey') then
    alter table public.orders
      add constraint orders_appointment_id_fkey foreign key (appointment_id) references public.appointments(id) on delete set null;
  end if;
end
$do$;

create index if not exists orders_appointment_id_idx on public.orders (appointment_id);
