-- Brackenwyrm, Teil 7: Gilden.
-- Nach Teil 1 bis 6 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
--   Helden schließen sich zu Gilden zusammen: gründen (ab Stufe 5 oder mit Drachenkill, kostet 3000 Gold),
--   Beitritt anfragen, aufnehmen oder ablehnen, Ränge (Gildenmeister, Offizier, Mitglied), Gildenhalle mit
--   eigenem Gespräch, Nachricht der Gildenführung und Beschreibung. Das Gildenkürzel steht in Gesprächen vor dem Namen.
--   Alles läuft über Funktionen mit festen Regeln, die Tabellen selbst sind für Spieler gesperrt.

-- =============================================================================================
-- Tabellen
-- =============================================================================================
create table if not exists public.guilds (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null unique check (char_length(name) between 3 and 30),
  tag        text not null unique check (tag ~ '^[A-ZÄÖÜ0-9]{2,4}$'),
  motd       text not null default '' check (char_length(motd) <= 300),
  descr      text not null default '' check (char_length(descr) <= 600)
);
create table if not exists public.guild_members (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  guild_id bigint not null references public.guilds(id) on delete cascade,
  rank     text not null check (rank in ('leader', 'officer', 'member', 'applicant')),
  since    timestamptz not null default now()
);
create index if not exists guild_members_guild on public.guild_members (guild_id, rank);
alter table public.guilds enable row level security;
alter table public.guild_members enable row level security;
revoke all on public.guilds, public.guild_members from anon, authenticated;

-- Meine Gilde (nur als richtiges Mitglied, nicht als Bewerber)
create or replace function public.my_guild_id() returns bigint language sql stable security definer set search_path = public as $$
  select m.guild_id from public.guild_members m where m.user_id = auth.uid() and m.rank <> 'applicant'
$$;
revoke all on function public.my_guild_id() from public, anon;
grant execute on function public.my_guild_id() to authenticated;

-- Verlässt der Gildenmeister die Gilde (oder löscht sein Konto), übernimmt der dienstälteste Offizier, sonst das
-- dienstälteste Mitglied. Ist niemand mehr da, wird die Gilde aufgelöst.
create or replace function public.guild_after_leave() returns trigger language plpgsql security definer set search_path = public as $$
declare heir uuid;
begin
  if old.rank = 'leader' then
    select m.user_id into heir from public.guild_members m
      where m.guild_id = old.guild_id and m.rank in ('officer', 'member')
      order by (m.rank = 'officer') desc, m.since limit 1;
    if heir is null then
      delete from public.guilds where id = old.guild_id;
    else
      update public.guild_members set rank = 'leader' where user_id = heir;
    end if;
  end if;
  return old;
end $$;
drop trigger if exists guild_after_leave on public.guild_members;
create trigger guild_after_leave after delete on public.guild_members for each row execute function public.guild_after_leave();

-- Systembrief an einen Helden (wie bei Morwen)
create or replace function public.guild_mail(target uuid, subj text, txt text) returns void language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.mail') is null then return; end if;
  perform set_config('bw.system_mail', 'on', true);
  insert into public.mail (from_user, from_name, to_user, subject, body) values (null, 'Gildenbote', target, subj, txt);
  perform set_config('bw.system_mail', 'off', true);
end $$;
revoke all on function public.guild_mail(uuid, text, text) from public, anon, authenticated;

