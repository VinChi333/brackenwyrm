-- Brackenwyrm, Teil 4: Schutz vor Schummeln, Wortfilter, Melden und Blockieren, die Wache (Moderation), Konto löschen,
-- dazu die neuen Gesprächsorte Wyrmstein und Rosengarten (ab Testversion 0.35).
-- Nach Teil 1 bis 3 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
-- Was dieser Teil macht:
--   1. Schummelschutz: Das Spiel rechnet auf dem Gerät. Alles, was andere Spieler sehen oder spüren
--      (Ruhmeshalle, Titel, Denkmal, Spielerkämpfe), prüft der Server auf Plausibilität und begrenzt es:
--      höchstens 1 Drachenkill alle 4 Tage, höchstens 4 Stufen am Tag, Gold, Erfahrung, Ausrüstung und
--      Drachenpunkte passend zur Stufe. Was gekappt wurde, landet in cheat_log (sieh dir das ab und zu an).
--   2. Wortfilter für Namen, Steckbriefe, Gespräche, Briefe und Neuigkeiten (Tabelle bad_words, ergänzbar).
--   3. Melden und Blockieren. Ab 3 Meldungen verschiedener Spieler wird ein Beitrag sofort ausgeblendet.
--   4. Die Wache: Wer in der Tabelle admins steht, sieht im Spiel unter Einstellungen die Meldungen und kann
--      ausblenden, freigeben und sperren. Dich selbst trägst du einmal so ein (E-Mail anpassen):
--        insert into public.admins (user_id) select id from auth.users where email = 'deine@email.at' on conflict do nothing;
--   5. Konto löschen: Spieler können ihr Konto samt allen Daten selbst löschen.
--   6. Das Denkmal im Dorf kommt jetzt vom Server (der zuletzt geprüfte Drachentöter).
--   7. Neue Orte: Wyrmstein und Rosengarten, Erbstücke aus der versunkenen Feste.
-- Hinweis: Wer diesen Teil erneut ausführt, führt danach auch Teil 6 (supabase-6-spieltage.sql) erneut aus.

-- =============================================================================================
-- 1. Wortfilter
-- =============================================================================================
create table if not exists public.bad_words (
  word    text primary key check (word ~ '^=?[a-zäöüß]+( [a-zäöüß]+)*$'),
  pattern text not null default ''
);
alter table public.bad_words enable row level security;
revoke all on public.bad_words from anon, authenticated;

-- Ein Wort als regulärer Ausdruck (muss zu badWordPattern() in src/content/badwords.ts passen).
create or replace function public.bw_pattern(w text) returns text language plpgsql immutable as $$
declare
  whole boolean := left(w, 1) = '=';
  body  text := lower(case when left(w, 1) = '=' then substr(w, 2) else w end);
  res   text := '';
  ch    text;
  prev  boolean := false;
begin
  for i in 1 .. char_length(body) loop
    ch := substr(body, i, 1);
    if ch = ' ' then res := res || '\s+'; prev := false; continue; end if;
    if prev then res := res || '[._*-]?'; end if;
    res := res || case ch when 'a' then '[a4@]' when 'e' then '[e3]' when 'i' then '[i1!|]' when 'o' then '[o0]' when 's' then '[s5$]'
                          when 't' then '[t7]' when 'c' then '[ck]' when 'k' then '[kc]' when 'u' then '[uv]' else ch end || '+';
    prev := true;
  end loop;
  if whole then res := '(?<![[:alnum:]])' || res || '(?![[:alnum:]])'; end if;
  return res;
end $$;

create or replace function public.bad_words_prepare() returns trigger language plpgsql as $$
begin
  new.word := lower(btrim(new.word));
  new.pattern := public.bw_pattern(new.word);
  return new;
end $$;
drop trigger if exists bad_words_prepare on public.bad_words;
create trigger bad_words_prepare before insert or update on public.bad_words for each row execute function public.bad_words_prepare();

