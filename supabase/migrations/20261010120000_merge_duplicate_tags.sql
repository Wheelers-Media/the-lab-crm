-- Tags that differ only by capitals or spacing ("Shopify customer",
-- "shopify customer ", "Shopify  Customer") are one tag. Merge them into the
-- oldest, move every contact onto it, and stop new duplicates from appearing.

create or replace function public.normalize_tag_name(p_name text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
$function$;

-- Tidy stray spaces in the names people see
update public.tags
set name = regexp_replace(btrim(name), '\s+', ' ', 'g')
where name <> regexp_replace(btrim(name), '\s+', ' ', 'g');

-- Each duplicate and the oldest tag it folds into
create table public._tag_merge as
select t.id as old_id, k.keep_id
from public.tags t
join (
  select public.normalize_tag_name(name) as key, min(id) as keep_id
  from public.tags
  group by 1
) k on public.normalize_tag_name(t.name) = k.key
where t.id <> k.keep_id;

-- Point contacts at the kept tag, once each, in their original order
update public.contacts c
set tags = (
  select array_agg(s.tag_id order by s.pos)
  from (
    select coalesce(m.keep_id, x.id) as tag_id, min(x.pos) as pos
    from unnest(c.tags) with ordinality as x(id, pos)
    left join public._tag_merge m on m.old_id = x.id
    group by 1
  ) s
)
where c.tags && (select array_agg(old_id) from public._tag_merge);

delete from public.tags where id in (select old_id from public._tag_merge);

drop table public._tag_merge;

create unique index tags_name_normalized_key
  on public.tags (public.normalize_tag_name(name));

-- New and renamed tags get the same tidy spacing
create or replace function public.tidy_tag_name()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  return new;
end;
$function$;

create trigger tags_tidy_name before insert or update of name on public.tags
  for each row execute function public.tidy_tag_name();

-- The one way to add a tag by name: returns the existing tag when there is one
create or replace function public.get_or_create_tag(p_name text, p_color text)
 returns public.tags
 language plpgsql
 set search_path to ''
as $function$
declare
  v_tag public.tags;
begin
  insert into public.tags (name, color)
  values (p_name, p_color)
  on conflict ((public.normalize_tag_name(name))) do nothing;

  select * into v_tag
  from public.tags
  where public.normalize_tag_name(name) = public.normalize_tag_name(p_name)
  order by id
  limit 1;
  return v_tag;
end;
$function$;

revoke all on function public.get_or_create_tag(text, text) from public, anon;
grant execute on function public.get_or_create_tag(text, text) to authenticated, service_role;
grant execute on function public.normalize_tag_name(text) to authenticated, service_role;
