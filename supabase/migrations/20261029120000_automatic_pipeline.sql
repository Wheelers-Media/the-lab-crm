-- The pipeline moves itself: bookings, deposits and payments move jobs from
-- Intake to Booked to Converted, and a payment around the booking day marks
-- the visit done (see lab_sync_pipeline in schemas/08_the_lab.sql).
-- run_automations calls it first, every 15 minutes and whenever Home loads,
-- and stops sending deposit reminders for phone and walk-in bookings.

--
-- The pipeline moves itself (lab_sync_pipeline, called by run_automations).
-- A booking puts the customer's job in Booked (starting the job when there
-- is none), a deposit does the same, a payment around the booking day marks
-- the visit done, and a payment after a visit converts the job. Every move
-- leaves a note on the job saying what moved it.
--

-- What a job started from a booking is called, best guess first: a line
-- of the notes that names the work ("De-LUXX", "Standard detail"), the
-- service in a Cal.com title ("Jordan Shuman: Detailing drop-off"), a title
-- that names the work ("Chris Burke PPF"), the first plain line of the notes,
-- and last which calendar it is on.
create or replace function public.lab_job_name(p_title text, p_notes text, p_vehicle text, p_resource text)
 returns text
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare
  v_work constant text := '(detail|de-?luxx|tint|ppf|delete|egr|tun(e|ing)|correction|install|light|exhaust|maint|ceramic|coating|wrap|ecm|tcm|standard|signature)';
  v_line text;
  v_plain text;
begin
  for v_line in select btrim(l) from regexp_split_to_table(coalesce(p_notes, ''), '\n') as l loop
    continue when v_line = '' or v_line ~ '^=+$';
    continue when p_vehicle is not null and lower(v_line) = lower(btrim(p_vehicle));
    continue when v_line ~ '^\+?[0-9() .-]{7,}$';
    continue when v_line ~* '^(phone|email|vehicle|request type)\s*:';
    continue when v_line ~ '^(19|20)[0-9]{2}\s';
    -- A heading in capitals ("VEHICLE & SERVICE DETAILS") is not the work
    continue when v_line !~ '[a-z]';
    -- "Service: De-LUXX Signature" -> "De-LUXX Signature"
    v_line := btrim(regexp_replace(v_line, '^[A-Za-z ]{2,20}:-?\s*', ''));
    continue when v_line = '';
    if v_line ~* v_work then
      return left(v_line, 120);
    end if;
    v_plain := coalesce(v_plain, v_line);
  end loop;
  if position(':' in coalesce(p_title, '')) > 0 and btrim(split_part(p_title, ':', 2)) <> '' then
    return left(btrim(split_part(p_title, ':', 2)), 120);
  end if;
  if coalesce(p_title, '') ~* v_work then
    return left(btrim(p_title), 120);
  end if;
  if v_plain is not null then
    return left(v_plain, 120);
  end if;
  return case when p_resource = 'detailing-bay' then 'Detailing bay booking' else 'Booking with Eric' end;
end;
$function$;

