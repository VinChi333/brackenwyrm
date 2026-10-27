-- Brackenwyrm, Teil 5: Dorfleben wie im Original.
-- Nach Teil 1 bis 4 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
--   1. Kopfgeld bei Veit Galgenstrick (Original: dag.php): Gold auf einen Helden aussetzen, wer ihn im Spielerkampf besiegt, kassiert.
--   2. Kontor: Gold an andere Helden überweisen (Original: bank.php, gleiche Grenzen).
--   3. Fünf Sechser (Original: game_fivesix): Würfelspiel mit gemeinsamem Jackpot.
--   4. Aushang am Rathaus (Original: Nachricht des Tages): Ankündigungen der Wache an alle.
--   5. Ruhmeshalle mit Ranglisten (Original: hof.php): Drachentöter, Reichste, Charmanteste, Schnellste, ...

-- =============================================================================================
-- Neue Angaben für die Ranglisten (vom Spiel gemeldet, vom Server begrenzt) und der Siegzähler (nur Server)
-- =============================================================================================
alter table public.fighters add column if not exists charm           int    not null default 0;
alter table public.fighters add column if not exists wealth          bigint not null default 0;   -- Gold im Beutel + im Kontor
alter table public.fighters add column if not exists fastest_dk      int    not null default 0;   -- schnellster Drachenkill in Tagen
alter table public.fighters add column if not exists feste_treasures int    not null default 0;   -- Schätze der versunkenen Feste
alter table public.fighters add column if not exists pvp_wins        int    not null default 0;   -- Siege im Spielerkampf (zählt der Server)
alter table public.fighters add column if not exists bounties_today  int    not null default 0;
alter table public.fighters add column if not exists bounty_day      date;
alter table public.fighters add column if not exists sent_today      int    not null default 0;   -- heute überwiesen
alter table public.fighters add column if not exists sent_day        date;
grant insert (charm, wealth, fastest_dk, feste_treasures) on public.fighters to authenticated;
grant update (charm, wealth, fastest_dk, feste_treasures) on public.fighters to authenticated;

create or replace function public.fighters_guard5() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is distinct from new.user_id then return new; end if;
  new.charm := greatest(0, least(new.charm, 300));
  if new.wealth > 50000 * greatest(new.level, 1) * (1 + new.dragon_kills) then
    perform public.bw_flag(new.user_id, 'vermögen', new.wealth, 50000 * greatest(new.level, 1) * (1 + new.dragon_kills));
    new.wealth := 50000 * greatest(new.level, 1) * (1 + new.dragon_kills);
  end if;
  new.wealth := greatest(new.wealth, 0);
  if new.fastest_dk > 0 and new.fastest_dk < 4 then new.fastest_dk := 4; end if;
  if new.dragon_kills = 0 then new.fastest_dk := 0; end if;
  new.feste_treasures := greatest(0, least(new.feste_treasures, new.days_played));
  return new;
end $$;
drop trigger if exists fighters_guard5 on public.fighters;
create trigger fighters_guard5 before insert or update on public.fighters for each row execute function public.fighters_guard5();

-- =============================================================================================
-- 1. Kopfgeld bei Veit Galgenstrick
--    Wie im Original: 50 bis 200 Gold je Stufe des Ziels, Ziel ab Stufe 3, Veit behält 10 %, höchstens 5 am Tag.
--    Wer das Ziel im Spielerkampf besiegt, bekommt alle offenen Kopfgelder (außer die eigenen).
-- =============================================================================================
create table if not exists public.bounties (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  setter     uuid references auth.users(id) on delete set null,
  target     uuid not null references auth.users(id) on delete cascade,
  amount     int not null check (amount > 0),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);
create index if not exists bounties_open on public.bounties (target) where claimed_at is null;
alter table public.bounties enable row level security;
revoke all on public.bounties from anon, authenticated;

