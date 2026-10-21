-- Brackenwyrm, Teil 2: Spieler gegen Spieler, Dorfplatz und Tagesneuigkeiten.
-- Nach supabase.sql einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
-- Regeln wie im Original (LoGD-Quellcode, Standardwerte):
--   3 Spielerkämpfe pro Tag; Ziele: lebendig, schlafend (15 Minuten nicht gespielt), Stufe eigene-1 bis eigene+2,
--   nicht geschützt (Schutz bis 5 Tage alt UND 1500 Erfahrung UND kein Drachenkill UND selbst nie angegriffen),
--   nach einem Angriff 10 Minuten sicher. Keine Flucht, keine Fähigkeit, keine Volltreffer.
--   Sieg: Gold des Opfers + 10 % seiner Erfahrung (±10 % je Stufe Unterschied); Opfer stirbt, verliert Gold und 5 % Erfahrung.
--   Niederlage: Angreifer stirbt, verliert Gold und 15 % Erfahrung; Opfer erhält das Gold und 10 % der Erfahrung des Angreifers.
-- Der Kampf wird hier auf dem Server berechnet, damit niemand anderen Spielern Gold "wegschummeln" kann.
-- WICHTIG: Die Kampfwerte unten müssen zu src/game/balance.ts passen (maxHp, attack, defense).

-- ---------------------------------------------------------------------------------------------
-- Kampfwerte jedes Spielers. Das Spiel schreibt sie bei jedem Abgleich; lesen darf jeder nur seine eigenen.
create table if not exists public.fighters (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 20),
  specialty    text not null default 'klinge' check (specialty in ('klinge', 'wurzel', 'schleich')),
  gender       text not null default 'm' check (gender in ('m', 'f')),
  level        int  not null default 1 check (level between 1 and 15),
  exp          int  not null default 0 check (exp >= 0),
  gold         int  not null default 0 check (gold >= 0),
  hp           int  not null default 1 check (hp >= 0),
  base_max_hp  int  not null default 0 check (base_max_hp >= 0),
  bonus_atk    int  not null default 0 check (bonus_atk >= 0),
  bonus_def    int  not null default 0 check (bonus_def >= 0),
  weapon_tier  int  not null default 0 check (weapon_tier between 0 and 15),
  armor_tier   int  not null default 0 check (armor_tier between 0 and 15),
  dragon_kills int  not null default 0 check (dragon_kills >= 0),
  days_played  int  not null default 1 check (days_played >= 0),
  alive        boolean not null default true,
  in_inn       boolean not null default false,
  -- nur vom Server gesetzt:
  pk           boolean not null default false,       -- hat selbst schon angegriffen (verliert den Neulingsschutz)
  pvp_flag     timestamptz,                           -- zuletzt angegriffen worden
  pvp_day      date,
  pvp_used     int not null default 0,
  last_seen    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.fighters enable row level security;
drop policy if exists "Kampfwerte lesen (nur eigene)" on public.fighters;
drop policy if exists "Kampfwerte anlegen (nur eigene)" on public.fighters;
drop policy if exists "Kampfwerte ändern (nur eigene)" on public.fighters;
create policy "Kampfwerte lesen (nur eigene)"   on public.fighters for select to authenticated using (auth.uid() = user_id);
create policy "Kampfwerte anlegen (nur eigene)" on public.fighters for insert to authenticated with check (auth.uid() = user_id);
create policy "Kampfwerte ändern (nur eigene)"  on public.fighters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Das Spiel darf nur diese Spalten schreiben; pk, pvp_* und last_seen setzt allein der Server.
revoke all on public.fighters from anon, authenticated;
grant select on public.fighters to authenticated;
grant insert (user_id, name, specialty, gender, level, exp, gold, hp, base_max_hp, bonus_atk, bonus_def, weapon_tier, armor_tier, dragon_kills, days_played, alive, in_inn)
  on public.fighters to authenticated;
grant update (name, specialty, gender, level, exp, gold, hp, base_max_hp, bonus_atk, bonus_def, weapon_tier, armor_tier, dragon_kills, days_played, alive, in_inn)
  on public.fighters to authenticated;