insert into public.bad_words (word) values
  ('arschloch'), ('fotze'), ('wichser'), ('wixer'), ('wixxer'), ('hurensohn'), ('=huso'), ('=hure'), ('=huren'), ('nutte'), ('schlampe'),
  ('fick'), ('missgeburt'), ('spast'), ('=mongo'), ('=mongos'), ('schwuchtel'), ('kanake'), ('kanacke'), ('neger'), ('judensau'),
  ('hitler'), ('sieg heil'), ('bring dich um'), ('kinderschaender'), ('kinderschänder'), ('=pedo'), ('=paedo'), ('=pädo'),
  ('fuck'), ('=cunt'), ('=cunts'), ('nigger'), ('nigga'), ('faggot'), ('=fag'), ('=fags'), ('whore'), ('slut'), ('=retard'), ('=retards'), ('=retarded'),
  ('bitch'), ('=pussy'), ('asshole'), ('kill yourself'), ('kill urself'), ('=kys'), ('motherf')
on conflict (word) do update set pattern = public.bw_pattern(excluded.word);

-- Ersetzt grobe Wörter durch ***.
create or replace function public.bw_censor(t text) returns text language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if t is null or t = '' then return t; end if;
  for r in select pattern from public.bad_words loop
    t := regexp_replace(t, r.pattern, '***', 'gi');
  end loop;
  return t;
end $$;

-- =============================================================================================
-- 2. Schummelschutz für die Kampfwerte
-- =============================================================================================
alter table public.fighters add column if not exists created_at  timestamptz not null default now();
alter table public.fighters add column if not exists last_dk_at  timestamptz;          -- letzter (geprüfter) Drachenkill
alter table public.fighters add column if not exists level_day   date;                 -- Stufenaufstiege heute ...
alter table public.fighters add column if not exists level_gain  int not null default 0; -- ... und wie viele
alter table public.fighters add column if not exists banned      boolean not null default false;
alter table public.fighters add column if not exists name_locked text;                 -- von der Wache festgelegter Name
alter table public.fighters add column if not exists bio_hidden  boolean not null default false;
-- (keine Rechte für das Spiel auf diese Spalten: nur der Server setzt sie)

create table if not exists public.cheat_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete cascade,
  field      text not null,
  sent       text not null,
  kept       text not null
);
create index if not exists cheat_log_recent on public.cheat_log (created_at desc);
alter table public.cheat_log enable row level security;
revoke all on public.cheat_log from anon, authenticated;

-- Erfahrung für den Meister der Stufe (wie expNeeded() in src/game/balance.ts).
create or replace function public.f_exp_needed(lvl int, dk int) returns int language plpgsql immutable as $$
declare
  base numeric := 0;
  orig int[] := array[0, 100, 400, 1002, 1912, 3140, 4707, 6641, 8985, 11795, 15143, 19121, 23840, 29437, 36071, 43930];
begin
  if lvl < 1 then return 0; end if;
  for l in 1 .. least(lvl, 14) loop base := base + round((20 + 1.5 * l) * (10 + 8 * l)); end loop;
  if coalesce(dk, 0) = 0 then return base::int; end if;
  return round(base + (dk / 4.0) * least(lvl, 14) * 100 * (base / orig[least(lvl, 14) + 1]))::int;
end $$;

-- Merkt sich Auffälliges, höchstens einmal pro Stunde und Wert. Alte Einträge (über 180 Tage) verschwinden.
create or replace function public.bw_flag(uid uuid, what text, sent bigint, kept bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cheat_log c where c.user_id = uid and c.field = what and c.created_at > now() - interval '1 hour') then
    insert into public.cheat_log (user_id, field, sent, kept) values (uid, what, sent::text, kept::text);
  end if;
  delete from public.cheat_log where created_at < now() - interval '180 days';
end $$;
revoke all on function public.bw_flag(uuid, text, bigint, bigint) from public, anon, authenticated;

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
    new.level_day := current_date; new.level_gain := 0;
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
        new.level_day := current_date; new.level_gain := new.level - 1;
      end if;
    end if;
    -- Stufen: höchstens 4 Aufstiege am Tag (wer länger offline gespielt hat, holt das in den Tagen danach auf).
    if new.dragon_kills = old.dragon_kills and new.level > old.level then
      gain := case when old.level_day = current_date then old.level_gain else 0 end;
      allowed := old.level + greatest(0, 4 - gain);
      if new.level > allowed then perform public.bw_flag(new.user_id, 'stufe', new.level, allowed); new.level := allowed; end if;
      new.level_gain := gain + (new.level - old.level);
      new.level_day := current_date;
    end if;
    -- Spieltage: höchstens einer pro Kalendertag seit dem letzten Spielen (plus Spielraum für Zeitzonen).
    allowed := old.days_played + greatest(0, current_date - old.last_seen::date) + 2;
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
drop trigger if exists fighters_guard on public.fighters;
create trigger fighters_guard before insert or update on public.fighters for each row execute function public.fighters_guard();