create or replace function public.set_bounty(target uuid, amount int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.fighters;
  t  public.fighters;
  fee int;
begin
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Veit kennt dich nicht.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select * into t from public.fighters f where f.user_id = set_bounty.target;
  if t.user_id is null or t.banned then raise exception 'Diesen Helden kennt Veit nicht.' using errcode = 'P0001'; end if;
  if t.user_id = me.user_id then raise exception 'Veit lacht dreckig. „Auf dich selbst? Nein.“' using errcode = 'P0001'; end if;
  if t.level < 3 then raise exception 'Veit winkt ab. „Der ist noch grün hinter den Ohren. Ab Stufe 3.“' using errcode = 'P0001'; end if;
  if amount < 50 * t.level or amount > 200 * t.level then
    raise exception 'Für % nimmt Veit zwischen % und % Gold.', t.name, 50 * t.level, 200 * t.level using errcode = 'P0001';
  end if;
  if me.bounty_day is distinct from current_date then me.bounties_today := 0; end if;
  if me.bounties_today >= 5 then raise exception 'Veit schüttelt den Kopf. „Fünf am Tag. Mehr Feinde kann keiner haben.“' using errcode = 'P0001'; end if;
  fee := ceil(amount * 0.10);
  if me.gold < amount + fee then raise exception 'Das kostet % Gold (mit Veits Anteil). So viel hast du nicht dabei.', amount + fee using errcode = 'P0001'; end if;
  update public.fighters set gold = gold - amount - fee, bounties_today = me.bounties_today + 1, bounty_day = current_date where user_id = me.user_id;
  insert into public.bounties (setter, target, amount) values (me.user_id, t.user_id, amount);
  insert into public.news (user_id, body) values (null, format('Veit Galgenstrick nimmt einen neuen Auftrag an: Kopfgeld auf %s.', t.name));
  return jsonb_build_object('paid', amount + fee, 'name', t.name,
    'total', (select coalesce(sum(b.amount), 0) from public.bounties b where b.target = t.user_id and b.claimed_at is null));
end $$;

-- Offene Kopfgelder (höchste zuerst)
create or replace function public.bounty_list()
returns table (target uuid, name text, gender text, level int, dragon_kills int, total bigint, setters int)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.name, f.gender, f.level, f.dragon_kills, sum(b.amount)::bigint, count(distinct b.setter)::int
  from public.bounties b join public.fighters f on f.user_id = b.target
  where b.claimed_at is null and not f.banned
  group by f.user_id, f.name, f.gender, f.level, f.dragon_kills
  order by sum(b.amount) desc
  limit 30
$$;

-- Nach einem gewonnenen Spielerkampf: Kopfgeld auszahlen, Sieg zählen.
create or replace function public.bw_after_pvp(winner uuid, loser uuid) returns int
language plpgsql volatile security definer set search_path = public as $$
declare total int; wname text; lname text;
begin
  update public.fighters set pvp_wins = pvp_wins + 1 where user_id = winner;
  select coalesce(sum(amount), 0) into total from public.bounties
    where target = loser and claimed_at is null and setter is distinct from winner;
  if total > 0 then
    update public.bounties set claimed_by = winner, claimed_at = now()
      where target = loser and claimed_at is null and setter is distinct from winner;
    update public.fighters set gold = gold + total where user_id = winner;
    select name into wname from public.fighters where user_id = winner;
    select name into lname from public.fighters where user_id = loser;
    insert into public.news (user_id, body) values (null, format('%s hat das Kopfgeld von %s Gold auf %s kassiert!', wname, total, lname));
  end if;
  return total;
end $$;
revoke all on function public.bw_after_pvp(uuid, uuid) from public, anon, authenticated;

-- =============================================================================================
-- 2. Überweisen im Kontor (Grenzen wie im Original)
--    Ab Stufe 3 oder nach dem ersten Drachen. Je Überweisung höchstens 25 Gold je Stufe des Empfängers,
--    am Tag höchstens 25 Gold je eigener Stufe, jeder bekommt höchstens 3 Überweisungen am Tag.
-- =============================================================================================
create table if not exists public.transfers (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  from_user  uuid references auth.users(id) on delete set null,
  to_user    uuid references auth.users(id) on delete cascade,
  amount     int not null check (amount > 0)
);
create index if not exists transfers_recent on public.transfers (to_user, created_at desc);
alter table public.transfers enable row level security;
revoke all on public.transfers from anon, authenticated;

alter table public.pvp_events drop constraint if exists pvp_events_kind_check;
alter table public.pvp_events add constraint pvp_events_kind_check check (kind in ('slain', 'defended', 'haunted', 'transfer'));

create or replace function public.transfer_gold(target uuid, amount int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.fighters;
  t  public.fighters;
  received int;
begin
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if me.level < 3 and me.dragon_kills = 0 then raise exception 'Überweisen kannst du ab Stufe 3.' using errcode = 'P0001'; end if;
  select * into t from public.fighters f where f.user_id = transfer_gold.target;
  if t.user_id is null or t.banned then raise exception 'Diesen Helden kennt das Kontor nicht.' using errcode = 'P0001'; end if;
  if t.user_id = me.user_id then raise exception 'An dich selbst? Ansgar runzelt die Stirn.' using errcode = 'P0001'; end if;
  if amount < 1 then raise exception 'Wie viel denn?' using errcode = 'P0001'; end if;
  if amount > 25 * t.level then raise exception 'An % darfst du höchstens % Gold auf einmal überweisen (25 je Stufe).', t.name, 25 * t.level using errcode = 'P0001'; end if;
  if me.sent_day is distinct from current_date then me.sent_today := 0; end if;
  if me.sent_today + amount > 25 * me.level then
    raise exception 'Heute darfst du nur noch % Gold überweisen (25 je eigener Stufe am Tag).', greatest(0, 25 * me.level - me.sent_today) using errcode = 'P0001';
  end if;
  select count(*) into received from public.transfers x where x.to_user = t.user_id and x.created_at::date = current_date;
  if received >= 3 then raise exception '% hat heute schon drei Überweisungen bekommen. Morgen wieder.', t.name using errcode = 'P0001'; end if;
  update public.fighters set sent_today = me.sent_today + amount, sent_day = current_date where user_id = me.user_id;
  insert into public.transfers (from_user, to_user, amount) values (me.user_id, t.user_id, amount);
  insert into public.pvp_events (user_id, kind, other_name, place, gold, exp) values (t.user_id, 'transfer', me.name, 'kontor', amount, 0);
  return jsonb_build_object('amount', amount, 'name', t.name, 'left_today', 25 * me.level - me.sent_today - amount);
end $$;

-- =============================================================================================
-- 3. Fünf Sechser: fünf Würfel, zehnmal am Tag. Jeder Wurf füllt den Topf.
--    Fünf Sechser: der ganze Topf. Vier: 10 %. Drei: 5 %. (wie im Original)
-- =============================================================================================
create table if not exists public.jackpot (
  id        int primary key default 1 check (id = 1),
  pot       int not null default 500,
  last5     text not null default '', last5_pot int not null default 0,
  last4     text not null default '', last4_pot int not null default 0,
  last3     text not null default '', last3_pot int not null default 0
);
insert into public.jackpot (id) values (1) on conflict do nothing;
alter table public.jackpot enable row level security;
revoke all on public.jackpot from anon, authenticated;

create table if not exists public.fivesix_plays (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  plays   int not null default 0,
  primary key (user_id, day)
);
alter table public.fivesix_plays enable row level security;
revoke all on public.fivesix_plays from anon, authenticated;

create or replace function public.fivesix_cost(lvl int) returns int language sql immutable as $$ select 5 * greatest(1, lvl) $$;

create or replace function public.fivesix_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pot', j.pot, 'last5', j.last5, 'last5_pot', j.last5_pot, 'last4', j.last4, 'last4_pot', j.last4_pot,
    'last3', j.last3, 'last3_pot', j.last3_pot,
    'plays_left', 10 - coalesce((select p.plays from public.fivesix_plays p where p.user_id = auth.uid() and p.day = current_date), 0),
    'cost', public.fivesix_cost(coalesce((select f.level from public.fighters f where f.user_id = auth.uid()), 1)))
  from public.jackpot j where j.id = 1
$$;

create or replace function public.fivesix_roll()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.fighters;
  j  public.jackpot;
  cost int;
  used int;
  dice int[] := array[]::int[];
  sixes int := 0;
  win int := 0;
  d int;
begin
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select coalesce(p.plays, 0) into used from public.fivesix_plays p where p.user_id = me.user_id and p.day = current_date;
  used := coalesce(used, 0);
  if used >= 10 then raise exception '„Für heute hast du genug gewürfelt. Komm morgen wieder.“' using errcode = 'P0001'; end if;
  cost := public.fivesix_cost(me.level);
  if me.gold < cost then raise exception 'Ein Wurf kostet % Gold.', cost using errcode = 'P0001'; end if;
  insert into public.fivesix_plays (user_id, day, plays) values (me.user_id, current_date, 1)
    on conflict (user_id, day) do update set plays = public.fivesix_plays.plays + 1;
  select * into j from public.jackpot where id = 1 for update;
  j.pot := least(j.pot + cost, 25000);
  for i in 1..5 loop
    d := 1 + floor(random() * 6)::int;
    dice := dice || d;
    if d = 6 then sixes := sixes + 1; end if;
  end loop;
  if sixes = 5 then
    win := j.pot;
    update public.jackpot set pot = 500, last5 = me.name, last5_pot = win where id = 1;
    insert into public.news (user_id, body) values (null, format('%s hat fünf Sechser gewürfelt und den Jackpot von %s Gold geknackt!', me.name, win));
  elsif sixes = 4 then
    win := round(j.pot * 0.10);
    update public.jackpot set pot = j.pot - win, last4 = me.name, last4_pot = win where id = 1;
    insert into public.news (user_id, body) values (null, format('%s hat vier Sechser gewürfelt und %s Gold gewonnen.', me.name, win));
  elsif sixes = 3 then
    win := round(j.pot * 0.05);
    update public.jackpot set pot = j.pot - win, last3 = me.name, last3_pot = win where id = 1;
  else
    update public.jackpot set pot = j.pot where id = 1;
  end if;
  update public.fighters set gold = gold - cost + win where user_id = me.user_id;
  return jsonb_build_object('dice', to_jsonb(dice), 'sixes', sixes, 'win', win, 'cost', cost,
    'pot', (select pot from public.jackpot where id = 1), 'plays_left', 9 - used);
end $$;

-- =============================================================================================
-- 4. Aushang am Rathaus: Ankündigungen der Wache (Teil 4: Tabelle admins) für alle Spieler.
-- =============================================================================================
create table if not exists public.aushang (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null check (char_length(body) between 1 and 1500),
  author     text not null default ''
);
create index if not exists aushang_recent on public.aushang (created_at desc);
alter table public.aushang enable row level security;
drop policy if exists "Aushang lesen (alle)" on public.aushang;
create policy "Aushang lesen (alle)" on public.aushang for select to anon, authenticated using (true);
revoke all on public.aushang from anon, authenticated;
grant select on public.aushang to anon, authenticated;

create or replace function public.post_aushang(title text, body text) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare new_id bigint; who text;
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  select name into who from public.fighters where user_id = auth.uid();
  insert into public.aushang (title, body, author) values (btrim(title), btrim(body), coalesce(who, 'Die Wache')) returning id into new_id;
  return new_id;
end $$;

create or replace function public.delete_aushang(aushang_id bigint) returns text
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  delete from public.aushang where id = aushang_id;
  return 'ok';
end $$;

-- =============================================================================================
-- 5. Ruhmeshalle mit Ranglisten
-- =============================================================================================
create or replace function public.hall_of_fame(cat text default 'drachen', lim int default 20)
returns table (name text, gender text, dragon_kills int, level int, value bigint)
language sql stable security definer set search_path = public as $$
  select f.name, f.gender, f.dragon_kills, f.level,
    (case cat
      when 'reich' then f.wealth
      when 'charme' then f.charm
      when 'schnell' then f.fastest_dk
      when 'erben' then (case when f.heirlooms = '' then 0 else array_length(string_to_array(f.heirlooms, ','), 1) end)
      when 'furcht' then f.pvp_wins
      when 'schatz' then f.feste_treasures
      when 'veteran' then f.days_played
      else f.dragon_kills end)::bigint as value
  from public.fighters f
  where not f.banned and (cat <> 'schnell' or f.fastest_dk > 0)
  order by
    case when cat = 'schnell' then f.fastest_dk end asc nulls last,
    case when cat <> 'schnell' then (case cat
      when 'reich' then f.wealth
      when 'charme' then f.charm
      when 'erben' then (case when f.heirlooms = '' then 0 else array_length(string_to_array(f.heirlooms, ','), 1) end)
      when 'furcht' then f.pvp_wins
      when 'schatz' then f.feste_treasures
      when 'veteran' then f.days_played
      else f.dragon_kills end) end desc nulls last,
    f.dragon_kills desc, f.level desc, f.name
  limit greatest(1, least(lim, 50))
$$;

revoke all on function public.set_bounty(uuid, int), public.bounty_list(), public.transfer_gold(uuid, int),
  public.fivesix_info(), public.fivesix_roll(), public.post_aushang(text, text), public.delete_aushang(bigint) from public, anon;
grant execute on function public.set_bounty(uuid, int), public.bounty_list(), public.transfer_gold(uuid, int),
  public.fivesix_info(), public.fivesix_roll(), public.post_aushang(text, text), public.delete_aushang(bigint) to authenticated;
revoke all on function public.hall_of_fame(text, int) from public;
grant execute on function public.hall_of_fame(text, int) to anon, authenticated;
