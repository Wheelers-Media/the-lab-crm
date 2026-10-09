-- Automatic tasks (follow-ups, deposit reminders, abandoned carts) belong to
-- the shop account that Eric and Christine use, falling back to the first
-- active admin while that account does not exist yet.
create or replace function public.lab_default_sales_id()
 returns bigint
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select id from public.sales
  where not disabled
  order by (lower(email) = 'info@luxxautomotiveboutique.com') desc, administrator desc, id
  limit 1
$function$;
