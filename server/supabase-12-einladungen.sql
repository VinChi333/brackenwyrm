-- Brackenwyrm, Teil 12: Gilden-Einladungen (ab 0.67)
-- Nach Teil 11 ausführen. Braucht Teil 7 (Gilden).
-- Gildenmeister und Offiziere können Helden per Namen einladen. Der Eingeladene bekommt einen Brief vom Gildenboten
-- und kann in der Gildenhalle annehmen (sofort Mitglied, ohne Bewerbung) oder ablehnen.

create table if not exists public.guild_invites (
  guild_id   bigint not null references public.guilds(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  invited_by text not null default '',
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);
create index if not exists guild_invites_user on public.guild_invites (user_id);
alter table public.guild_invites enable row level security;
revoke all on public.guild_invites from anon, authenticated;

-- Einen Helden einladen (nur Gildenführung). Ist er schon Bewerber bei uns, wird er gleich aufgenommen.
create or replace function public.guild_invite(hero text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me public.guild_members; myname text; g public.guilds; f public.fighters; cur public.guild_members; open_n int;
begin
  select * into me from public.guild_members m where m.user_id = auth.uid();
  if me.user_id is null or me.rank not in ('leader', 'officer') then raise exception 'Einladen darf nur die Gildenführung.' using errcode = 'P0001'; end if;
  select x.name into myname from public.fighters x where x.user_id = auth.uid();
  select * into g from public.guilds x where x.id = me.guild_id;
  select * into f from public.fighters x where lower(x.name) = lower(btrim(coalesce(hero, ''))) and not x.banned order by x.last_seen desc nulls last limit 1;
  if f.user_id is null then raise exception 'Einen Helden mit diesem Namen gibt es nicht.' using errcode = 'P0001'; end if;
  if f.user_id = auth.uid() then raise exception 'Dich selbst musst du nicht einladen.' using errcode = 'P0001'; end if;
  select * into cur from public.guild_members m where m.user_id = f.user_id;
  if cur.user_id is not null and cur.rank <> 'applicant' then
    if cur.guild_id = g.id then raise exception '% ist schon in deiner Gilde.', f.name using errcode = 'P0001'; end if;
    raise exception '% ist schon in einer anderen Gilde.', f.name using errcode = 'P0001';
  end if;
  -- Hat sich schon bei uns beworben: dann einfach aufnehmen
  if cur.user_id is not null and cur.guild_id = g.id then
    update public.guild_members set rank = 'member', since = now() where user_id = f.user_id;
    delete from public.guild_invites where user_id = f.user_id;
    perform public.guild_mail(f.user_id, 'Willkommen in der Gilde', format('Du bist jetzt Mitglied der Gilde „%s“ [%s]. Die Gildenhalle steht dir offen.', g.name, g.tag));
    return jsonb_build_object('name', f.name, 'joined', true);
  end if;
  select count(*) into open_n from public.guild_invites i where i.guild_id = g.id;
  if open_n >= 30 then raise exception 'Es sind schon 30 Einladungen offen. Warte, bis ein paar beantwortet sind.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.guild_invites i where i.guild_id = g.id and i.user_id = f.user_id and i.created_at > now() - interval '1 day') then
    raise exception '% hat schon eine Einladung von euch.', f.name using errcode = 'P0001';
  end if;
  insert into public.guild_invites (guild_id, user_id, invited_by) values (g.id, f.user_id, coalesce(myname, ''))
    on conflict (guild_id, user_id) do update set invited_by = excluded.invited_by, created_at = now();
  perform public.guild_mail(f.user_id, 'Einladung in eine Gilde',
    format('%s lädt dich in die Gilde „%s“ [%s] ein. Annehmen oder ablehnen kannst du in der Gildenhalle.', coalesce(myname, 'Jemand'), g.name, g.tag));
  return jsonb_build_object('name', f.name, 'joined', false);
end $$;

-- Meine offenen Einladungen (leer, wenn ich schon Mitglied einer Gilde bin)
create or replace function public.guild_invites_mine()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('guild_id', g.id, 'name', g.name, 'tag', g.tag, 'invited_by', i.invited_by, 'created_at', i.created_at)
    order by i.created_at desc), '[]'::jsonb)
  from public.guild_invites i join public.guilds g on g.id = i.guild_id
  where i.user_id = auth.uid()
    and not exists (select 1 from public.guild_members m where m.user_id = auth.uid() and m.rank <> 'applicant')
$$;

-- Einladung annehmen oder ablehnen
create or replace function public.guild_invite_answer(gid bigint, accept boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.fighters; cur public.guild_members; g public.guilds; boss uuid;
begin
  select * into f from public.fighters x where x.user_id = auth.uid();
  if f.user_id is null then raise exception 'Kein Spielerkonto gefunden.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.guild_invites i where i.guild_id = gid and i.user_id = f.user_id) then
    raise exception 'Diese Einladung gibt es nicht mehr.' using errcode = 'P0001';
  end if;
  select * into g from public.guilds x where x.id = gid;
  if not accept then
    delete from public.guild_invites where guild_id = gid and user_id = f.user_id;
    return jsonb_build_object('name', g.name, 'tag', g.tag);
  end if;
  if f.banned then raise exception 'Dein Konto ist gesperrt.' using errcode = 'P0001'; end if;
  select * into cur from public.guild_members m where m.user_id = f.user_id;
  if cur.user_id is not null and cur.rank <> 'applicant' then raise exception 'Du bist schon in einer Gilde.' using errcode = 'P0001'; end if;
  delete from public.guild_members where user_id = f.user_id;   -- eine offene Bewerbung anderswo zieht man damit zurück
  insert into public.guild_members (user_id, guild_id, rank) values (f.user_id, g.id, 'member');
  delete from public.guild_invites where user_id = f.user_id;
  for boss in select m.user_id from public.guild_members m where m.guild_id = g.id and m.rank in ('leader', 'officer') loop
    perform public.guild_mail(boss, 'Neues Mitglied', format('%s hat die Einladung angenommen und gehört jetzt zur Gilde „%s“.', f.name, g.name));
  end loop;
  return jsonb_build_object('name', g.name, 'tag', g.tag);
end $$;

revoke all on function public.guild_invite(text), public.guild_invites_mine(), public.guild_invite_answer(bigint, boolean) from public, anon;
grant execute on function public.guild_invite(text), public.guild_invites_mine(), public.guild_invite_answer(bigint, boolean) to authenticated;
