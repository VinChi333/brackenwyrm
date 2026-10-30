-- Brackenwyrm, Teil 10: Startseite.
-- Nach Teil 1 bis 9 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
--   Wie die Anmeldeseite von damals: Wer ist gerade in Moosgrund unterwegs, und wer hat zuletzt den Wyrm bezwungen?
--   Auch ohne Spielerkonto abrufbar. Gesperrte Helden erscheinen nicht.

create or replace function public.title_info()
returns table (online int, names text[], slayer text, slayer_gender text, slayer_at timestamptz)
language sql stable security definer set search_path = public as $$
  with o as (
    select f.name from public.fighters f
    where f.last_seen > now() - interval '5 minutes' and not f.banned
    order by f.last_seen desc
  ), s as (
    select f.name, f.gender, f.last_dk_at from public.fighters f
    where f.dragon_kills > 0 and not f.banned
    order by f.last_dk_at desc nulls last, f.dragon_kills desc, f.updated_at desc
    limit 1
  )
  select (select count(*)::int from o),
         coalesce((select array_agg(name) from (select name from o limit 3) x), '{}'),
         (select name from s), (select gender from s), (select last_dk_at from s)
$$;
revoke all on function public.title_info() from public;
grant execute on function public.title_info() to anon, authenticated;
