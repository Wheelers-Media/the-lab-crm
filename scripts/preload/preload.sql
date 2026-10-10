-- Shopify preload: loads customers, orders and open carts into the CRM.
-- Installed into a throwaway "lab_preload" schema by scripts/preload/run.ts,
-- called batch by batch, then dropped. Safe to run again:
--   * customers match by email, then phone (the same rule as the webhook);
--     existing customers only gain missing details, nothing is overwritten
--   * orders are keyed on the Shopify order id; known orders are updated,
--     new ones also get the "Shopify order" note the webhook writes
--   * carts are keyed on the checkout token and never create customers
-- Profile columns from the vehicles migration (SMS consent, lead source,
-- city, province) are filled only when they exist, so this runs before or
-- after that migration.

create schema if not exists lab_preload;

create or replace function lab_preload.digits(p text) returns text
language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10)
$$;

create or replace function lab_preload.find_contact(p_email text, p_phone text)
returns bigint language sql stable as $$
  select id from (
    select c.id, 1 as rank from public.contacts c
    where coalesce(p_email, '') <> ''
      and exists (select 1 from jsonb_array_elements(coalesce(c.email_jsonb, '[]'::jsonb)) e
                  where lower(e->>'email') = lower(p_email))
    union all
    select c.id, 2 from public.contacts c
    where length(lab_preload.digits(p_phone)) = 10
      and exists (select 1 from jsonb_array_elements(coalesce(c.phone_jsonb, '[]'::jsonb)) e
                  where lab_preload.digits(e->>'number') = lab_preload.digits(p_phone))
  ) m order by rank, id limit 1
$$;

create or replace function lab_preload.tag_ids(p_names text[]) returns bigint[]
language plpgsql as $$
declare
  v_ids bigint[] := '{}';
  v_id bigint;
  v_name text;
  v_colors text[] := array['#bcd4e6', '#c5dedd', '#fde2e4', '#e2ece9', '#fff1e6', '#dfe7fd'];
begin
  foreach v_name in array coalesce(p_names, '{}') loop
    select id into v_id from public.tags where name = v_name order by id limit 1;
    if v_id is null then
      insert into public.tags (name, color)
      values (v_name, v_colors[1 + (abs(hashtext(v_name)) % array_length(v_colors, 1))])
      returning id into v_id;
    end if;
    v_ids := v_ids || v_id;
    v_id := null;
  end loop;
  return v_ids;
end $$;

create or replace function lab_preload.has_column(p_column text) returns boolean
language sql stable as $$
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'contacts' and column_name = p_column)
$$;

-- Adds what Shopify knows and the CRM does not; never overwrites.
create or replace function lab_preload.enrich_contact(p_id bigint, c jsonb, p_tags bigint[], p_seen timestamptz)
returns void language plpgsql as $$
declare
  v_email text := nullif(c->>'email', '');
  v_phone text := nullif(c->>'phone', '');
begin
  update public.contacts set
    first_name = coalesce(nullif(first_name, ''), nullif(c->>'firstName', '')),
    last_name = case when coalesce(last_name, '') = '' or last_name in (v_email, v_phone)
                     then coalesce(nullif(c->>'lastName', ''), last_name) else last_name end,
    email_jsonb = case when v_email is not null and not exists (
                    select 1 from jsonb_array_elements(coalesce(email_jsonb, '[]'::jsonb)) e
                    where lower(e->>'email') = lower(v_email))
                  then coalesce(email_jsonb, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Home'))
                  else email_jsonb end,
    phone_jsonb = case when v_phone is not null and not exists (
                    select 1 from jsonb_array_elements(coalesce(phone_jsonb, '[]'::jsonb)) e
                    where lab_preload.digits(e->>'number') = lab_preload.digits(v_phone))
                  then coalesce(phone_jsonb, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('number', v_phone, 'type', 'Home'))
                  else phone_jsonb end,
    background = coalesce(nullif(background, ''), nullif(c->>'note', '')),
    has_newsletter = coalesce(has_newsletter, false) or coalesce((c->>'emailMarketing')::boolean, false),
    tags = (select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(tags, '{}') || coalesce(p_tags, '{}')) t),
    first_seen = least(coalesce(first_seen, p_seen), p_seen),
    last_seen = greatest(coalesce(last_seen, p_seen), p_seen)
  where id = p_id;

  if lab_preload.has_column('lead_source') then
    execute $q$update public.contacts set
        lead_source = coalesce(lead_source, 'shopify'),
        city = coalesce(nullif(city, ''), nullif($2->>'city', '')),
        province = coalesce(nullif(province, ''), nullif($2->>'province', '')),
        sms_consent_at = case when not sms_consent and coalesce(($2->>'smsMarketing')::boolean, false)
                              then now() else sms_consent_at end,
        sms_consent = sms_consent or coalesce(($2->>'smsMarketing')::boolean, false)
      where id = $1$q$ using p_id, c;
  end if;
