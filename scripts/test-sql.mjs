// Prüft die Server-Regeln (server/*.sql) in einem echten Postgres (PGlite), mit nachgebautem Supabase-auth. Aufruf: npm run test:sql
// Test der Supabase-SQL in einem echten Postgres (PGlite) mit nachgebautem auth-Schema und Rollen.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FEHLER ') + m); if (!c) fails++; };
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(readFileSync(new URL('../server/supabase.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-2-dorf.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-2-dorf.sql', import.meta.url), 'utf8')); // zweimal: muss wiederholbar sein
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b', C = '00000000-0000-0000-0000-00000000000c', N = '00000000-0000-0000-0000-00000000000d';
await db.exec(`insert into auth.users values ('${A}','a@x'),('${B}','b@x'),('${C}','c@x'),('${N}','n@x')`);
async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const fighter = (uid, name, level, extra = '') => as(uid, `insert into public.fighters (user_id, name, level, exp, gold, hp, weapon_tier, armor_tier, days_played${extra ? ',' + extra.split('=')[0] : ''})
  values ('${uid}', '${name}', ${level}, 5000, 300, 200, 3, 3, 10${extra ? ',' + extra.split('=')[1] : ''})`);
await fighter(A, 'Angreifer', 5); await fighter(B, 'Opfer', 5); await fighter(C, 'Wach', 6); await fighter(N, 'Neuling', 5);
await db.exec(`update public.fighters set exp = 100, days_played = 2 where user_id = '${N}'`);
await db.exec(`update public.fighters set last_seen = now() - interval '1 hour' where user_id in ('${B}', '${N}')`);

// Rechte
let r = await as(A, `select user_id from public.fighters`);
ok(r.rows.length === 1 && r.rows[0].user_id === A, 'Kampfwerte: jeder sieht nur seine eigenen');
let err = '';
try { await as(A, `update public.fighters set pvp_used = 0 where user_id = '${A}'`); } catch (e) { err = e.message; }
ok(/permission denied/.test(err), 'Spieler darf seine Kampfzähler nicht selbst zurücksetzen');
err = '';
try { await as(A, `update public.fighters set gold = 1 where user_id = '${B}'`); r = await db.query(`select gold from public.fighters where user_id='${B}'`); } catch (e) { err = e.message; }
ok(r.rows[0].gold === 300, 'fremdes Gold lässt sich nicht ändern');

// Zielliste
r = await as(A, `select name, attackable from public.pvp_targets('felder')`);
const names = r.rows.map((x) => x.name);
ok(names.includes('Opfer'), 'schlafendes Opfer steht in der Liste');
ok(!names.includes('Wach'), 'wacher Spieler steht nicht in der Liste');
ok(!names.includes('Neuling'), 'Neuling ist geschützt');
ok(!names.includes('Angreifer'), 'man selbst steht nicht in der Liste');
r = await as(A, `select name from public.pvp_targets('gasthaus')`);
ok(r.rows.length === 0, 'im Gasthaus schläft niemand');

// Angriff
const before = (await db.query(`select gold, exp from public.fighters where user_id in ('${A}','${B}') order by name`)).rows;
r = await as(A, `select public.pvp_attack('${B}', 'felder') as res`);
const res = r.rows[0].res;
ok(Array.isArray(res.rounds) && res.rounds.length > 0, `Kampf berechnet: ${res.rounds.length} Runden, ${res.won ? 'Sieg' : 'Niederlage'}`);
const after = (await db.query(`select name, gold, exp, alive, last_seen < now() - interval '15 minutes' as sleeps from public.fighters where user_id in ('${A}','${B}') order by name`)).rows;
const [aA, aB] = after; // Angreifer, Opfer (alphabetisch)
if (res.won) {
  ok(aB.gold === 0 && !aB.alive && aB.exp === 5000 - 250, 'Opfer: Gold weg, tot, 5 % Erfahrung verloren');
  ok(aA.gold === 600 && aA.exp === 5500, 'Angreifer: Gold des Opfers und 10 % Erfahrung');
} else {
  ok(!aA.alive && aA.gold === 0 && aA.exp === 4250, 'Angreifer verliert: tot, Gold weg, 15 % Erfahrung');
  ok(aB.gold === 600 && aB.exp === 5500, 'Opfer bekommt Gold und 10 % Erfahrung');
}
ok(aB.sleeps, 'Angriff weckt das Opfer nicht auf (zuletzt gesehen unverändert)');
r = await as(B, `select kind, other_name, gold from public.pvp_events where not applied`);
ok(r.rows.length === 1 && r.rows[0].other_name === 'Angreifer', 'Opfer bekommt eine Nachricht');
r = await as(A, `select count(*)::int as n from public.pvp_events`);
ok(r.rows[0].n === 0, 'fremde Nachrichten sind nicht lesbar');
await as(B, `update public.pvp_events set applied = true where user_id = '${B}'`);
r = await as(B, `select count(*)::int as n from public.pvp_events where not applied`);
ok(r.rows[0].n === 0, 'Nachricht lässt sich abhaken');
r = await db.query(`select body from public.news`);
ok(r.rows.length === 1, 'Neuigkeit: ' + r.rows[0].body);

// Zweiter Angriff direkt danach: muss abgelehnt werden
err = '';
await db.exec(`update public.fighters set alive = true where user_id in ('${A}','${B}')`);
try { await as(A, `select public.pvp_attack('${B}', 'felder')`); } catch (e) { err = e.message; }
ok(/gerade erst angegriffen/.test(err), 'Opfer ist danach 10 Minuten sicher: ' + err);
// Tageslimit
await db.exec(`update public.fighters set pvp_flag = null, alive = true where user_id = '${B}'; update public.fighters set pvp_used = 3, pvp_day = current_date where user_id = '${A}'`);
err = '';
try { await as(A, `select public.pvp_attack('${B}', 'felder')`); } catch (e) { err = e.message; }
ok(/3 Spielerkämpfe/.test(err), 'nach 3 Kämpfen ist Schluss: ' + err);
r = await as(A, `select public.pvp_status() as s`);
ok(r.rows[0].s.fights_left === 0, 'Status zeigt 0 Kämpfe übrig');

// Dorfplatz
await as(A, `insert into public.commentary (section, body) values ('dorfplatz', '  Hallo Moosgrund!  ')`);
r = await db.query(`select name, body from public.commentary`);
ok(r.rows[0].name === 'Angreifer' && r.rows[0].body === 'Hallo Moosgrund!', 'Spruch mit Namen vom Server, Leerzeichen entfernt');
err = '';
try { await as(A, `insert into public.commentary (section, body) values ('dorfplatz', 'Nochmal')`); } catch (e) { err = e.message; }
ok(/Nicht so schnell/.test(err), 'zu schnelles Schreiben wird gebremst');
err = '';
try { await as(A, `insert into public.commentary (user_id, section, body) values ('${B}', 'dorfplatz', 'Ich bin B')`); } catch (e) { err = e.message; }
ok(/permission denied|row-level security/.test(err), 'man kann nicht im Namen anderer schreiben');
await db.exec(`reset role; set role anon`);
r = await db.query(`select count(*)::int as n from public.commentary`);
await db.exec('reset role');
ok(r.rows[0].n === 1, 'Dorfplatz ist auch ohne Anmeldung lesbar');
await as(A, `insert into public.news (body) values ('Angreifer hat den Brackenwyrm besiegt!')`);
r = await db.query(`select user_id from public.news where body like '%Brackenwyrm%'`);
ok(r.rows[0].user_id === A, 'eigene Neuigkeit wird dem Spieler zugeordnet');

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