-- =============================================================================================
-- Lesen
-- =============================================================================================
create or replace function public.guild_list()
returns table (id bigint, name text, tag text, members int, leader text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.tag,
         (select count(*)::int from public.guild_members m where m.guild_id = g.id and m.rank <> 'applicant'),
         (select f.name from public.guild_members m join public.fighters f on f.user_id = m.user_id where m.guild_id = g.id and m.rank = 'leader' limit 1),
         g.created_at
  from public.guilds g
  order by 4 desc, g.created_at
  limit 100
$$;

-- Kürzel aller Gildenmitglieder (für Kriegerliste und Steckbriefe)
create or replace function public.guild_tags()
returns table (user_id uuid, tag text)
language sql stable security definer set search_path = public as $$
  select m.user_id, g.tag from public.guild_members m join public.guilds g on g.id = m.guild_id where m.rank <> 'applicant'
$$;

-- Alles über die eigene Gilde (oder die offene Bewerbung)
create or replace function public.guild_mine()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me public.guild_members; g public.guilds;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  if me.user_id is null then return null; end if;
  select * into g from public.guilds x where x.id = me.guild_id;
  if me.rank = 'applicant' then
    return jsonb_build_object('rank', 'applicant', 'guild', jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag));
  end if;
  return jsonb_build_object(
    'rank', me.rank,
    'guild', jsonb_build_object('id', g.id, 'name', g.name, 'tag', g.tag, 'motd', g.motd, 'descr', g.descr, 'created_at', g.created_at),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', f.user_id, 'name', f.name, 'level', f.level, 'gender', f.gender,
        'dragon_kills', f.dragon_kills, 'rank', m.rank, 'online', f.last_seen > now() - interval '15 minutes', 'since', m.since)
        order by case m.rank when 'leader' then 0 when 'officer' then 1 else 2 end, f.dragon_kills desc, f.level desc)
      from public.guild_members m join public.fighters f on f.user_id = m.user_id where m.guild_id = g.id and m.rank <> 'applicant'), '[]'::jsonb),
    'applicants', case when me.rank in ('leader', 'officer') then coalesce((select jsonb_agg(jsonb_build_object('user_id', f.user_id, 'name', f.name,
        'level', f.level, 'gender', f.gender, 'dragon_kills', f.dragon_kills, 'since', m.since) order by m.since)
      from public.guild_members m join public.fighters f on f.user_id = m.user_id where m.guild_id = g.id and m.rank = 'applicant'), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;

-- =============================================================================================
-- Gründen, beitreten, verlassen
-- =============================================================================================
create or replace function public.guild_create(gname text, gtag text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.fighters; cur public.guild_members; gid bigint; nm text; tg text; cost int := 3000;
begin
  select * into f from public.fighters x where x.user_id = auth.uid() for update;
  if f.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if f.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  if f.level < 5 and f.dragon_kills < 1 then raise exception 'Eine Gilde gründen kann man erst ab Stufe 5.' using errcode = 'P0001'; end if;
  select * into cur from public.guild_members m where m.user_id = f.user_id;
  if cur.user_id is not null and cur.rank <> 'applicant' then raise exception 'Du bist schon in einer Gilde.' using errcode = 'P0001'; end if;
  nm := btrim(regexp_replace(coalesce(gname, ''), '\s+', ' ', 'g'));
  tg := upper(btrim(coalesce(gtag, '')));
  if char_length(nm) < 3 or char_length(nm) > 30 then raise exception 'Der Gildenname braucht 3 bis 30 Zeichen.' using errcode = 'P0001'; end if;
  if tg !~ '^[A-ZÄÖÜ0-9]{2,4}$' then raise exception 'Das Kürzel braucht 2 bis 4 Buchstaben oder Ziffern.' using errcode = 'P0001'; end if;
  if public.bw_censor(nm) <> nm or public.bw_censor(tg) <> tg then raise exception 'Dieser Name geht leider nicht.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.guilds g where lower(g.name) = lower(nm)) then raise exception 'Diesen Gildennamen gibt es schon.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.guilds g where g.tag = tg) then raise exception 'Dieses Kürzel ist schon vergeben.' using errcode = 'P0001'; end if;
  if f.gold < cost then raise exception 'Eine Gilde zu gründen kostet % Gold. So viel hast du nicht dabei.', cost using errcode = 'P0001'; end if;
  update public.fighters set gold = gold - cost where user_id = f.user_id;
  delete from public.guild_members where user_id = f.user_id;
  insert into public.guilds (name, tag) values (nm, tg) returning id into gid;
  insert into public.guild_members (user_id, guild_id, rank) values (f.user_id, gid, 'leader');
  insert into public.news (user_id, body) values (null, format('%s hat die Gilde „%s“ [%s] gegründet.', f.name, nm, tg));
  return jsonb_build_object('id', gid, 'name', nm, 'tag', tg, 'paid', cost);
end $$;

create or replace function public.guild_apply(gid bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.fighters; cur public.guild_members; g public.guilds; boss uuid;
begin
  select * into f from public.fighters x where x.user_id = auth.uid();
  if f.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if f.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select * into cur from public.guild_members m where m.user_id = f.user_id;
  if cur.user_id is not null and cur.rank <> 'applicant' then raise exception 'Du bist schon in einer Gilde.' using errcode = 'P0001'; end if;
  select * into g from public.guilds x where x.id = gid;
  if g.id is null then raise exception 'Diese Gilde gibt es nicht mehr.' using errcode = 'P0001'; end if;
  delete from public.guild_members where user_id = f.user_id;
  insert into public.guild_members (user_id, guild_id, rank) values (f.user_id, g.id, 'applicant');
  for boss in select m.user_id from public.guild_members m where m.guild_id = g.id and m.rank in ('leader', 'officer') loop
    perform public.guild_mail(boss, 'Neue Bewerbung', format('%s möchte in die Gilde „%s“ aufgenommen werden. Entscheide in der Gildenhalle.', f.name, g.name));
  end loop;
  return jsonb_build_object('name', g.name, 'tag', g.tag);
end $$;

create or replace function public.guild_withdraw()
returns void language sql volatile security definer set search_path = public as $$
  delete from public.guild_members where user_id = auth.uid() and rank = 'applicant'
$$;

create or replace function public.guild_leave()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.guild_members where user_id = auth.uid();
end $$;

-- =============================================================================================
-- Führung: aufnehmen, ablehnen, hinauswerfen, Ränge, Texte
-- =============================================================================================
create or replace function public.guild_decide(target uuid, accept boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare me public.guild_members; t public.guild_members; g public.guilds;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  if me.user_id is null or me.rank not in ('leader', 'officer') then raise exception 'Das darf nur die Gildenführung.' using errcode = 'P0001'; end if;
  select * into t from public.guild_members m where m.user_id = target for update;
  if t.user_id is null or t.guild_id <> me.guild_id or t.rank <> 'applicant' then raise exception 'Diese Bewerbung gibt es nicht mehr.' using errcode = 'P0001'; end if;
  select * into g from public.guilds x where x.id = me.guild_id;
  if accept then
    update public.guild_members set rank = 'member', since = now() where user_id = target;
    perform public.guild_mail(target, 'Willkommen in der Gilde', format('Du bist jetzt Mitglied der Gilde „%s“ [%s]. Die Gildenhalle steht dir offen.', g.name, g.tag));
  else
    delete from public.guild_members where user_id = target;
    perform public.guild_mail(target, 'Bewerbung abgelehnt', format('Die Gilde „%s“ hat deine Bewerbung leider abgelehnt.', g.name));
  end if;
end $$;

create or replace function public.guild_kick(target uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare me public.guild_members; t public.guild_members; g public.guilds;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  select * into t from public.guild_members m where m.user_id = target;
  if me.user_id is null or t.user_id is null or t.guild_id <> me.guild_id or target = me.user_id then
    raise exception 'Das geht nicht.' using errcode = 'P0001';
  end if;
  if not (me.rank = 'leader' or (me.rank = 'officer' and t.rank = 'member')) then
    raise exception 'Das darf nur die Gildenführung.' using errcode = 'P0001';
  end if;
  select * into g from public.guilds x where x.id = me.guild_id;
  delete from public.guild_members where user_id = target;
  perform public.guild_mail(target, 'Aus der Gilde entlassen', format('Du gehörst nicht mehr zur Gilde „%s“.', g.name));
end $$;

create or replace function public.guild_rank(target uuid, new_rank text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare me public.guild_members; t public.guild_members;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  select * into t from public.guild_members m where m.user_id = target;
  if me.user_id is null or me.rank <> 'leader' then raise exception 'Das darf nur der Gildenmeister.' using errcode = 'P0001'; end if;
  if t.user_id is null or t.guild_id <> me.guild_id or t.rank = 'applicant' or target = me.user_id then raise exception 'Das geht nicht.' using errcode = 'P0001'; end if;
  if new_rank not in ('leader', 'officer', 'member') then raise exception 'Diesen Rang gibt es nicht.' using errcode = 'P0001'; end if;
  if new_rank = 'leader' then
    update public.guild_members set rank = 'officer' where user_id = me.user_id;
  end if;
  update public.guild_members set rank = new_rank where user_id = target;
end $$;

create or replace function public.guild_text(motd text, descr text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare me public.guild_members;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  if me.user_id is null or me.rank not in ('leader', 'officer') then raise exception 'Das darf nur die Gildenführung.' using errcode = 'P0001'; end if;
  update public.guilds set motd = left(public.bw_censor(btrim(coalesce(guild_text.motd, ''))), 300),
                           descr = left(public.bw_censor(btrim(coalesce(guild_text.descr, ''))), 600)
    where id = me.guild_id;
end $$;

revoke all on function public.guild_list(), public.guild_tags(), public.guild_mine(), public.guild_create(text, text), public.guild_apply(bigint),
  public.guild_withdraw(), public.guild_leave(), public.guild_decide(uuid, boolean), public.guild_kick(uuid), public.guild_rank(uuid, text),
  public.guild_text(text, text) from public, anon;
grant execute on function public.guild_list(), public.guild_tags() to anon, authenticated;
grant execute on function public.guild_mine(), public.guild_create(text, text), public.guild_apply(bigint), public.guild_withdraw(),
  public.guild_leave(), public.guild_decide(uuid, boolean), public.guild_kick(uuid), public.guild_rank(uuid, text), public.guild_text(text, text) to authenticated;

-- =============================================================================================
-- Gildengespräch: eigener Ort "gilde", nur für Mitglieder lesbar. Das Kürzel steht vor dem Namen.
-- =============================================================================================
alter table public.commentary add column if not exists guild_id bigint references public.guilds(id) on delete cascade;
alter table public.commentary drop constraint if exists commentary_section_check;
alter table public.commentary add constraint commentary_section_check check (section in ('dorfplatz', 'gasthaus', 'schattenreich', 'felsen', 'garten', 'gilde'));
drop policy if exists "Dorfplatz lesen (alle)" on public.commentary;
create policy "Dorfplatz lesen (alle)" on public.commentary for select to anon, authenticated
  using (not hidden and (section <> 'gilde' or guild_id = public.my_guild_id()));
grant execute on function public.my_guild_id() to anon;

-- neueste Fassung (ersetzt die aus Teil 4)
create or replace function public.commentary_prepare() returns trigger language plpgsql security definer set search_path = public as $$
declare f public.fighters; gid bigint; tg text;
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
  select m.guild_id, g.tag into gid, tg from public.guild_members m join public.guilds g on g.id = m.guild_id
    where m.user_id = new.user_id and m.rank <> 'applicant';
  if new.section = 'gilde' then
    if gid is null then raise exception 'Du gehörst zu keiner Gilde.' using errcode = 'P0001'; end if;
    new.guild_id := gid;
  else
    new.guild_id := null;
  end if;
  new.name := coalesce('[' || tg || '] ', '') || public.f_title(f.dragon_kills, f.gender) || ' ' || f.name;
  new.body := left(public.bw_censor(btrim(new.body)), 200);
  new.hidden := false;
  return new;
end $$;