-- "Zuletzt gesehen" setzt der Server bei jedem Schreiben selbst.
create or replace function public.fighters_touch() returns trigger language plpgsql as $$
begin
  -- Nur wenn der Spieler selbst schreibt: Ein Angriff darf das Opfer nicht "aufwecken".
  if auth.uid() = new.user_id then new.last_seen := now(); end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fighters_touch on public.fighters;
create trigger fighters_touch before insert or update on public.fighters for each row execute function public.fighters_touch();

-- ---------------------------------------------------------------------------------------------
-- Nachrichten an einen Spieler ("Du wurdest im Schlaf angegriffen"). Das Spiel wendet sie an und hakt sie ab.
create table if not exists public.pvp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind       text not null check (kind in ('slain', 'defended')),
  other_name text not null,
  place      text not null default 'felder',
  gold       int  not null default 0,
  exp        int  not null default 0,
  applied    boolean not null default false
);
create index if not exists pvp_events_open on public.pvp_events (user_id) where not applied;
alter table public.pvp_events enable row level security;
drop policy if exists "Nachrichten lesen (nur eigene)" on public.pvp_events;
drop policy if exists "Nachrichten abhaken (nur eigene)" on public.pvp_events;
create policy "Nachrichten lesen (nur eigene)"   on public.pvp_events for select to authenticated using (auth.uid() = user_id);
create policy "Nachrichten abhaken (nur eigene)" on public.pvp_events for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.pvp_events from anon, authenticated;
grant select on public.pvp_events to authenticated;
grant update (applied) on public.pvp_events to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tagesneuigkeiten. Alle lesen; Spieler schreiben kurze Meldungen über sich selbst (höchstens 40 am Tag).
create table if not exists public.news (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete set null default auth.uid(),
  body       text not null check (char_length(body) between 1 and 200)
);
create index if not exists news_recent on public.news (created_at desc);
alter table public.news enable row level security;
drop policy if exists "Neuigkeiten lesen (alle)" on public.news;
drop policy if exists "Neuigkeiten schreiben (über sich)" on public.news;
create policy "Neuigkeiten lesen (alle)"          on public.news for select to anon, authenticated using (true);
create policy "Neuigkeiten schreiben (über sich)" on public.news for insert to authenticated with check (auth.uid() = user_id);
revoke all on public.news from anon, authenticated;
grant select on public.news to anon, authenticated;
grant insert (body) on public.news to authenticated;

create or replace function public.news_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.news where user_id = new.user_id and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Zu viele Neuigkeiten heute.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists news_limit on public.news;
create trigger news_limit before insert on public.news for each row execute function public.news_limit();

-- ---------------------------------------------------------------------------------------------
-- Dorfplatz: kurze Sprüche der Spieler. Der Name kommt vom Server, damit sich niemand als jemand anderes ausgibt.
create table if not exists public.commentary (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  section    text not null default 'dorfplatz' check (section in ('dorfplatz', 'gasthaus', 'schattenreich')),
  name       text not null default '',
  body       text not null check (char_length(btrim(body)) between 1 and 200)
);
create index if not exists commentary_recent on public.commentary (section, created_at desc);
alter table public.commentary enable row level security;
drop policy if exists "Dorfplatz lesen (alle)" on public.commentary;
drop policy if exists "Dorfplatz schreiben (eigene)" on public.commentary;
create policy "Dorfplatz lesen (alle)"       on public.commentary for select to anon, authenticated using (true);
create policy "Dorfplatz schreiben (eigene)" on public.commentary for insert to authenticated with check (auth.uid() = user_id);
revoke all on public.commentary from anon, authenticated;
grant select on public.commentary to anon, authenticated;
grant insert (section, body) on public.commentary to authenticated;

create or replace function public.commentary_prepare() returns trigger language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select name into who from public.fighters where user_id = new.user_id;
  if who is null then raise exception 'Erst einmal spielen, dann reden.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.commentary where user_id = new.user_id and created_at > now() - interval '10 seconds') then
    raise exception 'Nicht so schnell. Warte einen Moment.' using errcode = 'P0001';
  end if;
  new.name := who;
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists commentary_prepare on public.commentary;
create trigger commentary_prepare before insert on public.commentary for each row execute function public.commentary_prepare();

-- ---------------------------------------------------------------------------------------------
-- Kampfwerte wie im Spiel (src/game/balance.ts). Boni aus Drachenkills werden begrenzt, damit niemand schummelt.
create or replace function public.f_max_hp(f public.fighters) returns int language sql immutable as $$
  select 10 + 10 * f.level + least(f.base_max_hp, 5 * f.dragon_kills + 50)  -- +50: Lebenskraft von der Moosfee
