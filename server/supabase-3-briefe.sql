-- Brackenwyrm, Teil 3: Kriegerliste und Briefe zwischen Spielern (wie "List Warriors" und "Ye Olde Mail" im Original).
-- Nach Teil 1 und Teil 2 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.

-- ---------------------------------------------------------------------------------------------
-- Kriegerliste: alle Helden mit öffentlichen Angaben. Gold, Erfahrung und Kampfwerte bleiben geheim.
create or replace function public.warriors()
returns table (user_id uuid, name text, gender text, level int, race text, specialty text, dragon_kills int, alive boolean, online boolean, in_inn boolean, last_seen timestamptz)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.name, f.gender, f.level, f.race, f.specialty, f.dragon_kills, f.alive,
         f.last_seen > now() - interval '5 minutes', f.in_inn, f.last_seen
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