end $$;

create or replace function lab_preload.company_id(p_name text) returns bigint
language plpgsql as $$
declare v_id bigint;
begin
  if coalesce(trim(p_name), '') = '' then return null; end if;
  select id into v_id from public.companies where lower(name) = lower(trim(p_name)) order by id limit 1;
  if v_id is null then
    insert into public.companies (name, sales_id) values (trim(p_name), public.lab_default_sales_id())
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- c: { email, phone, firstName, lastName, company?, note?, ... }
create or replace function lab_preload.upsert_contact(c jsonb, p_tags bigint[], p_seen timestamptz, out o_id bigint, out o_created boolean)
language plpgsql as $$
declare
  v_email text := nullif(c->>'email', '');
  v_phone text := nullif(c->>'phone', '');
begin
  o_created := false;
  o_id := lab_preload.find_contact(v_email, v_phone);
  if o_id is null then
    if v_email is null and v_phone is null then return; end if;
    insert into public.contacts (first_name, last_name, email_jsonb, phone_jsonb, tags,
                                 first_seen, last_seen, has_newsletter, sales_id)
    values (coalesce(c->>'firstName', ''),
            coalesce(nullif(c->>'lastName', ''), v_email, v_phone),
            case when v_email is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Home')) end,
            case when v_phone is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('number', v_phone, 'type', 'Home')) end,
            '{}', p_seen, p_seen, false, public.lab_default_sales_id())
    returning id into o_id;
    o_created := true;
  end if;
  perform lab_preload.enrich_contact(o_id, c, p_tags, p_seen);
  if nullif(c->>'company', '') is not null then
    update public.contacts set company_id = lab_preload.company_id(c->>'company')
    where id = o_id and company_id is null;
  end if;
end $$;