$$;
create or replace function public.f_attack(f public.fighters) returns int language sql immutable as $$
  select 3 + 2 * f.level + (f.weapon_tier * 2 + 1) + least(f.bonus_atk, f.dragon_kills)
$$;
create or replace function public.f_defense(f public.fighters) returns int language sql immutable as $$
  select 3 + 2 * f.level + (f.armor_tier * 2 + 1) + least(f.bonus_def, f.dragon_kills)
$$;

-- Geschützt (Neulingsschutz): jünger als 6 Tage, höchstens 1500 Erfahrung, kein Drachenkill, nie selbst angegriffen.
create or replace function public.f_immune(f public.fighters) returns boolean language sql immutable as $$
  select f.days_played <= 5 and f.exp <= 1500 and f.dragon_kills = 0 and not f.pk
$$;

-- Wer schläft wo und kann angegriffen werden? place = 'felder' oder 'gasthaus'.
create or replace function public.pvp_targets(place text default 'felder')
returns table (user_id uuid, name text, level int, specialty text, gender text, dragon_kills int, attackable boolean, note text)
language plpgsql stable security definer set search_path = public as $$
declare me public.fighters;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null then return; end if;
  return query
    select t.user_id, t.name, t.level, t.specialty, t.gender, t.dragon_kills,
           (t.pvp_flag is null or t.pvp_flag < now() - interval '10 minutes') as attackable,
           case when t.pvp_flag is not null and t.pvp_flag >= now() - interval '10 minutes' then 'wurde gerade erst angegriffen' else '' end
    from public.fighters t
    where t.user_id <> me.user_id
      and t.alive
      and t.last_seen < now() - interval '15 minutes'
      and t.level between me.level - 1 and me.level + 2
      and not public.f_immune(t)
      and t.in_inn = (place = 'gasthaus')
    order by t.level desc, t.dragon_kills desc, t.name
    limit 50;
end $$;

-- Der Kampf. Gibt den Verlauf zurück; das Spiel zeigt ihn als Kampfbericht.
create or replace function public.pvp_attack(target uuid, place text default 'felder')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  me public.fighters;
  t  public.fighters;
  my_hp int; my_atk int; my_def int; my_max int;
  t_hp  int; t_atk  int; t_def  int; t_max  int;
  rounds jsonb := '[]'::jsonb;
  hd int; fd int; n int := 0;
  won boolean;
  gold_amt int; exp_win int; exp_lose int;
