-- Brackenwyrm, Teil 11: Häuser im Wohnviertel.
-- Nach Teil 1 bis 10 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
-- Wichtig: Teil 11 ersetzt die Spielerkämpfe aus Teil 4 und Teil 6. Wer Teil 4 oder Teil 6 erneut ausführt,
-- führt danach auch Teil 11 erneut aus.
--
--   Gebaut wird im Spiel (der Bau steht im Spielstand). Der Server kennt das fertige Haus, damit andere es im
--   Wohnviertel sehen, damit man Schlüssel an Freunde geben kann und damit die Truhe mit Edelsteinen allen
--   Schlüsselbesitzern gehört. Wer im Haus schläft, liegt nicht auf den Feldern und nicht im Gasthaus;
--   angreifen kann ihn nur, wer einbricht. Dabei hat der Schlafende Heimvorteil, und der Einbrecher nimmt
--   ein paar Edelsteine aus der Truhe mit.

create table if not exists public.houses (
  owner      uuid primary key references public.fighters(user_id) on delete cascade,
  name       text not null default '',
  stage      int  not null default 0 check (stage between 0 and 10),
  done       boolean not null default false,
  chest      int  not null default 0 check (chest between 0 and 500),
  updated_at timestamptz not null default now()
);
alter table public.houses enable row level security;

create table if not exists public.house_keys (
  owner      uuid not null references public.houses(owner) on delete cascade,
  holder     uuid not null references public.fighters(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, holder)
);
alter table public.house_keys enable row level security;

-- Truhenbuch: wer wann wie viele Edelsteine hineingelegt oder herausgenommen hat.
create table if not exists public.house_log (
  id         bigserial primary key,
  owner      uuid not null references public.houses(owner) on delete cascade,
  who        text not null,
  delta      int  not null,
  kind       text not null default 'truhe' check (kind in ('truhe', 'einbruch')),
  created_at timestamptz not null default now()
);
create index if not exists house_log_owner on public.house_log (owner, id desc);
alter table public.house_log enable row level security;

-- Wo der Held heute schläft: im eigenen Haus oder bei Freunden (home_of = Besitzer).
alter table public.fighters add column if not exists in_house boolean not null default false;
alter table public.fighters add column if not exists home_of uuid;
grant insert (in_house, home_of) on public.fighters to authenticated;
grant update (in_house, home_of) on public.fighters to authenticated;

-- Im Haus schlafen darf nur, wer ein fertiges Haus hat oder einen Schlüssel dafür.
create or replace function public.fighters_guard11() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.in_house, false) then new.in_house := false; new.home_of := null; return new; end if;
  if new.home_of is null then new.home_of := new.user_id; end if;
  if not exists (
    select 1 from public.houses h
    where h.owner = new.home_of and h.done
      and (h.owner = new.user_id or exists (select 1 from public.house_keys k where k.owner = h.owner and k.holder = new.user_id))
  ) then
    new.in_house := false; new.home_of := null;
  end if;
  if new.in_house then new.in_inn := false; end if;
  return new;
end $$;
drop trigger if exists fighters_guard11 on public.fighters;
create trigger fighters_guard11 before insert or update on public.fighters for each row execute function public.fighters_guard11();

