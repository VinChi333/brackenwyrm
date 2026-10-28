-- Brackenwyrm, Teil 3: Kriegerliste, Steckbriefe, Briefe und Spuken (wie im Original).
-- Nach Teil 1 und Teil 2 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
-- Hinweis: Wer diesen Teil erneut ausführt, führt danach auch Teil 6 und Teil 7 erneut aus.

-- ---------------------------------------------------------------------------------------------
-- Steckbrief (wie die Bio im Original): eigener Text, Reittier und Ehepartner, für alle sichtbar.
alter table public.fighters add column if not exists bio text not null default '' check (char_length(bio) <= 400);
alter table public.fighters add column if not exists mount text not null default '';
alter table public.fighters add column if not exists married_to text not null default '';
grant insert (bio, mount, married_to) on public.fighters to authenticated;
grant update (bio, mount, married_to) on public.fighters to authenticated;

-- Kriegerliste: alle Helden mit öffentlichen Angaben. Gold, Erfahrung und Kampfwerte bleiben geheim.
drop function if exists public.warriors();
create or replace function public.warriors()
returns table (user_id uuid, name text, gender text, level int, race text, specialty text, dragon_kills int, alive boolean, online boolean, in_inn boolean, last_seen timestamptz,
               bio text, mount text, married_to text, days_played int)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.name, f.gender, f.level, f.race, f.specialty, f.dragon_kills, f.alive,
         f.last_seen > now() - interval '5 minutes', f.in_inn, f.last_seen,
         f.bio, f.mount, f.married_to, f.days_played
  from public.fighters f
  order by f.dragon_kills desc, f.level desc, f.name
  limit 300
$$;
revoke all on function public.warriors() from public, anon;
grant execute on function public.warriors() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Briefe. Jeder liest nur seine eigenen; der Absendername kommt vom Server, damit sich niemand als jemand anderes ausgibt.
create table if not exists public.mail (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  from_user  uuid references auth.users(id) on delete set null default auth.uid(),
  from_name  text not null default '',
  to_user    uuid not null references auth.users(id) on delete cascade,
  subject    text not null default '' check (char_length(subject) <= 60),
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  seen       boolean not null default false
);
create index if not exists mail_inbox on public.mail (to_user, created_at desc);
alter table public.mail enable row level security;
drop policy if exists "Briefe lesen (eigene)" on public.mail;
drop policy if exists "Briefe schreiben" on public.mail;
drop policy if exists "Briefe als gelesen markieren" on public.mail;
drop policy if exists "Briefe wegwerfen" on public.mail;
create policy "Briefe lesen (eigene)"        on public.mail for select to authenticated using (to_user = auth.uid());
create policy "Briefe schreiben"             on public.mail for insert to authenticated with check (from_user = auth.uid());
create policy "Briefe als gelesen markieren" on public.mail for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());
create policy "Briefe wegwerfen"             on public.mail for delete to authenticated using (to_user = auth.uid());
revoke all on public.mail from anon, authenticated;
grant select on public.mail to authenticated;
grant insert (to_user, subject, body) on public.mail to authenticated;
grant update (seen) on public.mail to authenticated;
grant delete on public.mail to authenticated;

create or replace function public.mail_prepare() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  -- Briefe vom Spiel selbst (z. B. von Morwen beim Spuken): Absender bleibt wie angegeben.
  if current_setting('bw.system_mail', true) = 'on' then
    new.created_at := now(); new.seen := false;
    return new;
  end if;
  new.from_user := auth.uid();
  select public.f_title(dragon_kills, gender) || ' ' || name into who from public.fighters where user_id = new.from_user;
  if who is null then raise exception 'Erst einmal spielen, dann schreiben.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.fighters where user_id = new.to_user) then
    raise exception 'Diesen Helden gibt es nicht.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mail where from_user = new.from_user and created_at > now() - interval '5 seconds') then
    raise exception 'Nicht so schnell. Der Bote ist noch unterwegs.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.mail where from_user = new.from_user and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Für heute hast du genug Briefe geschrieben.' using errcode = 'P0001';
  end if;
  new.from_name := who;
  new.subject := btrim(new.subject);
  new.body := btrim(new.body);
  new.seen := false;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists mail_prepare on public.mail;
