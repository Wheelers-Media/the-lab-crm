-- Tag names are unique ignoring capitals and spacing; get_or_create_tag is
-- the one way to add a tag by name (see the 20261010120000 migration, which
-- merged the duplicates that existed before).

create or replace function public.normalize_tag_name(p_name text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'))
$function$;

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
