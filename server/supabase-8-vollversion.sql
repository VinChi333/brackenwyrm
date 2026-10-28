-- Brackenwyrm, Teil 8: Vollversion.
-- Nach Teil 1 bis 7 einmal im SQL Editor ausführen. Kann gefahrlos erneut ausgeführt werden.
--
--   Bis zum ersten Drachen ist das Spiel gratis. Danach braucht ein Held die Vollversion, um ein neues Leben zu beginnen.
--   Die Vollversion hängt am Spielerkonto und gilt damit auf allen Geräten.
--   Freischalten geht über einen Code (die Wache erzeugt Codes, z. B. für Käufer oder Tester) oder direkt durch die Wache.
--   Später können Kaufwege (Steam, Play Store, App Store, Webseite) hier ebenfalls eintragen.

create table if not exists public.full_version (
  user_id uuid primary key references auth.users(id) on delete cascade,
  since   timestamptz not null default now(),
  source  text not null check (source in ('code', 'wache', 'steam', 'google', 'apple', 'web')),
  ref     text not null default ''
);
create table if not exists public.unlock_codes (
  code        text primary key,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  note        text not null default '',
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz
);
create table if not exists public.code_attempts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade
);
create index if not exists code_attempts_recent on public.code_attempts (user_id, created_at desc);
alter table public.full_version enable row level security;
alter table public.unlock_codes enable row level security;
alter table public.code_attempts enable row level security;
revoke all on public.full_version, public.unlock_codes, public.code_attempts from anon, authenticated;

-- Habe ich die Vollversion?
create or replace function public.has_full() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.full_version v where v.user_id = auth.uid())
$$;

-- Code einlösen. Schreibweise egal: "bw-abcd-efgh", "BWABCDEFGH" und "BW ABCD EFGH" sind derselbe Code.
create or replace function public.redeem_code(code text) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c text; rec public.unlock_codes; me uuid := auth.uid();
begin
  if me is null then raise exception 'Nicht angemeldet.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.full_version v where v.user_id = me) then return jsonb_build_object('ok', true, 'already', true); end if;
  if (select count(*) from public.code_attempts a where a.user_id = me and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Versuche. Probier es in einer Stunde wieder.' using errcode = 'P0001';
  end if;
  c := upper(regexp_replace(coalesce(redeem_code.code, ''), '[^A-Za-z0-9]', '', 'g'));
  if c like 'BW%' then c := substr(c, 3); end if;
  c := 'BW-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  select * into rec from public.unlock_codes u where u.code = c for update;
  if rec.code is null or rec.redeemed_by is not null then
    -- kein Fehler werfen, sonst wäre auch der Versuch wieder weg (der zählt für die Sperre nach 10 Fehlversuchen)
    insert into public.code_attempts (user_id) values (me);
    return jsonb_build_object('ok', false, 'error', 'Dieser Code ist ungültig oder wurde schon eingelöst.');
  end if;
  update public.unlock_codes set redeemed_by = me, redeemed_at = now() where unlock_codes.code = c;
  insert into public.full_version (user_id, source, ref) values (me, 'code', c) on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true, 'already', false);
end $$;

-- Wache: Vollversion an einen Helden verschenken (z. B. Tester)
create or replace function public.mod_grant_full(hero text) returns text language plpgsql volatile security definer set search_path = public as $$
declare f public.fighters;
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  select * into f from public.fighters x where lower(x.name) = lower(btrim(hero)) limit 1;
  if f.user_id is null then raise exception 'Diesen Helden gibt es nicht.' using errcode = 'P0001'; end if;
  insert into public.full_version (user_id, source, ref) values (f.user_id, 'wache', 'von der Wache') on conflict (user_id) do nothing;
  return f.name;
end $$;

-- Wache: neue Codes erzeugen (ohne leicht verwechselbare Zeichen wie 0/O und 1/I)
create or replace function public.mod_make_codes(n int, note text) returns setof text language plpgsql volatile security definer set search_path = public as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int; k int;
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  if n < 1 or n > 100 then raise exception 'Zwischen 1 und 100 Codes auf einmal.' using errcode = 'P0001'; end if;
  for i in 1..n loop
    loop
      c := 'BW-';
      for k in 1..8 loop
        c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1);
        if k = 4 then c := c || '-'; end if;
      end loop;
      exit when not exists (select 1 from public.unlock_codes u where u.code = c);
    end loop;
    insert into public.unlock_codes (code, created_by, note) values (c, auth.uid(), left(coalesce(note, ''), 100));
    return next c;
  end loop;
end $$;

-- Wache: alle Codes mit Status
create or replace function public.mod_codes()
returns table (code text, created_at timestamptz, note text, redeemed_by text, redeemed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nur für die Wache.' using errcode = 'P0001'; end if;
  return query select u.code, u.created_at, u.note, f.name, u.redeemed_at
    from public.unlock_codes u left join public.fighters f on f.user_id = u.redeemed_by
    order by u.created_at desc limit 300;
end $$;

revoke all on function public.has_full(), public.redeem_code(text), public.mod_grant_full(text), public.mod_make_codes(int, text), public.mod_codes() from public, anon;
grant execute on function public.has_full(), public.redeem_code(text), public.mod_grant_full(text), public.mod_make_codes(int, text), public.mod_codes() to authenticated;

-- Ohne Vollversion zählt online höchstens der erste Drachenkill (Ruhmeshalle und Titel bleiben fair).
create or replace function public.fighters_guard8() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is distinct from new.user_id then return new; end if;
  if new.dragon_kills > 1 and not exists (select 1 from public.full_version v where v.user_id = new.user_id) then
    new.dragon_kills := greatest(1, coalesce(case when tg_op = 'UPDATE' then old.dragon_kills end, 1));
  end if;
  return new;
end $$;
drop trigger if exists fighters_guard8 on public.fighters;
create trigger fighters_guard8 before insert or update on public.fighters for each row execute function public.fighters_guard8();