-- Die Ruhmeshalle übernimmt die geprüften Werte aus den Kampfwerten (die Angaben des Spiels zählen nicht mehr).
alter table public.profiles add column if not exists hidden boolean not null default false;
create or replace function public.profiles_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare f public.fighters;
begin
  select * into f from public.fighters x where x.user_id = new.user_id;
  if f.user_id is null then
    new.level := 1; new.dragon_kills := 0; new.hidden := false;
    new.name := left(public.bw_censor(btrim(new.name)), 20);
  else
    new.name := f.name; new.level := f.level; new.dragon_kills := f.dragon_kills; new.gender := f.gender; new.hidden := f.banned;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.fighters_to_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, level, dragon_kills, gender) values (new.user_id, new.name, new.level, new.dragon_kills, new.gender)
  on conflict (user_id) do update set name = excluded.name, level = excluded.level, dragon_kills = excluded.dragon_kills, gender = excluded.gender;
  return null;
end $$;
drop trigger if exists fighters_to_profile on public.fighters;
create trigger fighters_to_profile after insert or update on public.fighters for each row execute function public.fighters_to_profile();

drop policy if exists "Ruhmeshalle lesen (alle)" on public.profiles;
create policy "Ruhmeshalle lesen (alle)" on public.profiles for select to anon, authenticated using (not hidden);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (user_id, name, level, dragon_kills, gender) on public.profiles to authenticated;
grant update (name, level, dragon_kills, gender) on public.profiles to authenticated;

-- Bestehende Ruhmeshalle einmal mit den Kampfwerten abgleichen.
update public.profiles p set name = p.name where exists (select 1 from public.fighters f where f.user_id = p.user_id);

-- Das Denkmal im Dorf: wer zuletzt den Drachen erschlagen hat (nur geprüfte Drachenkills).
create or replace function public.last_dragon_slayer()
returns table (name text, gender text, dragon_kills int)
language sql stable security definer set search_path = public as $$
  select f.name, f.gender, f.dragon_kills from public.fighters f
  where f.dragon_kills > 0 and not f.banned
  order by f.last_dk_at desc nulls last, f.dragon_kills desc, f.updated_at desc
  limit 1
$$;
revoke all on function public.last_dragon_slayer() from public;
grant execute on function public.last_dragon_slayer() to anon, authenticated;

-- =============================================================================================
-- 3. Gespräche, Briefe und Neuigkeiten: Filter, Sperren, Blockieren
-- =============================================================================================
alter table public.commentary add column if not exists hidden boolean not null default false;
drop policy if exists "Dorfplatz lesen (alle)" on public.commentary;
create policy "Dorfplatz lesen (alle)" on public.commentary for select to anon, authenticated using (not hidden);

-- Erbstücke der Wyrmjäger (aus der versunkenen Feste), im Steckbrief sichtbar.
alter table public.fighters add column if not exists heirlooms text not null default '' check (char_length(heirlooms) <= 200);
grant insert (heirlooms) on public.fighters to authenticated;
grant update (heirlooms) on public.fighters to authenticated;

-- Neue Gesprächsorte: der Wyrmstein (nur Drachentöter dürfen reden) und der Rosengarten.
alter table public.commentary drop constraint if exists commentary_section_check;
alter table public.commentary add constraint commentary_section_check check (section in ('dorfplatz', 'gasthaus', 'schattenreich', 'felsen', 'garten'));

-- Lebenspunkte im Spielerkampf: Drachenpunkte, Moosfee und Quirins Lebenstränke (begrenzt, damit niemand schummelt).
create or replace function public.f_max_hp(f public.fighters) returns int language sql immutable as $$
  select 10 + 10 * f.level + least(f.base_max_hp, 5 * f.dragon_kills + 250)
$$;

create table if not exists public.blocks (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked),
  check (user_id <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "Blockiert lesen (eigene)" on public.blocks;
drop policy if exists "Blockieren" on public.blocks;
drop policy if exists "Blockierung aufheben" on public.blocks;
create policy "Blockiert lesen (eigene)" on public.blocks for select to authenticated using (user_id = auth.uid());
create policy "Blockieren"               on public.blocks for insert to authenticated with check (user_id = auth.uid());
create policy "Blockierung aufheben"     on public.blocks for delete to authenticated using (user_id = auth.uid());
revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked) on public.blocks to authenticated;

