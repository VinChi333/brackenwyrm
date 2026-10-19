-- Brackenwyrm: Datenbank für Spielerkonto, Online-Spielstand und Ruhmeshalle.
-- Einmal im Supabase-Projekt unter "SQL Editor" ausführen.

-- Ein Spielstand pro Spieler. Nur der Spieler selbst kann ihn lesen und schreiben.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb  not null check (pg_column_size(data) < 512000),
  saved_at   bigint not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "Spielstand lesen (nur eigener)"   on public.saves for select to authenticated using (auth.uid() = user_id);
create policy "Spielstand anlegen (nur eigener)" on public.saves for insert to authenticated with check (auth.uid() = user_id);
create policy "Spielstand ändern (nur eigener)"  on public.saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Öffentliche Angaben für die Ruhmeshalle. Alle dürfen lesen, jeder schreibt nur seine eigene Zeile.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 20),
  level        int  not null check (level between 1 and 15),
  dragon_kills int  not null default 0 check (dragon_kills >= 0),
  updated_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Ruhmeshalle lesen (alle)"        on public.profiles for select to anon, authenticated using (true);
create policy "Profil anlegen (nur eigenes)"    on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "Profil ändern (nur eigenes)"     on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists profiles_fame on public.profiles (dragon_kills desc, level desc);