begin
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if not me.alive then raise exception 'Tote greifen niemanden an.' using errcode = 'P0001'; end if;
  if me.pvp_day is distinct from current_date then me.pvp_day := current_date; me.pvp_used := 0; end if;
  if me.pvp_used >= 3 then raise exception 'Du hast heute schon 3 Spielerkämpfe gehabt.' using errcode = 'P0001'; end if;

  select * into t from public.fighters f where f.user_id = target for update;
  if t.user_id is null or t.user_id = me.user_id then raise exception 'Dieser Held ist nicht hier.' using errcode = 'P0001'; end if;
  if not t.alive then raise exception '% ist schon bei Morwen.', t.name using errcode = 'P0001'; end if;
  if t.last_seen >= now() - interval '15 minutes' then raise exception '% ist hellwach.', t.name using errcode = 'P0001'; end if;
  if t.level not between me.level - 1 and me.level + 2 then raise exception '% ist außerhalb deiner Reichweite.', t.name using errcode = 'P0001'; end if;
  if public.f_immune(t) then raise exception '% steht noch unter dem Schutz der Neulinge.', t.name using errcode = 'P0001'; end if;
  if t.in_inn <> (place = 'gasthaus') then raise exception '% schläft woanders.', t.name using errcode = 'P0001'; end if;
  if t.pvp_flag is not null and t.pvp_flag >= now() - interval '10 minutes' then
    raise exception '% wurde gerade erst angegriffen.', t.name using errcode = 'P0001';
  end if;

  my_max := public.f_max_hp(me); my_atk := public.f_attack(me); my_def := public.f_defense(me);
  my_hp := greatest(1, least(me.hp, my_max));
  t_max := public.f_max_hp(t); t_atk := public.f_attack(t); t_def := public.f_defense(t);
  t_hp := t_max;  -- der Schlafende kämpft ausgeruht

  -- Runden wie im Spiel: 8 % Fehlschlag, Angriff × 0,6–1,4 minus Verteidigung × 0,25–0,75, mindestens 1. Keine Volltreffer.
  while my_hp > 0 and t_hp > 0 and n < 200 loop
    n := n + 1;
    hd := case when random() < 0.08 then 0 else greatest(1, round(my_atk * (0.6 + random() * 0.8) - t_def * (0.25 + random() * 0.5))::int) end;
    t_hp := greatest(0, t_hp - hd);
    fd := 0;
    if t_hp > 0 then
      fd := case when random() < 0.08 then 0 else greatest(1, round(t_atk * (0.6 + random() * 0.8) - my_def * (0.25 + random() * 0.5))::int) end;
      my_hp := greatest(0, my_hp - fd);
    end if;
    rounds := rounds || jsonb_build_array(jsonb_build_array(hd, fd));
  end loop;
  won := t_hp <= 0 or (my_hp > 0 and my_hp::float / my_max >= t_hp::float / t_max);

  me.pvp_used := me.pvp_used + 1;
  if won then
    gold_amt := t.gold;
    exp_win  := greatest(0, round(t.exp * 0.10 * (1 + 0.1 * (t.level - me.level))))::int;
    exp_lose := round(t.exp * 0.05)::int;
    update public.fighters set gold = 0, exp = greatest(0, exp - exp_lose), alive = false, hp = 0, pvp_flag = now() where user_id = t.user_id;
    update public.fighters set gold = gold + gold_amt, exp = exp + exp_win, hp = my_hp, pk = true, pvp_day = me.pvp_day, pvp_used = me.pvp_used where user_id = me.user_id;
    insert into public.pvp_events (user_id, kind, other_name, place, gold, exp) values (t.user_id, 'slain', me.name, place, gold_amt, exp_lose);
    insert into public.news (user_id, body) values (null,
      case when place = 'gasthaus'
        then format('%s hat sich in Friedas Gasthaus geschlichen und %s im Schlaf besiegt.', me.name, t.name)
        else format('%s hat %s auf den Feldern im Schlaf überrascht und besiegt.', me.name, t.name) end);
  else
    gold_amt := me.gold;
    exp_win  := round(me.exp * 0.10)::int;
    exp_lose := round(me.exp * 0.15)::int;
    update public.fighters set gold = 0, exp = greatest(0, exp - exp_lose), alive = false, hp = 0, pk = true, pvp_day = me.pvp_day, pvp_used = me.pvp_used where user_id = me.user_id;
    update public.fighters set gold = gold + gold_amt, exp = exp + exp_win, pvp_flag = now() where user_id = t.user_id;
    insert into public.pvp_events (user_id, kind, other_name, place, gold, exp) values (t.user_id, 'defended', me.name, place, gold_amt, exp_win);
    insert into public.news (user_id, body) values (null, format('%s wollte %s im Schlaf überfallen und ist dabei selbst gefallen.', me.name, t.name));
  end if;

  return jsonb_build_object(
    'won', won, 'rounds', rounds,
    'hero', jsonb_build_object('hp', greatest(0, my_hp), 'max', my_max),
    'foe', jsonb_build_object('name', t.name, 'level', t.level, 'specialty', t.specialty, 'gender', t.gender, 'hp', t_hp, 'max', t_max, 'weapon_tier', t.weapon_tier),
    'gold', gold_amt, 'exp_win', case when won then exp_win else 0 end, 'exp_lose', case when won then 0 else exp_lose end,
    'fights_left', 3 - me.pvp_used);
end $$;

-- Wie viele Spielerkämpfe habe ich heute noch?
create or replace function public.pvp_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fights_left', case when f.pvp_day is distinct from current_date then 3 else greatest(0, 3 - f.pvp_used) end,
    'immune', public.f_immune(f))
  from public.fighters f where f.user_id = auth.uid()
$$;

revoke all on function public.pvp_targets(text), public.pvp_attack(uuid, text), public.pvp_status() from public, anon;
grant execute on function public.pvp_targets(text), public.pvp_attack(uuid, text), public.pvp_status() to authenticated;
