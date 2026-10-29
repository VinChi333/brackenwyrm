-- Brackenwyrm, Teil 9: Rückmeldungen.
-- Nach Teil 1 bis 8 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
--   Spieler schicken Rückmeldungen direkt aus dem Spiel, auch ohne Spielerkonto.
--   Die Wache liest sie unter "Die Wache → Rückmeldungen" und hakt sie ab.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null,
  hero       text not null default '',
  kinds      text not null default '',
  body       text not null,
  meta       text not null default '',
  done       boolean not null default false
);
create index if not exists feedback_recent on public.feedback (created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- Rückmeldung schicken (mit oder ohne Spielerkonto)
create or replace function public.send_feedback(kinds text, body text, meta text, hero text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := btrim(coalesce(send_feedback.body, ''));
begin
  if length(b) < 2 then raise exception 'Bitte schreib ein paar Worte dazu.' using errcode = 'P0001'; end if;
  -- Schutz vor Überflutung: mit Konto 10 pro Stunde, ohne Konto zusammen 60 pro Stunde
  if me is not null and (select count(*) from public.feedback f where f.user_id = me and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Du hast gerade schon viele Rückmeldungen geschickt. Danke! Probier es später wieder.' using errcode = 'P0001';
  end if;
  if me is null and (select count(*) from public.feedback f where f.user_id is null and f.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Gerade kommen sehr viele Rückmeldungen an. Probier es später wieder.' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, hero, kinds, body, meta)
  values (me, left(coalesce(send_feedback.hero, ''), 40), left(coalesce(send_feedback.kinds, ''), 200), left(b, 4000), left(coalesce(send_feedback.meta, ''), 8000));
end $$;

-- Wache: Rückmeldungen lesen (offene zuerst)
create or replace function public.mod_feedback(only_open boolean)
returns table (id bigint, created_at timestamptz, hero text, account text, kinds text, body text, meta text, done boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  return query select f.id, f.created_at, f.hero, coalesce(x.name, ''), f.kinds, f.body, f.meta, f.done
    from public.feedback f left join public.fighters x on x.user_id = f.user_id
    where not only_open or not f.done
    order by f.done, f.created_at desc limit 200;
end $$;

-- Wache: abhaken oder wieder öffnen
create or replace function public.mod_feedback_done(fid bigint, flag boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  update public.feedback set done = flag where id = fid;
end $$;

revoke all on function public.send_feedback(text, text, text, text), public.mod_feedback(boolean), public.mod_feedback_done(bigint, boolean) from public;
grant execute on function public.send_feedback(text, text, text, text) to anon, authenticated;
grant execute on function public.mod_feedback(boolean), public.mod_feedback_done(bigint, boolean) to authenticated;