create or replace function lab_preload.load_customers(p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v record;
  v_tags bigint[] := lab_preload.tag_ids(array['Shopify customer']);
  v_created int := 0; v_updated int := 0; v_skipped int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    select * into v from lab_preload.upsert_contact(
      r, v_tags, coalesce(nullif(r->>'createdAt', '')::timestamptz, now()));
    if v.o_id is null then v_skipped := v_skipped + 1;
    elsif v.o_created then v_created := v_created + 1;
    else v_updated := v_updated + 1; end if;
  end loop;
  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end $$;

create or replace function lab_preload.load_orders(p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v record;
  v_order_id bigint;
  v_contact bigint;
  v_tags bigint[];
  v_new int := 0; v_known int := 0; v_contacts int := 0; v_no_contact int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    select id, contact_id into v_order_id, v_contact
    from public.orders where shopify_order_id = r->>'shopifyOrderId';

    v_tags := lab_preload.tag_ids(array['Shopify customer'] ||
      array(select jsonb_array_elements_text(coalesce(r->'categories', '[]'::jsonb))));
    select * into v from lab_preload.upsert_contact(r->'contact', v_tags, (r->>'orderedAt')::timestamptz);
    if v.o_created then v_contacts := v_contacts + 1; end if;
    if v.o_id is null then v_no_contact := v_no_contact + 1; end if;

    if v_order_id is not null then
      update public.orders set
        financial_status = r->>'financialStatus',
        refunded_amount = (r->>'refundedAmount')::numeric,
        cancelled_at = nullif(r->>'cancelledAt', '')::timestamptz,
        contact_id = coalesce(contact_id, v.o_id)
      where id = v_order_id;
      v_known := v_known + 1;
    else
      insert into public.orders (shopify_order_id, order_number, contact_id, source,
        financial_status, fulfillment_status, currency, subtotal, total, refunded_amount,
        line_items, categories, is_deposit, ordered_at, cancelled_at, sales_id)
      values (r->>'shopifyOrderId', r->>'orderNumber', v.o_id, nullif(r->>'source', ''),
        nullif(r->>'financialStatus', ''), nullif(r->>'fulfillmentStatus', ''),
        coalesce(nullif(r->>'currency', ''), 'CAD'), (r->>'subtotal')::numeric,
        (r->>'total')::numeric, (r->>'refundedAmount')::numeric,
        coalesce(r->'lineItems', '[]'::jsonb),
        array(select jsonb_array_elements_text(coalesce(r->'categories', '[]'::jsonb))),
        coalesce((r->>'isDeposit')::boolean, false), (r->>'orderedAt')::timestamptz,
        nullif(r->>'cancelledAt', '')::timestamptz, public.lab_default_sales_id());
      if v.o_id is not null then
        insert into public.contact_notes (contact_id, text, date, sales_id)
        values (v.o_id, r->>'noteText', (r->>'orderedAt')::timestamptz, public.lab_default_sales_id());
      end if;
      v_new := v_new + 1;
    end if;
  end loop;
  return jsonb_build_object('new', v_new, 'updated', v_known,
                            'customers_created', v_contacts, 'without_customer', v_no_contact);
end $$;

create or replace function lab_preload.load_checkouts(p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v_new int := 0; v_known int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.shopify_checkouts (checkout_token, contact_id, email, phone, customer_name,
      total, line_items, recovery_url, completed_at, checkout_updated_at)
    values (r->>'token',
      lab_preload.find_contact(r->'contact'->>'email', r->'contact'->>'phone'),
      nullif(r->'contact'->>'email', ''), nullif(r->'contact'->>'phone', ''),
      nullif(r->>'customerName', ''), (r->>'total')::numeric,
      coalesce(r->'lineItems', '[]'::jsonb), nullif(r->>'recoveryUrl', ''),
      nullif(r->>'completedAt', '')::timestamptz, (r->>'updatedAt')::timestamptz)
    on conflict (checkout_token) do nothing;
    if found then v_new := v_new + 1; else v_known := v_known + 1; end if;
  end loop;
  return jsonb_build_object('new', v_new, 'already_there', v_known);
end $$;

-- Catalog: Shopify owns it, so known products are overwritten
create or replace function lab_preload.load_packages(p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v_inserted boolean;
  v_new int := 0; v_updated int := 0;
begin
  if to_regclass('public.packages') is null then
    return jsonb_build_object('skipped', jsonb_array_length(p_rows));
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.packages (shopify_product_id, title, shopify_title, vendor, category, bay,
      price, price_max, variants, status, shopify_updated_at, synced_at,
      kind, product_type, handle, image_url, inventory)
    values (r->>'shopify_product_id', r->>'title', r->>'shopify_title', r->>'vendor',
      r->>'category', r->>'bay', (r->>'price')::numeric, (r->>'price_max')::numeric,
      coalesce(r->'variants', '[]'::jsonb), r->>'status',
      nullif(r->>'shopify_updated_at', '')::timestamptz, now(),
      coalesce(r->>'kind', 'package'), r->>'product_type', r->>'handle', r->>'image_url',
      (r->>'inventory')::integer)
    on conflict (shopify_product_id) do update set
      title = excluded.title, shopify_title = excluded.shopify_title, vendor = excluded.vendor,
      category = excluded.category, bay = excluded.bay, price = excluded.price,
      price_max = excluded.price_max, variants = excluded.variants, status = excluded.status,
      shopify_updated_at = excluded.shopify_updated_at, synced_at = now(),
      kind = excluded.kind, product_type = excluded.product_type, handle = excluded.handle,
      image_url = excluded.image_url, inventory = excluded.inventory
    returning (xmax = 0) into v_inserted;
    if v_inserted then v_new := v_new + 1; else v_updated := v_updated + 1; end if;
  end loop;
  return jsonb_build_object('new', v_new, 'updated', v_updated);
end $$;