-- Das eigene Haus melden (Name, Baustufe, fertig). Ohne Namen wird es abgerissen (neuer Held ohne Haus).
create or replace function public.house_save(hname text, hstage int, hdone boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare me public.fighters;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null or me.banned then return; end if;
  if hname is null then
    delete from public.houses where owner = me.user_id;
    update public.fighters set in_house = false, home_of = null where home_of = me.user_id;
    return;
  end if;
  insert into public.houses (owner, name, stage, done, updated_at)
  values (me.user_id, left(public.bw_censor(btrim(hname)), 30), greatest(0, least(10, coalesce(hstage, 0))), coalesce(hdone, false), now())
  on conflict (owner) do update set name = excluded.name, stage = excluded.stage, done = excluded.done, updated_at = now()
  where houses.name is distinct from excluded.name or houses.stage <> excluded.stage or houses.done <> excluded.done;
end $$;

-- Alle Häuser im Wohnviertel.
create or replace function public.houses_list()
returns table (owner uuid, owner_name text, owner_gender text, name text, stage int, done boolean, mine boolean, has_key boolean, keys int)
language sql stable security definer set search_path = public as $$
  select h.owner, f.name, f.gender, h.name, h.stage, h.done, h.owner = auth.uid(),
         exists (select 1 from public.house_keys k where k.owner = h.owner and k.holder = auth.uid()),
         (select count(*)::int from public.house_keys k where k.owner = h.owner)
  from public.houses h join public.fighters f on f.user_id = h.owner
  where not f.banned
  order by (h.owner = auth.uid()) desc, h.done desc, h.updated_at desc
  limit 100
$$;

-- Ein Haus von innen: Truhe, Truhenbuch und (für den Besitzer) die Schlüssel.
create or replace function public.house_detail(howner uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare h public.houses; mine boolean; o public.fighters;
begin
  select * into h from public.houses where owner = howner;
  if h.owner is null then raise exception 'Dieses Haus gibt es nicht.' using errcode = 'P0001'; end if;
  mine := h.owner = auth.uid();
  if not mine and not exists (select 1 from public.house_keys k where k.owner = h.owner and k.holder = auth.uid()) then
    raise exception 'Für dieses Haus hast du keinen Schlüssel.' using errcode = 'P0001';
  end if;
  select * into o from public.fighters where user_id = h.owner;
  return jsonb_build_object(
    'owner', h.owner, 'owner_name', o.name, 'name', h.name, 'done', h.done, 'chest', h.chest, 'mine', mine,
    'keys', case when mine then coalesce((select jsonb_agg(jsonb_build_object('user_id', k.holder, 'name', f.name) order by f.name)
                                   from public.house_keys k join public.fighters f on f.user_id = k.holder where k.owner = h.owner), '[]'::jsonb)
                 else '[]'::jsonb end,
    'log', coalesce((select jsonb_agg(jsonb_build_object('who', l.who, 'delta', l.delta, 'kind', l.kind, 'at', l.created_at) order by l.id desc)
                     from (select * from public.house_log where owner = h.owner order by id desc limit 10) l), '[]'::jsonb));
end $$;

-- Schlüssel geben (höchstens fünf), zurückfordern und zurückgeben.
create or replace function public.house_give_key(holder_name text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare me public.fighters; t public.fighters; h public.houses;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select * into h from public.houses where owner = me.user_id;
  if h.owner is null or not h.done then raise exception 'Erst muss dein Haus fertig sein.' using errcode = 'P0001'; end if;
  select * into t from public.fighters f where lower(f.name) = lower(btrim(holder_name)) and not f.banned order by f.updated_at desc limit 1;
  if t.user_id is null then raise exception 'Diesen Helden gibt es nicht.' using errcode = 'P0001'; end if;
  if t.user_id = me.user_id then raise exception 'Deinen eigenen Schlüssel hast du schon.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.house_keys k where k.owner = me.user_id and k.holder = t.user_id) then
    raise exception '% hat schon einen Schlüssel.', t.name using errcode = 'P0001';
  end if;
  if (select count(*) from public.house_keys k where k.owner = me.user_id) >= 5 then
    raise exception 'Mehr als fünf Schlüssel hat der Schlosser nicht gemacht.' using errcode = 'P0001';
  end if;
  insert into public.house_keys (owner, holder) values (me.user_id, t.user_id);
  return t.name;
end $$;

create or replace function public.house_take_key(holder uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.house_keys k where k.owner = auth.uid() and k.holder = house_take_key.holder;
  update public.fighters set in_house = false, home_of = null where user_id = house_take_key.holder and home_of = auth.uid();
end $$;

create or replace function public.house_return_key(howner uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.house_keys k where k.owner = howner and k.holder = auth.uid();
  update public.fighters set in_house = false, home_of = null where user_id = auth.uid() and home_of = howner;
end $$;

-- Edelsteine in die Truhe legen (delta > 0) oder herausnehmen (delta < 0). Höchstens 500 in der Truhe.
create or replace function public.house_chest(howner uuid, delta int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me public.fighters; h public.houses;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select * into h from public.houses where owner = howner for update;
  if h.owner is null or not h.done then raise exception 'Dieses Haus gibt es nicht.' using errcode = 'P0001'; end if;
  if h.owner <> me.user_id and not exists (select 1 from public.house_keys k where k.owner = h.owner and k.holder = me.user_id) then
    raise exception 'Für dieses Haus hast du keinen Schlüssel.' using errcode = 'P0001';
  end if;
  if delta is null or delta = 0 or abs(delta) > 500 then raise exception 'Wie viele denn?' using errcode = 'P0001'; end if;
  if delta < 0 and h.chest < -delta then raise exception 'In der Truhe liegen nur % Edelsteine.', h.chest using errcode = 'P0001'; end if;
  if delta > 0 and h.chest + delta > 500 then raise exception 'Mehr als 500 Edelsteine passen nicht in die Truhe.' using errcode = 'P0001'; end if;
  update public.houses set chest = chest + delta where owner = h.owner;
  insert into public.house_log (owner, who, delta) values (h.owner, me.name, delta);
  return jsonb_build_object('chest', h.chest + delta, 'moved', delta);
end $$;

revoke all on function public.house_save(text, int, boolean), public.houses_list(), public.house_detail(uuid), public.house_give_key(text),
  public.house_take_key(uuid), public.house_return_key(uuid), public.house_chest(uuid, int) from public;
grant execute on function public.house_save(text, int, boolean), public.houses_list(), public.house_detail(uuid), public.house_give_key(text),
  public.house_take_key(uuid), public.house_return_key(uuid), public.house_chest(uuid, int) to authenticated;

-- ---------- Spielerkämpfe mit Häusern (ersetzt Teil 4 und Teil 6) ----------
-- place: 'felder' (draußen), 'gasthaus' (Zimmer bei Frieda) oder 'haus' (Einbruch im Wohnviertel).

drop function if exists public.pvp_targets(text);
create or replace function public.pvp_targets(place text default 'felder')
returns table (user_id uuid, name text, level int, specialty text, race text, gender text, dragon_kills int, attackable boolean, note text)
language plpgsql stable security definer set search_path = public as $$
declare me public.fighters;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null or me.banned then return; end if;
  return query
    select t.user_id, t.name, t.level, t.specialty, t.race, t.gender, t.dragon_kills,
           (t.pvp_flag is null or t.pvp_flag < now() - interval '10 minutes') as attackable,
           case when t.pvp_flag is not null and t.pvp_flag >= now() - interval '10 minutes' then 'wurde gerade erst angegriffen' else '' end
    from public.fighters t
    where t.user_id <> me.user_id
      and t.alive
      and t.last_seen < now() - interval '15 minutes'
      and t.level between me.level - 1 and me.level + 2
      and not public.f_immune(t)
      and not t.banned
      and case place when 'haus' then t.in_house
                     when 'gasthaus' then t.in_inn and not t.in_house
                     else not t.in_inn and not t.in_house end
    order by t.level desc, t.dragon_kills desc, t.name
    limit 50;
end $$;

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
  bounty int := 0;
  gems_amt int := 0;
  chest_now int;
begin
  if place not in ('felder', 'gasthaus', 'haus') then raise exception 'Dieser Held ist nicht hier.' using errcode = 'P0001'; end if;
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if not me.alive then raise exception 'Tote greifen niemanden an.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if me.pvp_day is distinct from public.bw_gameday() then me.pvp_day := public.bw_gameday(); me.pvp_used := 0; end if;
  if me.pvp_used >= 3 then raise exception 'Du hast heute schon 3 Spielerkämpfe gehabt.' using errcode = 'P0001'; end if;

  select * into t from public.fighters f where f.user_id = target for update;
  if t.user_id is null or t.user_id = me.user_id or t.banned then raise exception 'Dieser Held ist nicht hier.' using errcode = 'P0001'; end if;
  if not t.alive then raise exception '% ist schon bei Morwen.', t.name using errcode = 'P0001'; end if;
  if t.last_seen >= now() - interval '15 minutes' then raise exception '% ist hellwach.', t.name using errcode = 'P0001'; end if;
  if t.level not between me.level - 1 and me.level + 2 then raise exception '% ist außerhalb deiner Reichweite.', t.name using errcode = 'P0001'; end if;
  if public.f_immune(t) then raise exception '% steht noch unter dem Schutz der Neulinge.', t.name using errcode = 'P0001'; end if;
  if not (case place when 'haus' then t.in_house when 'gasthaus' then t.in_inn and not t.in_house else not t.in_inn and not t.in_house end) then
    raise exception '% schläft woanders.', t.name using errcode = 'P0001';
  end if;
  if t.pvp_flag is not null and t.pvp_flag >= now() - interval '10 minutes' then
    raise exception '% wurde gerade erst angegriffen.', t.name using errcode = 'P0001';
  end if;

  my_max := public.f_max_hp(me); my_atk := public.f_attack(me); my_def := public.f_defense(me);
  my_hp := greatest(1, least(me.hp, my_max));
  t_max := public.f_max_hp(t); t_atk := public.f_attack(t); t_def := public.f_defense(t);
  if place = 'haus' then  -- Heimvorteil: Wer daheim schläft, wehrt sich besser.
    t_max := round(t_max * 1.1)::int; t_def := round(t_def * 1.25)::int;
  end if;
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
    if place = 'haus' and t.home_of is not null then
      -- Aus der Truhe: ein Zehntel, mindestens einer, höchstens fünf Edelsteine.
      select chest into chest_now from public.houses where owner = t.home_of for update;
      gems_amt := case when coalesce(chest_now, 0) > 0 then least(5, greatest(1, chest_now / 10)) else 0 end;
      if gems_amt > 0 then
        update public.houses set chest = chest - gems_amt where owner = t.home_of;
        insert into public.house_log (owner, who, delta, kind) values (t.home_of, me.name, -gems_amt, 'einbruch');
      end if;
    end if;
    update public.fighters set gold = 0, exp = greatest(0, exp - exp_lose), alive = false, hp = 0, pvp_flag = now() where user_id = t.user_id;
    update public.fighters set gold = gold + gold_amt, exp = exp + exp_win, hp = my_hp, pk = true, pvp_day = me.pvp_day, pvp_used = me.pvp_used where user_id = me.user_id;
    bounty := public.bw_after_pvp(me.user_id, t.user_id);  -- Kopfgeld (Teil 5), sonst 0
    insert into public.pvp_events (user_id, kind, other_name, place, gold, exp) values (t.user_id, 'slain', me.name, place, gold_amt, exp_lose);
    insert into public.news (user_id, body) values (null,
      case place
        when 'gasthaus' then format('%s hat sich in Friedas Gasthaus geschlichen und %s im Schlaf besiegt.', me.name, t.name)
        when 'haus' then format('%s ist im Wohnviertel eingebrochen und hat %s im Schlaf besiegt.', me.name, t.name)
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
    'foe', jsonb_build_object('name', t.name, 'level', t.level, 'specialty', t.specialty, 'race', t.race, 'gender', t.gender, 'hp', t_hp, 'max', t_max, 'weapon_tier', t.weapon_tier),
    'gold', gold_amt, 'exp_win', case when won then exp_win else 0 end, 'exp_lose', case when won then 0 else exp_lose end,
    'fights_left', 3 - me.pvp_used, 'bounty', bounty, 'gems', gems_amt);
end $$;
revoke all on function public.pvp_targets(text), public.pvp_attack(uuid, text) from public;
grant execute on function public.pvp_targets(text), public.pvp_attack(uuid, text) to authenticated;

-- Kriegerliste: zeigt jetzt auch, wer daheim schläft (sonst wie in Teil 4).
drop function if exists public.warriors();
create or replace function public.warriors()
returns table (user_id uuid, name text, gender text, level int, race text, specialty text, dragon_kills int, alive boolean, online boolean, in_inn boolean, last_seen timestamptz,
               bio text, mount text, married_to text, days_played int, heirlooms text, in_house boolean)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.name, f.gender, f.level, f.race, f.specialty, f.dragon_kills, f.alive,
         f.last_seen > now() - interval '5 minutes', f.in_inn, f.last_seen,
         case when f.bio_hidden then '' else f.bio end, f.mount, f.married_to, f.days_played, f.heirlooms, f.in_house
  from public.fighters f
  where not f.banned
  order by f.dragon_kills desc, f.level desc, f.name
  limit 300
$$;
revoke all on function public.warriors() from public, anon;
grant execute on function public.warriors() to authenticated;
