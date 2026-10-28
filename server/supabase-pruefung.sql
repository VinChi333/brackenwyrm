-- Brackenwyrm: Prüfung, ob Teil 1 bis 7 vollständig eingespielt sind.
-- Im Supabase SQL-Editor ausführen. Jede Zeile sollte bei "ok" ein Häkchen (true) haben.
select pruefung, ok from (values
  ('Teil 1: Spielstände und Kämpfer',          to_regclass('public.saves') is not null and to_regclass('public.fighters') is not null),
  ('Teil 2: Dorfplatz und Neuigkeiten',        to_regclass('public.commentary') is not null and to_regclass('public.news') is not null),
  ('Teil 3: Briefe und Spielerkampf',          to_regclass('public.mail') is not null and exists (select 1 from pg_proc where proname = 'pvp_attack')),
  ('Teil 3: Überweisungen erlaubt',            exists (select 1 from pg_constraint where conrelid = to_regclass('public.pvp_events') and contype = 'c' and pg_get_constraintdef(oid) like '%transfer%')),
  ('Teil 4: Wortfilter',                       exists (select 1 from pg_proc where proname = 'bw_censor') and to_regclass('public.bad_words') is not null),
  ('Teil 4: Schummelschutz',                   exists (select 1 from pg_trigger where tgname = 'fighters_guard')),
  ('Teil 4: Melden, Blockieren, Wache',        to_regclass('public.reports') is not null and to_regclass('public.blocks') is not null and to_regclass('public.admins') is not null),
  ('Teil 4: Konto löschen',                    exists (select 1 from pg_proc where proname = 'delete_account')),
  ('Teil 5: Kopfgeld',                         to_regclass('public.bounties') is not null and exists (select 1 from pg_proc where proname = 'bw_after_pvp')),
  ('Teil 5: neueste Fassung (Veit)',           exists (select 1 from pg_proc where proname = 'set_bounty' and prosrc like '%Veit%')),
  ('Teil 5: Überweisen',                       exists (select 1 from pg_proc where proname = 'transfer_gold')),
  ('Teil 5: Fünf Sechser',                     to_regclass('public.jackpot') is not null and exists (select 1 from pg_proc where proname = 'fivesix_roll')),
  ('Teil 5: Aushang',                          to_regclass('public.aushang') is not null),
  ('Teil 5: Ranglisten',                       exists (select 1 from pg_proc where proname = 'hall_of_fame')),
  ('Teil 5: Schutz für Ranglisten',            exists (select 1 from pg_trigger where tgname = 'fighters_guard5')),
  ('Teil 6: zwei Spieltage pro Tag',           exists (select 1 from pg_proc where proname = 'bw_gameday')),
  ('Teil 6: nach Teil 5 ausgeführt',           exists (select 1 from pg_proc where proname = 'fivesix_roll' and prosrc like '%bw_gameday%')),
  ('Teil 7: Gilden',                           to_regclass('public.guilds') is not null and exists (select 1 from pg_proc where proname = 'guild_create')),
  ('Teil 7: Gildengespräch',                   exists (select 1 from pg_proc where proname = 'commentary_prepare' and prosrc like '%gilde%'))
) as t(pruefung, ok);
