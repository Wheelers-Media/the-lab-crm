-- Shop floor: where a vehicle is once it has arrived (in the shop, waiting on
-- parts, ready for pickup, picked up), when that last changed, and three
-- follow-up rules built on it (pickup reminder, parts delay, review request).
-- Mirrors supabase/schemas/01_tables.sql and 08_the_lab.sql. Jobs without a
-- work status are untouched, so nothing changes until the board is used.
alter table public.deals add column if not exists work_status text;
alter table public.deals add column if not exists work_status_changed_at timestamp with time zone;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_work_status_check') then
    alter table public.deals
      add constraint deals_work_status_check check (work_status is null or work_status in ('in_shop', 'waiting_parts', 'ready', 'picked_up'));
  end if;
end
$do$;

create or replace function public.track_work_status()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.work_status is not null then
      new.work_status_changed_at := coalesce(new.work_status_changed_at, now());
    end if;
    return new;
  end if;
  if new.work_status is distinct from old.work_status then
    new.work_status_changed_at := case when new.work_status is null then null else now() end;
  end if;
  return new;
end;
$function$;

drop trigger if exists deals_track_work_status on public.deals;
create trigger deals_track_work_status before insert or update of work_status on public.deals
    for each row execute function public.track_work_status();
create index if not exists deals_work_status_idx on public.deals (work_status) where work_status is not null;

create or replace function public.run_automations()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
  v_count integer := 0;
begin
  -- 1. Quote sent 3+ days ago with no movement: first follow-up
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'quoted' and d.archived_at is null
      and d.stage_changed_at < now() - interval '3 days'
  loop
    if public.lab_add_task('quote-follow-up-1', r.id, r.contact_id, 'follow-up',
        'Follow up on quote: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 2. Still no movement 7+ days after the quote: second follow-up
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'quoted' and d.archived_at is null
      and d.stage_changed_at < now() - interval '7 days'
      and exists (select 1 from public.automation_log a where a.rule = 'quote-follow-up-1' and a.subject_id = d.id)
  loop
    if public.lab_add_task('quote-follow-up-2', r.id, r.contact_id, 'follow-up',
        'Second follow-up on quote: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 3. Quiet 10+ days after the quote and two follow-ups: suggest Not now
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'quoted' and d.archived_at is null
      and d.stage_changed_at < now() - interval '10 days'
      and exists (select 1 from public.automation_log a where a.rule = 'quote-follow-up-2' and a.subject_id = d.id)
  loop
    if public.lab_add_task('quote-not-now', r.id, r.contact_id, 'follow-up',
        'No reply after two follow-ups. Move to Not now? ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 4. Booked 2+ days ago and the deposit is still unpaid (an appointment the
  -- Shopify deposit order was matched to is marked paid and skips it)
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'booked' and d.archived_at is null
      and d.stage_changed_at < now() - interval '2 days'
      and not exists (
        select 1 from public.appointments a
        where a.deal_id = d.id and a.deposit_paid and a.status in ('booked', 'completed')
      )
  loop
    if public.lab_add_task('deposit-reminder', r.id, r.contact_id, 'deposit',
        'Deposit not paid yet: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 5. Website booking request, but no booking after a day
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'qualified' and d.archived_at is null and d.lead_source = 'website'
      and d.stage_changed_at < now() - interval '1 day'
      and not exists (select 1 from public.appointments a where a.deal_id = d.id)
  loop
    if public.lab_add_task('booking-not-finished', r.id, r.contact_id, 'call',
        'Started booking online but did not pick a time: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 6. Checkout over $2,000 left unpaid for an hour: Eric calls
  for r in
    select c.id, c.contact_id, c.total, c.customer_name
    from public.shopify_checkouts c
    where c.completed_at is null and c.task_id is null and c.total >= 2000
      and c.checkout_updated_at < now() - interval '1 hour'
      and c.checkout_updated_at > now() - interval '14 days'
  loop
    if public.lab_add_task('abandoned-cart', r.id, r.contact_id, 'call',
        'Abandoned cart $' || to_char(r.total, 'FM999,999,990.00') || '. Call about the order.', null) is not null then
      update public.shopify_checkouts set task_id =
        (select a.task_id from public.automation_log a where a.rule = 'abandoned-cart' and a.subject_id = r.id)
      where id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;

  -- 7. Ready for pickup for 2+ days: the customer has not come yet
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.work_status = 'ready' and d.archived_at is null
      and d.work_status_changed_at < now() - interval '2 days'
  loop
    if public.lab_add_task('pickup-reminder', r.id, r.contact_id, 'pickup',
        'Ready for pickup for 2 days. Check when they are coming: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 8. Waiting on parts for 5+ days: check the ETA and tell the customer
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.work_status = 'waiting_parts' and d.archived_at is null
      and d.work_status_changed_at < now() - interval '5 days'
  loop
    if public.lab_add_task('parts-delay', r.id, r.contact_id, 'follow-up',
        'Waiting on parts for 5 days. Check the ETA and update the customer: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 9. Picked up a day ago (within the last month): ask for a Google review
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.work_status = 'picked_up' and d.archived_at is null
      and d.work_status_changed_at < now() - interval '1 day'
      and d.work_status_changed_at > now() - interval '30 days'
  loop
    if public.lab_add_task('review-request', r.id, r.contact_id, 'text',
        'Ask for a Google review: ' || r.name, r.sales_id) is not null then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$function$;