-- Wen habe ich blockiert (mit Namen)?
create or replace function public.my_blocks()
returns table (blocked uuid, name text)
language sql stable security definer set search_path = public as $$
  select b.blocked, coalesce(f.name, 'Unbekannt') from public.blocks b left join public.fighters f on f.user_id = b.blocked
  where b.user_id = auth.uid() order by b.created_at desc
$$;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

create or replace function public.commentary_prepare() returns trigger language plpgsql security definer set search_path = public as $$
declare f public.fighters;
begin
  select * into f from public.fighters x where x.user_id = new.user_id;
  if f.user_id is null then raise exception 'Erst einmal spielen, dann reden.' using errcode = 'P0001'; end if;
  if f.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.commentary where user_id = new.user_id and created_at > now() - interval '10 seconds') then
    raise exception 'Nicht so schnell. Warte einen Moment.' using errcode = 'P0001';
  end if;
  if new.section = 'felsen' and f.dragon_kills < 1 then
    raise exception 'Am Wyrmstein reden nur Drachentöter.' using errcode = 'P0001';
  end if;
  new.name := public.f_title(f.dragon_kills, f.gender) || ' ' || f.name;
  new.body := left(public.bw_censor(btrim(new.body)), 200);
  new.hidden := false;
  return new;
end $$;

create or replace function public.mail_prepare() returns trigger language plpgsql security definer set search_path = public as $$
declare f public.fighters;
begin
  -- Briefe vom Spiel selbst (z. B. von Morwen beim Spuken): Absender bleibt wie angegeben.
  if current_setting('bw.system_mail', true) = 'on' then
    new.created_at := now(); new.seen := false;
    return new;
  end if;
  new.from_user := auth.uid();
  select * into f from public.fighters x where x.user_id = new.from_user;
  if f.user_id is null then raise exception 'Erst einmal spielen, dann schreiben.' using errcode = 'P0001'; end if;
  if f.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.fighters where user_id = new.to_user) then
    raise exception 'Diesen Helden gibt es nicht.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.mail where from_user = new.from_user and created_at > now() - interval '5 seconds') then
    raise exception 'Nicht so schnell. Der Bote ist noch unterwegs.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.mail where from_user = new.from_user and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Für heute hast du genug Briefe geschrieben.' using errcode = 'P0001';
  end if;
  -- Blockiert: Der Brief kommt einfach nicht an (der Absender merkt davon nichts).
  if exists (select 1 from public.blocks b where b.user_id = new.to_user and b.blocked = new.from_user) then return null; end if;
  new.from_name := public.f_title(f.dragon_kills, f.gender) || ' ' || f.name;
  new.subject := left(public.bw_censor(btrim(new.subject)), 60);
  new.body := left(public.bw_censor(btrim(new.body)), 1000);
  new.seen := false;
  new.created_at := now();
  return new;
end $$;

