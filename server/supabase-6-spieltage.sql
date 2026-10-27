-- Brackenwyrm, Teil 6: Zwei Spieltage pro echtem Tag und eigene Titel.
-- Nach Teil 1 bis 5 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
-- Wie im Original schlägt die Dorfuhr für alle gleichzeitig: ein neuer Spieltag beginnt um 6 und um 18 Uhr
-- (österreichische Zeit, Sommer- und Winterzeit eingerechnet). Alles, was "pro Tag" begrenzt ist
-- (Spielerkämpfe, Spuken, Kopfgeld, Überweisungen, Würfeln, Stufenaufstiege), zählt jetzt pro Spieltag.
-- Außerdem: eigene Titel nach Drachenkills (f_title).
--
-- Die Funktionen hier sind die neueste Fassung. Sie ersetzen die gleichnamigen aus Teil 2 bis 5.
-- Wer Teil 2 bis 5 erneut ausführt, muss danach auch Teil 6 erneut ausführen.

-- =============================================================================================
-- Spieltag: ein Datum, das sich zweimal am Tag ändert (um 6 und um 18 Uhr Wiener Zeit).
-- Es ist ein reiner Zähler (ab 2000-01-01 ein "Datum" je Spieltag) und kein Kalenderdatum.
-- =============================================================================================
create or replace function public.bw_gameday(ts timestamptz default now())
returns date language sql stable set search_path = public as $$
  select date '2000-01-01' + ((v::date - date '2000-01-01') * 2 + case when extract(hour from v) >= 12 then 1 else 0 end)
  from (select (ts at time zone 'Europe/Vienna') - interval '6 hours' as v) x
$$;
revoke all on function public.bw_gameday(timestamptz) from public, anon;

-- =============================================================================================
-- Titel nach Drachenkills (eigene Rangleiter, ersetzt die aus Teil 2). Muss zu src/content/titles.ts passen.
-- =============================================================================================
create or replace function public.f_title(dk int, g text) returns text language sql immutable as $$
  select (case when g = 'f'
    then ARRAY['Grünschnabel', 'Reisigsammlerin', 'Fährtenleserin', 'Farnläuferin', 'Wegwächterin', 'Moosritterin', 'Wurzelhüterin', 'Bannerträgerin', 'Wyrmspäherin', 'Schuppenbrecherin', 'Klingenmeisterin', 'Eichenherrin', 'Hainhüterin', 'Wyrmjägerin', 'Wyrmbezwingerin', 'Reckin', 'Schutzherrin', 'Waldfürstin', 'Sturmreiterin', 'Nebelwandlerin', 'Sternenwächterin', 'Glutherz', 'Flammenbändigerin', 'Wyrmschreck', 'Legende', 'Sagengestalt', 'Mythos', 'Waldgeist', 'Weltenhüterin', 'Wyrmkönigin', 'Ewige', 'Unsterbliche']
    else ARRAY['Grünschnabel', 'Reisigsammler', 'Fährtenleser', 'Farnläufer', 'Wegwächter', 'Moosritter', 'Wurzelhüter', 'Bannerträger', 'Wyrmspäher', 'Schuppenbrecher', 'Klingenmeister', 'Eichenherr', 'Hainhüter', 'Wyrmjäger', 'Wyrmbezwinger', 'Recke', 'Schutzherr', 'Waldfürst', 'Sturmreiter', 'Nebelwandler', 'Sternenwächter', 'Glutherz', 'Flammenbändiger', 'Wyrmschreck', 'Legende', 'Sagengestalt', 'Mythos', 'Waldgeist', 'Weltenhüter', 'Wyrmkönig', 'Ewiger', 'Unsterblicher'] end)[least(greatest(dk, 0), 31) + 1]
$$;

-- aus supabase-2-dorf.sql
create or replace function public.pvp_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fights_left', case when f.pvp_day is distinct from public.bw_gameday() then 3 else greatest(0, 3 - f.pvp_used) end,
    'immune', public.f_immune(f))
  from public.fighters f where f.user_id = auth.uid()
$$;

-- aus supabase-3-briefe.sql
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
  if (select count(*) from public.hauntings h where h.user_id = me.user_id and public.bw_gameday(h.created_at) = public.bw_gameday()) >= 4 then
    raise exception 'Morwen hat für heute genug von deinem Gespuke.' using errcode = 'P0001';
  end if;
  select * into t from public.fighters f where f.user_id = target for update;
  if t.user_id is null or t.user_id = me.user_id then raise exception 'Diesen Helden findest du nicht.' using errcode = 'P0001'; end if;
  if not t.alive then raise exception '% ist selbst bei Morwen.', t.name using errcode = 'P0001'; end if;
  if t.haunted_at is not null and public.bw_gameday(t.haunted_at) = public.bw_gameday() then
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