create trigger mail_prepare before insert on public.mail for each row execute function public.mail_prepare();

-- Höchstens 100 Briefe pro Postfach: die ältesten verschwinden.
create or replace function public.mail_trim() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.mail where to_user = new.to_user and id not in (
    select id from public.mail where to_user = new.to_user order by created_at desc, id desc limit 100);
  return null;
end $$;
drop trigger if exists mail_trim on public.mail;
create trigger mail_trim after insert on public.mail for each row execute function public.mail_trim();

-- ---------------------------------------------------------------------------------------------
-- Spuken (wie im Original): Tote können mit 25 Gunst einen lebenden Helden heimsuchen.
-- Erfolg, wenn Zufall(0..eigene Stufe) > Zufall(0..Stufe des Opfers). Das Opfer verliert am nächsten Morgen Waldkämpfe.
-- Jeder kann pro Tag nur einmal heimgesucht werden; jeder Geist darf höchstens 4-mal am Tag spuken (100 Gunst).
alter table public.pvp_events drop constraint if exists pvp_events_kind_check;
alter table public.pvp_events add constraint pvp_events_kind_check check (kind in ('slain', 'defended', 'haunted', 'transfer'));
alter table public.fighters add column if not exists haunted_at timestamptz;

create table if not exists public.hauntings (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  target     uuid not null references auth.users(id) on delete cascade,
  success    boolean not null
);
create index if not exists hauntings_recent on public.hauntings (user_id, created_at desc);
alter table public.hauntings enable row level security;
revoke all on public.hauntings from anon, authenticated;

create or replace function public.haunt(target uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.fighters;
  t  public.fighters;
  ok boolean;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if me.alive then raise exception 'Nur Tote können spuken.' using errcode = 'P0001'; end if;
  if (select count(*) from public.hauntings h where h.user_id = me.user_id and h.created_at::date = current_date) >= 4 then
    raise exception 'Morwen hat für heute genug von deinem Gespuke.' using errcode = 'P0001';
  end if;
  select * into t from public.fighters f where f.user_id = target for update;
  if t.user_id is null or t.user_id = me.user_id then raise exception 'Diesen Helden findest du nicht.' using errcode = 'P0001'; end if;
  if not t.alive then raise exception '% ist selbst bei Morwen.', t.name using errcode = 'P0001'; end if;
  if t.haunted_at is not null and t.haunted_at::date = current_date then
    raise exception '% wurde heute schon heimgesucht. Such dir jemand anderen.', t.name using errcode = 'P0001';
  end if;

  ok := floor(random() * (me.level + 1)) > floor(random() * (t.level + 1));
  insert into public.hauntings (user_id, target, success) values (me.user_id, t.user_id, ok);
  if ok then
    update public.fighters set haunted_at = now() where user_id = t.user_id;
    insert into public.pvp_events (user_id, kind, other_name, place) values (t.user_id, 'haunted', me.name, 'schattenreich');
    perform set_config('bw.system_mail', 'on', true);
    insert into public.mail (from_user, from_name, to_user, subject, body)
      select null, 'Morwen', t.user_id, 'Du wurdest heimgesucht', format('Heute Nacht hat dich der Geist von %s heimgesucht. Du wirst morgen früh müde aufwachen.', me.name)
      where to_regclass('public.mail') is not null;
    perform set_config('bw.system_mail', 'off', true);
    insert into public.news (user_id, body) values (null, format('Der Geist von %s hat %s heimgesucht!', me.name, t.name));
  else
    insert into public.news (user_id, body) values (null, format('Der Geist von %s wollte %s heimsuchen, aber es hat nicht geklappt.', me.name, t.name));
  end if;
  return jsonb_build_object('success', ok, 'name', t.name);
end $$;
revoke all on function public.haunt(uuid) from public, anon;
grant execute on function public.haunt(uuid) to authenticated;