-- Neuigkeiten vom Spiel: nur über sich selbst (der eigene Name muss vorkommen), gefiltert, nicht von Gesperrten.
create or replace function public.news_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare f public.fighters;
begin
  if new.user_id is null then return new; end if;  -- vom Server selbst (Spielerkampf, Spuken)
  select * into f from public.fighters x where x.user_id = new.user_id;
  if f.user_id is null or f.banned then return null; end if;
  if position(lower(f.name) in lower(new.body)) = 0 then return null; end if;
  if (select count(*) from public.news where user_id = new.user_id and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Zu viele Neuigkeiten heute.' using errcode = 'P0001';
  end if;
  new.body := left(public.bw_censor(new.body), 200);
  return new;
end $$;

-- Kriegerliste ohne Gesperrte, ausgeblendete Steckbriefe leer.
drop function if exists public.warriors();
create or replace function public.warriors()
returns table (user_id uuid, name text, gender text, level int, race text, specialty text, dragon_kills int, alive boolean, online boolean, in_inn boolean, last_seen timestamptz,
               bio text, mount text, married_to text, days_played int, heirlooms text)
language sql stable security definer set search_path = public as $$
  select f.user_id, f.name, f.gender, f.level, f.race, f.specialty, f.dragon_kills, f.alive,
         f.last_seen > now() - interval '5 minutes', f.in_inn, f.last_seen,
         case when f.bio_hidden then '' else f.bio end, f.mount, f.married_to, f.days_played, f.heirlooms
  from public.fighters f
  where not f.banned
  order by f.dragon_kills desc, f.level desc, f.name
  limit 300
$$;
revoke all on function public.warriors() from public, anon;
grant execute on function public.warriors() to authenticated;

-- Haken nach einem gewonnenen Spielerkampf (Kopfgeld, Siegzähler). Teil 5 füllt ihn; hier nur ein leerer Platzhalter,
-- der nie etwas überschreibt, das schon da ist.
do $$ begin
  if to_regprocedure('public.bw_after_pvp(uuid,uuid)') is null then
    execute 'create function public.bw_after_pvp(winner uuid, loser uuid) returns int language sql as ''select 0''';
  end if;
end $$;

-- Spielerkämpfe: Gesperrte greifen nicht an und werden nicht angegriffen (sonst wie in Teil 2).
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
  bounty int := 0;
begin
  select * into me from public.fighters f where f.user_id = auth.uid() for update;
  if me.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if not me.alive then raise exception 'Tote greifen niemanden an.' using errcode = 'P0001'; end if;
  if me.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if me.pvp_day is distinct from current_date then me.pvp_day := current_date; me.pvp_used := 0; end if;
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

revoke all on function public.pvp_targets(text), public.pvp_attack(uuid, text) from public, anon;
grant execute on function public.pvp_targets(text), public.pvp_attack(uuid, text) to authenticated;

-- =============================================================================================
-- 4. Melden und die Wache
-- =============================================================================================
create table if not exists public.reports (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  reporter   uuid references auth.users(id) on delete set null,
  target     uuid references auth.users(id) on delete set null,
  kind       text not null check (kind in ('chat', 'brief', 'steckbrief', 'name')),
  ref_id     bigint not null default 0,
  content    text not null default '',      -- was gemeldet wurde, so wie es da stand
  handled    boolean not null default false,
  unique (reporter, kind, ref_id, target)
);
create index if not exists reports_open on public.reports (handled, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.report(kind text, ref bigint default 0, target uuid default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  me   public.fighters;
  tgt  uuid;
  what text;
  n    int;
begin
  select * into me from public.fighters f where f.user_id = auth.uid();
  if me.user_id is null then raise exception 'Erst einmal spielen.' using errcode = 'P0001'; end if;
  if (select count(*) from public.reports r where r.reporter = me.user_id and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Für heute hast du genug gemeldet.' using errcode = 'P0001';
  end if;
  if kind = 'chat' then
    select c.user_id, c.name || ': ' || c.body into tgt, what from public.commentary c where c.id = ref;
  elsif kind = 'brief' then
    select m.from_user, m.from_name || ' – ' || m.subject || E'\n' || m.body into tgt, what from public.mail m where m.id = ref and m.to_user = me.user_id;
  elsif kind = 'steckbrief' then
    ref := 0; select f.user_id, f.name || ': ' || f.bio into tgt, what from public.fighters f where f.user_id = target;
  elsif kind = 'name' then
    ref := 0; select f.user_id, f.name into tgt, what from public.fighters f where f.user_id = target;
  else
    raise exception 'Das kann man nicht melden.' using errcode = 'P0001';
  end if;
  if tgt is null then raise exception 'Das gibt es nicht mehr.' using errcode = 'P0001'; end if;
  if tgt = me.user_id then raise exception 'Dich selbst kannst du nicht melden.' using errcode = 'P0001'; end if;

  insert into public.reports (reporter, target, kind, ref_id, content) values (me.user_id, tgt, kind, ref, left(what, 1200))
  on conflict do nothing;
  if not found then return 'Das hast du schon gemeldet.'; end if;

  -- Ab 3 Meldungen verschiedener Spieler wird es sofort ausgeblendet, bis die Wache entscheidet.
  select count(distinct r.reporter) into n from public.reports r where r.kind = report.kind and r.ref_id = ref and r.target = tgt and not r.handled;
  if n >= 3 then
    if kind = 'chat' then update public.commentary set hidden = true where id = ref;
    elsif kind = 'steckbrief' then update public.fighters set bio_hidden = true where user_id = tgt;
    elsif kind = 'name' then update public.fighters set name_locked = 'Namenloser Held', name = 'Namenloser Held' where user_id = tgt and name_locked is null;
    end if;
  end if;
  delete from public.reports where handled and created_at < now() - interval '180 days';
  return 'Danke. Die Wache sieht sich das an.';
end $$;
revoke all on function public.report(text, bigint, uuid) from public, anon;
grant execute on function public.report(text, bigint, uuid) to authenticated;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Offene Meldungen, zusammengefasst pro Beitrag.
create or replace function public.mod_reports()
returns table (kind text, ref_id bigint, target uuid, target_name text, banned boolean, content text, reports int, first_at timestamptz, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  return query
    select r.kind, r.ref_id, r.target, coalesce(f.name, '(Konto gelöscht)'), coalesce(f.banned, false),
           (array_agg(r.content order by r.created_at desc))[1], count(*)::int, min(r.created_at),
           case r.kind when 'chat' then coalesce((select c.hidden from public.commentary c where c.id = r.ref_id), true)
                       when 'steckbrief' then coalesce(f.bio_hidden, false)
                       when 'name' then f.name_locked is not null
                       else false end
    from public.reports r left join public.fighters f on f.user_id = r.target
    where not r.handled
    group by r.kind, r.ref_id, r.target, f.name, f.banned, f.bio_hidden, f.name_locked
    order by count(*) desc, min(r.created_at)
    limit 100;
end $$;

-- Entscheidung der Wache: 'ok' (Fehlalarm, wieder zeigen), 'hide' (ausblenden), 'ban' (ausblenden und sperren).
create or replace function public.mod_decide(kind text, ref bigint, target uuid, action text)
returns text language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  if action not in ('ok', 'hide', 'ban') then raise exception 'Unbekannte Entscheidung.' using errcode = 'P0001'; end if;
  if kind = 'chat' then update public.commentary set hidden = (action <> 'ok') where id = ref;
  elsif kind = 'steckbrief' then update public.fighters set bio_hidden = (action <> 'ok') where user_id = target;
  elsif kind = 'name' then
    if action = 'ok' then update public.fighters set name_locked = null where user_id = target;
    else update public.fighters set name_locked = 'Namenloser Held', name = 'Namenloser Held' where user_id = target; end if;
  end if;
  if action = 'ban' and target is not null then update public.fighters set banned = true where user_id = target; end if;
  update public.reports r set handled = true where r.kind = mod_decide.kind and r.ref_id = ref and r.target is not distinct from mod_decide.target;
  return 'ok';
end $$;

-- Gesperrte Spieler und Auffälliges aus dem Schummelschutz.
create or replace function public.mod_banned()
returns table (user_id uuid, name text, level int, dragon_kills int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  return query select f.user_id, f.name, f.level, f.dragon_kills from public.fighters f where f.banned order by f.name;
end $$;

create or replace function public.mod_unban(target uuid) returns text language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  update public.fighters set banned = false where user_id = target;
  return 'ok';
end $$;

create or replace function public.mod_cheats()
returns table (created_at timestamptz, user_id uuid, name text, field text, sent text, kept text, banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  return query select c.created_at, c.user_id, coalesce(f.name, '(Konto gelöscht)'), c.field, c.sent, c.kept, coalesce(f.banned, false)
    from public.cheat_log c left join public.fighters f on f.user_id = c.user_id
    order by c.created_at desc limit 60;
end $$;

create or replace function public.mod_ban(target uuid) returns text language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  update public.fighters set banned = true where user_id = target;
  return 'ok';
end $$;

revoke all on function public.mod_reports(), public.mod_decide(text, bigint, uuid, text), public.mod_banned(), public.mod_unban(uuid), public.mod_cheats(), public.mod_ban(uuid) from public, anon;
grant execute on function public.mod_reports(), public.mod_decide(text, bigint, uuid, text), public.mod_banned(), public.mod_unban(uuid), public.mod_cheats(), public.mod_ban(uuid) to authenticated;

-- =============================================================================================
-- 5. Konto löschen (Recht auf Löschung): Spielstand, Kampfwerte, Ruhmeshalle, Gespräche, Briefe an dich,
--    eigene Neuigkeiten, Blockierungen und das Konto selbst. Briefe, die du anderen geschickt hast, bleiben
--    bei ihnen, aber ohne deinen Namen.
-- =============================================================================================
create or replace function public.delete_account() returns text language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Nicht angemeldet.' using errcode = 'P0001'; end if;
  delete from public.news where user_id = me;
  update public.mail set from_user = null, from_name = 'Ein verschwundener Held' where from_user = me;
  delete from auth.users where id = me;
  return 'ok';
end $$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