-- aus supabase-4-schutz.sql
create or replace function public.fighters_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  allowed int;
  gain    int;
  cap     bigint;
begin
  -- Nur prüfen, wenn der Spieler selbst schreibt (Server-Funktionen wie der Spielerkampf ändern fremde Zeilen).
  if auth.uid() is distinct from new.user_id then return new; end if;

  if tg_op = 'INSERT' then
    -- Bei "anlegen oder ändern" gibt es die Zeile schon: dann prüft der Teil für Änderungen.
    if exists (select 1 from public.fighters f where f.user_id = new.user_id) then return new; end if;
    if new.dragon_kills > 3 then perform public.bw_flag(new.user_id, 'drachenkills (neu)', new.dragon_kills, 3); new.dragon_kills := 3; end if;
    new.last_dk_at := case when new.dragon_kills > 0 then now() end;
    new.level_day := public.bw_gameday(); new.level_gain := 0;
    new.created_at := now();
  else
    -- Drachenkills: höchstens einer alle 4 Tage.
    if new.dragon_kills > old.dragon_kills then
      allowed := case when old.last_dk_at is null or old.last_dk_at <= now() - interval '4 days' then old.dragon_kills + 1 else old.dragon_kills end;
      if new.dragon_kills > allowed then perform public.bw_flag(new.user_id, 'drachenkills', new.dragon_kills, allowed); new.dragon_kills := allowed; end if;
      if new.dragon_kills > old.dragon_kills then
        new.last_dk_at := now();
        -- Nach dem Drachen beginnt alles wieder bei Stufe 1.
        if new.level > 5 then perform public.bw_flag(new.user_id, 'stufe', new.level, 5); new.level := 5; end if;
        new.level_day := public.bw_gameday(); new.level_gain := new.level - 1;
      end if;
    end if;
    -- Stufen: höchstens 4 Aufstiege am Tag (wer länger offline gespielt hat, holt das in den Tagen danach auf).
    if new.dragon_kills = old.dragon_kills and new.level > old.level then
      gain := case when old.level_day = public.bw_gameday() then old.level_gain else 0 end;
      allowed := old.level + greatest(0, 4 - gain);
      if new.level > allowed then perform public.bw_flag(new.user_id, 'stufe', new.level, allowed); new.level := allowed; end if;
      new.level_gain := gain + (new.level - old.level);
      new.level_day := public.bw_gameday();
    end if;
    -- Spieltage: höchstens einer pro Kalendertag seit dem letzten Spielen (plus Spielraum für Zeitzonen).
    allowed := old.days_played + 2 * greatest(0, current_date - old.last_seen::date) + 3;
    if new.days_played > allowed then perform public.bw_flag(new.user_id, 'spieltage', new.days_played, allowed); new.days_played := allowed; end if;
  end if;

  -- Was zur Stufe passen muss
  cap := 5000 + 5000 * new.level;
  if new.gold > cap then perform public.bw_flag(new.user_id, 'gold', new.gold, cap); new.gold := cap; end if;
  cap := 3 * public.f_exp_needed(new.level, new.dragon_kills) + 1000;
  if new.exp > cap then perform public.bw_flag(new.user_id, 'erfahrung', new.exp, cap); new.exp := cap; end if;
  if new.weapon_tier > new.level + 5 then perform public.bw_flag(new.user_id, 'waffe', new.weapon_tier, new.level + 5); new.weapon_tier := least(15, new.level + 5); end if;
  if new.armor_tier > new.level + 5 then perform public.bw_flag(new.user_id, 'rüstung', new.armor_tier, new.level + 5); new.armor_tier := least(15, new.level + 5); end if;
  -- Drachenpunkte: zusammen höchstens einer pro Drachenkill
  if new.bonus_atk + new.bonus_def > new.dragon_kills then
    perform public.bw_flag(new.user_id, 'drachenpunkte', new.bonus_atk + new.bonus_def, new.dragon_kills);
    new.bonus_atk := least(new.bonus_atk, new.dragon_kills);
    new.bonus_def := least(new.bonus_def, new.dragon_kills - new.bonus_atk);
  end if;
  if new.base_max_hp > 5 * new.dragon_kills + 250 then
    perform public.bw_flag(new.user_id, 'lebenskraft', new.base_max_hp, 5 * new.dragon_kills + 250);
    new.base_max_hp := 5 * new.dragon_kills + 250;
  end if;

  -- Name und Steckbrief: Wortfilter, ein von der Wache festgelegter Name gilt immer.
  if new.name_locked is not null then new.name := new.name_locked;
  else new.name := left(public.bw_censor(btrim(new.name)), 20); end if;
  new.bio := left(public.bw_censor(new.bio), 400);
  return new;