-- The job's kind of work, from the words in the booking (same values as the
-- deal categories in the app's settings).
create or replace function public.lab_job_category(p_text text, p_resource text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when p_text ~* 'tint' then 'window-tint'
    when p_text ~* '(delete|egr|tun(e|ing|er)|straight pipe|exhaust|cummins|duramax|powerstroke|grid heater|ecm|tcm)' then 'tuning'
    when p_text ~* '(detail|de-?luxx|maint|correction|standard|signature)' then 'detailing'
    when p_text ~* '(light bar|lighting|headlight|lights)' then 'lighting'
    when p_text ~* '(ppf|install|wir(e|ing)|bumper|lift|level)' then 'install'
    when p_text ~* '(wash|clean|interior|engine bay)' then 'detailing'
    when p_resource = 'detailing-bay' then 'detailing'
    else null
  end
$function$;

create or replace function public.lab_sync_pipeline()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
  v_deal record;
  v_deal_id bigint;
  v_rows integer;
  v_count integer := 0;
  v_tz constant text := 'America/Dawson_Creek';
  v_sales_id bigint := public.lab_default_sales_id();
begin
  -- 1. A booking for a known customer puts their job in Booked: the open job
  -- they already have, or a new one. Bookings from the last two weeks on, so
  -- past bookings brought in from Google do not fill the board with old jobs.
  for r in
    select a.id, a.contact_id, a.title, a.notes, a.vehicle, a.vehicle_id,
           a.resource, a.source, a.start_at
    from public.appointments a
    where a.contact_id is not null and a.deal_id is null
      and a.status in ('booked', 'completed')
      and a.start_at >= now() - interval '14 days'
    order by a.start_at
  loop
    select d.id, d.stage into v_deal
    from public.deals d
    where d.contact_ids @> array[r.contact_id] and d.archived_at is null
      and d.stage in ('intake', 'qualified', 'quoted', 'booked')
    order by d.updated_at desc
    limit 1;

    if found then
      v_deal_id := v_deal.id;
      update public.appointments set deal_id = v_deal_id where id = r.id;
      if v_deal.stage <> 'booked' then
        update public.deals set stage = 'booked', updated_at = now() where id = v_deal_id;
        insert into public.deal_notes (deal_id, text, date, sales_id)
        values (v_deal_id, 'Moved to Booked automatically: booked for '
          || to_char(r.start_at at time zone v_tz, 'Dy Mon FMDD, FMHH12:MI am') || '.', now(), v_sales_id);
      end if;
    else
      insert into public.deals (name, contact_ids, stage, category, amount, lead_source,
                                vehicle_id, description, expected_closing_date, sales_id, index)
      values (public.lab_job_name(r.title, r.notes, r.vehicle, r.resource),
              array[r.contact_id], 'booked',
              public.lab_job_category(coalesce(r.title, '') || ' ' || coalesce(r.notes, ''), r.resource),
              0,
              case when r.source in ('google', 'manual') then 'calendar' else r.source end,
              r.vehicle_id, nullif(btrim(coalesce(r.notes, '')), ''),
              (r.start_at at time zone v_tz)::date, v_sales_id, 0)
      returning id into v_deal_id;
      update public.appointments set deal_id = v_deal_id where id = r.id;
      insert into public.deal_notes (deal_id, text, date, sales_id)
      values (v_deal_id, 'Started automatically from the booking "' || r.title || '" for '
        || to_char(r.start_at at time zone v_tz, 'Dy Mon FMDD, FMHH12:MI am') || '.', now(), v_sales_id);
    end if;
    v_count := v_count + 1;
  end loop;

  -- 2. A booking deposit paid: the customer's open job is Booked
  for r in
    select o.id, o.contact_id, o.order_number
    from public.orders o
    where o.is_deposit and o.cancelled_at is null and o.contact_id is not null
      and o.ordered_at >= now() - interval '14 days'
  loop
    for v_deal in
      select d.id from public.deals d
      where d.contact_ids @> array[r.contact_id] and d.archived_at is null
        and d.stage in ('intake', 'qualified', 'quoted')
    loop
      update public.deals set stage = 'booked', updated_at = now() where id = v_deal.id;
      insert into public.deal_notes (deal_id, text, date, sales_id)
      values (v_deal.id, 'Moved to Booked automatically: deposit paid (order '
        || r.order_number || ').', now(), v_sales_id);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- 3. Paid on the booking day or within three days after (a job that takes
  -- a few days is paid at pickup): the customer showed up. Covers past
  -- bookings brought in from Google too, so profiles show them as done.
  update public.appointments a
  set status = 'completed'
  where a.status = 'booked' and a.contact_id is not null and a.start_at < now()
    and exists (
      select 1 from public.orders o
      where o.contact_id = a.contact_id and not o.is_deposit and o.cancelled_at is null
        and (o.ordered_at at time zone v_tz)::date
            between (a.start_at at time zone v_tz)::date
                and (a.start_at at time zone v_tz)::date + 3
    );
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- 4. Paid after a visit: the booked job is Converted, with the amount paid
  -- when the job had none, and its visit is marked done
  for r in
    select o.id, o.contact_id, o.order_number, o.ordered_at,
           coalesce(o.subtotal, o.total) as amount, o.total
    from public.orders o
    where not o.is_deposit and o.cancelled_at is null and o.contact_id is not null
      and o.deal_id is null
      and o.ordered_at >= now() - interval '14 days'
    order by o.ordered_at
  loop
    select d.id, d.amount into v_deal
    from public.deals d
    where d.contact_ids @> array[r.contact_id] and d.archived_at is null
      and d.stage = 'booked'
      and exists (
        select 1 from public.appointments a
        where a.deal_id = d.id and a.status in ('booked', 'completed')
          and (a.start_at at time zone v_tz)::date <= (r.ordered_at at time zone v_tz)::date
      )
    order by d.updated_at desc
    limit 1;
    continue when not found;

    update public.orders set deal_id = v_deal.id where id = r.id;
    update public.deals
    set stage = 'won',
        amount = case when coalesce(amount, 0) = 0 then round(r.amount)::bigint else amount end,
        updated_at = now()
    where id = v_deal.id;
    update public.appointments
    set status = 'completed'
    where deal_id = v_deal.id and status = 'booked' and start_at < now();
    insert into public.deal_notes (deal_id, text, date, sales_id)
    values (v_deal.id, 'Moved to Converted automatically: paid $'
      || to_char(r.total, 'FM999,999,990.00') || ' (order ' || r.order_number || ').', now(), v_sales_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.lab_sync_pipeline() from public, anon, authenticated;
grant execute on function public.lab_sync_pipeline() to service_role;

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
  -- 0. Move jobs through the pipeline from bookings, deposits and payments
  v_count := v_count + public.lab_sync_pipeline();

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
  -- Shopify deposit order was matched to is marked paid and skips it). Jobs
  -- started from a booking typed into the calendar are left out: those are
  -- phone and walk-in bookings, which do not take an online deposit.
  for r in
    select d.id, d.name, d.contact_ids[1] as contact_id, d.sales_id
    from public.deals d
    where d.stage = 'booked' and d.archived_at is null
      and d.lead_source is distinct from 'calendar'
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