end $$;

-- aus supabase-4-schutz.sql
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
begin
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
    bounty := public.bw_after_pvp(me.user_id, t.user_id);  -- Kopfgeld (Teil 5), sonst 0
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
    'foe', jsonb_build_object('name', t.name, 'level', t.level, 'specialty', t.specialty, 'race', t.race, 'gender', t.gender, 'hp', t_hp, 'max', t_max, 'weapon_tier', t.weapon_tier),
    'gold', gold_amt, 'exp_win', case when won then exp_win else 0 end, 'exp_lose', case when won then 0 else exp_lose end,
    'fights_left', 3 - me.pvp_used, 'bounty', bounty);
end $$;

-- aus supabase-5-dorfleben.sql
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
  if me.bounty_day is distinct from public.bw_gameday() then me.bounties_today := 0; end if;
  if me.bounties_today >= 5 then raise exception 'Veit schüttelt den Kopf. „Fünf am Tag. Mehr Feinde kann keiner haben.“' using errcode = 'P0001'; end if;
  fee := ceil(amount * 0.10);
  if me.gold < amount + fee then raise exception 'Das kostet % Gold (mit Veits Anteil). So viel hast du nicht dabei.', amount + fee using errcode = 'P0001'; end if;
  update public.fighters set gold = gold - amount - fee, bounties_today = me.bounties_today + 1, bounty_day = public.bw_gameday() where user_id = me.user_id;
  insert into public.bounties (setter, target, amount) values (me.user_id, t.user_id, amount);
  insert into public.news (user_id, body) values (null, format('Veit Galgenstrick nimmt einen neuen Auftrag an: Kopfgeld auf %s.', t.name));
  return jsonb_build_object('paid', amount + fee, 'name', t.name,
    'total', (select coalesce(sum(b.amount), 0) from public.bounties b where b.target = t.user_id and b.claimed_at is null));
end $$;

-- aus supabase-5-dorfleben.sql
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
  if me.sent_day is distinct from public.bw_gameday() then me.sent_today := 0; end if;
  if me.sent_today + amount > 25 * me.level then
    raise exception 'Heute darfst du nur noch % Gold überweisen (25 je eigener Stufe am Tag).', greatest(0, 25 * me.level - me.sent_today) using errcode = 'P0001';
  end if;
  select count(*) into received from public.transfers x where x.to_user = t.user_id and public.bw_gameday(x.created_at) = public.bw_gameday();
  if received >= 3 then raise exception '% hat heute schon drei Überweisungen bekommen. Morgen wieder.', t.name using errcode = 'P0001'; end if;
  update public.fighters set sent_today = me.sent_today + amount, sent_day = public.bw_gameday() where user_id = me.user_id;
  insert into public.transfers (from_user, to_user, amount) values (me.user_id, t.user_id, amount);
  insert into public.pvp_events (user_id, kind, other_name, place, gold, exp) values (t.user_id, 'transfer', me.name, 'kontor', amount, 0);
  return jsonb_build_object('amount', amount, 'name', t.name, 'left_today', 25 * me.level - me.sent_today - amount);
end $$;

-- aus supabase-5-dorfleben.sql
create or replace function public.fivesix_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pot', j.pot, 'last5', j.last5, 'last5_pot', j.last5_pot, 'last4', j.last4, 'last4_pot', j.last4_pot,
    'last3', j.last3, 'last3_pot', j.last3_pot,
    'plays_left', 10 - coalesce((select p.plays from public.fivesix_plays p where p.user_id = auth.uid() and p.day = public.bw_gameday()), 0),
    'cost', public.fivesix_cost(coalesce((select f.level from public.fighters f where f.user_id = auth.uid()), 1)))
  from public.jackpot j where j.id = 1
$$;

-- aus supabase-5-dorfleben.sql
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
  select coalesce(p.plays, 0) into used from public.fivesix_plays p where p.user_id = me.user_id and p.day = public.bw_gameday();
  used := coalesce(used, 0);
  if used >= 10 then raise exception '„Für heute hast du genug gewürfelt. Komm morgen wieder.“' using errcode = 'P0001'; end if;
  cost := public.fivesix_cost(me.level);
  if me.gold < cost then raise exception 'Ein Wurf kostet % Gold.', cost using errcode = 'P0001'; end if;
  insert into public.fivesix_plays (user_id, day, plays) values (me.user_id, public.bw_gameday(), 1)
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
