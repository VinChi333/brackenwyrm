// Prüft die Server-Regeln (server/*.sql) in einem echten Postgres (PGlite), mit nachgebautem Supabase-auth. Aufruf: npm run test:sql
// Test der Supabase-SQL in einem echten Postgres (PGlite) mit nachgebautem auth-Schema und Rollen.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { BAD_WORDS, censor } from '../src/content/badwords.ts';
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
await db.exec(readFileSync(new URL('../server/supabase-3-briefe.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-3-briefe.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-4-schutz.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-4-schutz.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-5-dorfleben.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../server/supabase-4-schutz.sql', import.meta.url), 'utf8')); // Teil 4 nach Teil 5 darf nichts kaputt machen
await db.exec(readFileSync(new URL('../server/supabase-5-dorfleben.sql', import.meta.url), 'utf8'));
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
ok(/^[A-ZÄÖÜ][\wäöü ]+ Angreifer$/.test(r.rows[0].name) && r.rows[0].body === 'Hallo Moosgrund!', 'Spruch mit Titel und Namen vom Server, Leerzeichen entfernt: ' + r.rows[0].name);
r = await db.query(`select public.f_title(0, 'm') a, public.f_title(11, 'f') b, public.f_title(99, 'f') c`);
ok(r.rows[0].a === 'Bauernjunge' && r.rows[0].b === 'Gräfin' && r.rows[0].c === 'Göttin', 'Titelleiter wie im Spiel: ' + Object.values(r.rows[0]).join(', '));
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

// Rassen und Fähigkeiten wie im Original
await as(A, `update public.fighters set race = 'troll', specialty = 'dunkel' where user_id = '${A}'`);
r = await db.query(`select public.f_attack(f) a, public.f_defense(f) d, race from public.fighters f where user_id in ('${A}', '${B}') order by name`);
const [ang, opf] = r.rows;
ok(ang.race === 'troll' && ang.a === opf.a + 2 && ang.d === opf.d, `Troll hat mehr Angriff (Stufe 5: +2): ${ang.a} gegen ${opf.a}`);
await as(B, `update public.fighters set race = 'elf' where user_id = '${B}'`);
r = await db.query(`select public.f_defense(f) d from public.fighters f where user_id = '${B}'`);
ok(r.rows[0].d === opf.d + 2, 'Elf hat mehr Verteidigung');
let bad = false; try { await as(B, `update public.fighters set race = 'ork' where user_id = '${B}'`); } catch { bad = true; }
ok(bad, 'unbekannte Rasse wird abgelehnt');
let legacy = true; try { await as(B, `update public.fighters set specialty = 'schleich' where user_id = '${B}'`); } catch { legacy = false; }
ok(legacy, 'alte Fähigkeitsnamen sind noch erlaubt (ältere Spielversionen)');
await as(A, `select * from public.pvp_targets('felder')`).then((x) => ok('race' in (x.rows[0] ?? { race: 1 }), 'Ziel-Liste liefert die Rasse'));

// Kriegerliste und Briefe
r = await as(A, `select * from public.warriors()`);
ok(r.rows.length === 4 && !('gold' in r.rows[0]) && 'online' in r.rows[0], `Kriegerliste: ${r.rows.length} Helden, ohne Gold`);
let anonList = true; try { await db.exec(`reset role; set role anon;`); await db.query(`select * from public.warriors()`); } catch { anonList = false; } finally { await db.exec('reset role'); }
ok(!anonList, 'Kriegerliste nur für angemeldete Spieler');
await as(A, `insert into public.mail (to_user, subject, body) values ('${B}', '  Hallo  ', '  Ich komme dich heute Nacht besuchen.  ')`);
r = await as(B, `select from_name, from_user, subject, body, seen from public.mail`);
ok(r.rows.length === 1 && r.rows[0].from_name.endsWith('Angreifer') && r.rows[0].from_user === A && r.rows[0].subject === 'Hallo', 'Brief kommt an, Absender vom Server: ' + r.rows[0]?.from_name);
r = await as(C, `select * from public.mail`);
ok(r.rows.length === 0, 'fremde Briefe sind nicht lesbar');
r = await as(A, `select * from public.mail`);
ok(r.rows.length === 0, 'auch der Absender sieht den Brief nicht mehr (nur Posteingang)');
let fast = false; try { await as(A, `insert into public.mail (to_user, body) values ('${B}', 'Nochmal')`); } catch (e) { fast = /Nicht so schnell/.test(e.message); }
ok(fast, 'zu schnelles Schreiben wird gebremst');
let fake = false; try { await as(C, `insert into public.mail (to_user, body, from_name) values ('${B}', 'x', 'Angreifer')`); } catch { fake = true; }
ok(fake, 'Absendername lässt sich nicht fälschen (Spalte gesperrt)');
let ghost = false; try { await as(C, `insert into public.mail (to_user, body) values ('00000000-0000-0000-0000-0000000000ff', 'x')`); } catch (e) { ghost = /gibt es nicht|foreign key/.test(e.message); }
ok(ghost, 'Briefe an Unbekannte werden abgelehnt');
await as(B, `update public.mail set seen = true`);
r = await as(B, `select seen from public.mail`);
ok(r.rows[0].seen === true, 'Brief als gelesen markiert');
await as(C, `delete from public.mail`);
r = await as(B, `select count(*)::int n from public.mail`);
ok(r.rows[0].n === 1, 'andere können fremde Briefe nicht löschen');
await as(B, `delete from public.mail`);
r = await as(B, `select count(*)::int n from public.mail`);
ok(r.rows[0].n === 0, 'eigene Briefe lassen sich wegwerfen');

// Steckbrief
await as(A, `update public.fighters set bio = 'Ich jage Wyrme.', mount = 'pony', married_to = 'frieda' where user_id = '${A}'`);
r = await as(B, `select bio, mount, married_to from public.warriors() where name = 'Angreifer'`);
ok(r.rows[0]?.bio === 'Ich jage Wyrme.' && r.rows[0].mount === 'pony' && r.rows[0].married_to === 'frieda', 'Steckbrief für andere sichtbar');
let longBio = false; try { await as(A, `update public.fighters set bio = repeat('x', 401) where user_id = '${A}'`); longBio = (await db.query(`select char_length(bio) n from public.fighters where user_id = '${A}'`)).rows[0].n === 400; } catch { longBio = true; }
await as(A, `update public.fighters set bio = 'Ich jage Wyrme.' where user_id = '${A}'`);
ok(longBio, 'Steckbrief höchstens 400 Zeichen');
let foreignBio = false; await as(B, `update public.fighters set bio = 'gehackt' where user_id = '${A}'`);
r = await db.query(`select bio from public.fighters where user_id = '${A}'`); foreignBio = r.rows[0].bio !== 'gehackt';
ok(foreignBio, 'fremden Steckbrief kann man nicht ändern');

// Spuken
await db.exec(`update public.fighters set alive = false, level = 15 where user_id = '${C}'; update public.fighters set alive = true, level = 1, haunted_at = null where user_id = '${B}'`);
let notDead = false; try { await as(A, `select public.haunt('${B}')`); } catch (e) { notDead = /Nur Tote/.test(e.message); }
ok(notDead, 'Lebende können nicht spuken');
let hres = null;
for (let i = 0; i < 20 && !(hres && hres.success); i++) {
  await db.exec(`update public.fighters set haunted_at = null where user_id = '${B}'; delete from public.hauntings`);
  hres = (await as(C, `select public.haunt('${B}') j`)).rows[0].j;
}
ok(hres && hres.success, 'Spuken klappt (Stufe 15 gegen Stufe 1)');
r = await as(B, `select kind, other_name from public.pvp_events where kind = 'haunted'`);
ok(r.rows.length >= 1 && r.rows[0].other_name === 'Wach', 'Opfer bekommt die Nachricht zum Abziehen der Waldkämpfe');
r = await as(B, `select from_name, from_user, subject from public.mail where subject = 'Du wurdest heimgesucht'`);
ok(r.rows.length >= 1 && r.rows[0].from_name === 'Morwen' && r.rows[0].from_user === null, 'Brief von Morwen an das Opfer');
let twice = false; try { await as(C, `select public.haunt('${B}')`); } catch (e) { twice = /schon heimgesucht/.test(e.message); }
ok(twice, 'nur einmal pro Tag heimsuchbar');
await db.exec(`update public.fighters set haunted_at = null`);
await db.exec(`insert into public.hauntings (user_id, target, success) select '${C}', '${B}', false from generate_series(1, 4)`);
let limit = false; try { await as(C, `select public.haunt('${B}')`); } catch (e) { limit = /genug von deinem Gespuke/.test(e.message); }
ok(limit, 'höchstens 4-mal Spuken am Tag');
let fakeSys = false; try { await as(A, `insert into public.mail (to_user, body) values ('${B}', 'Ich bin Morwen')`); r = await as(B, `select from_name from public.mail where body = 'Ich bin Morwen'`); fakeSys = r.rows[0]?.from_name !== 'Morwen'; } catch { fakeSys = true; }
ok(fakeSys, 'Spieler können keine Briefe als Morwen schicken');
await db.exec(`update public.fighters set alive = true where user_id = '${C}'`);

// ---------- Teil 4: Wortfilter ----------
r = await db.query(`select word from public.bad_words order by word`);
ok(JSON.stringify(r.rows.map((x) => x.word).sort()) === JSON.stringify([...BAD_WORDS].sort()), `Wortliste in Datenbank und Spiel gleich (${r.rows.length} Einträge)`);
const samples = ['Du Arschloch!', 'f1ck dich', 'FIIICK', 'du w.i.c.h.s.e.r', 'Scunthorpe', 'Hure!', 'Churer Rheintal', 'eine Gerade', 'kill   yourself', 'Hallo Moosgrund', 'Spaß im Gasthaus', 'Mist, verdammt', '@rschl0ch', 'fag', 'Fagott spielen', 'Hitlerbart', 'bitches'];
let same = 0;
for (const t of samples) {
  const sv = (await db.query(`select public.bw_censor($1) c`, [t])).rows[0].c;
  if (sv === censor(t)) same++; else console.log('   anders:', JSON.stringify(t), '→ Server', JSON.stringify(sv), 'Spiel', JSON.stringify(censor(t)));
}
ok(same === samples.length, `Spiel und Server filtern gleich (${same}/${samples.length})`);
r = await db.query(`select public.bw_censor('Du Arschloch!') a, public.bw_censor('Scunthorpe') b, public.bw_censor('Churer Rheintal') c, public.bw_censor('eine Gerade') d, public.bw_censor('Mist, verdammt') e`);
ok(r.rows[0].a === 'Du ***!' && r.rows[0].b === 'Scunthorpe' && r.rows[0].c === 'Churer Rheintal' && r.rows[0].d === 'eine Gerade' && r.rows[0].e === 'Mist, verdammt', 'Filter trifft Grobes, lässt Harmloses stehen');
await db.exec(`update public.commentary set created_at = now() - interval '1 minute'`);
await as(A, `insert into public.commentary (section, body) values ('gasthaus', 'Ihr W1chser!')`);
r = await db.query(`select body from public.commentary where section = 'gasthaus'`);
ok(r.rows[0]?.body === 'Ihr ***!', 'Gespräch wird gefiltert: ' + r.rows[0]?.body);
await db.exec(`update public.mail set created_at = now() - interval '1 minute'`);
await as(C, `insert into public.mail (to_user, subject, body) values ('${B}', 'Du Fotze', 'Hallo du Hurensohn')`);
r = await db.query(`select subject, body from public.mail where from_user = '${C}'`);
ok(r.rows[0]?.subject === 'Du ***' && r.rows[0]?.body === 'Hallo du ***', 'Briefe werden gefiltert');
await as(B, `update public.fighters set name = 'Bitchy', bio = 'Ich bin ein Arschloch.' where user_id = '${B}'`);
r = await db.query(`select name, bio from public.fighters where user_id = '${B}'`);
ok(r.rows[0].name === '***y' && r.rows[0].bio === 'Ich bin ein ***.', 'Name und Steckbrief werden gefiltert');
await as(B, `update public.fighters set name = 'Opfer', bio = '' where user_id = '${B}'`);

// ---------- Teil 4: Neuigkeiten nur über sich selbst ----------
const newsBefore = (await db.query(`select count(*)::int n from public.news`)).rows[0].n;
await as(A, `insert into public.news (body) values ('Opfer hat den Brackenwyrm besiegt!')`);
await as(A, `insert into public.news (body) values ('Angreifer hat einen Fuck gefunden.')`);
r = await db.query(`select body from public.news order by id desc limit 2`);
ok((await db.query(`select count(*)::int n from public.news`)).rows[0].n === newsBefore + 1 && r.rows[0].body === 'Angreifer hat einen *** gefunden.', 'falsche Neuigkeiten über andere fallen weg, eigene werden gefiltert');

// ---------- Teil 4: Schummelschutz ----------
await db.exec(`update public.fighters set dragon_kills = 0, last_dk_at = null, level = 5, level_day = null, level_gain = 0, bonus_atk = 0, bonus_def = 0, base_max_hp = 0, banned = false where user_id = '${A}'; delete from public.cheat_log`);
await as(A, `update public.fighters set dragon_kills = 5 where user_id = '${A}'`);
r = await db.query(`select dragon_kills, last_dk_at is not null as t from public.fighters where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 1 && r.rows[0].t, 'Drachenkills: +5 wird zu +1');
await as(A, `update public.fighters set dragon_kills = 2, level = 1 where user_id = '${A}'`);
r = await db.query(`select dragon_kills from public.fighters where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 1, 'zweiter Drachenkill gleich danach zählt nicht');
await db.exec(`update public.fighters set last_dk_at = now() - interval '5 days' where user_id = '${A}'`);
await as(A, `update public.fighters set dragon_kills = 2 where user_id = '${A}'`);
r = await db.query(`select dragon_kills from public.fighters where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 2, 'nach 4 Tagen zählt der nächste');
r = await db.query(`select name, dragon_kills, level from public.profiles where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 2, 'Ruhmeshalle übernimmt die geprüften Drachenkills');
await as(A, `insert into public.profiles (user_id, name, level, dragon_kills, gender) values ('${A}', 'Angreifer', 15, 99, 'm') on conflict (user_id) do update set level = excluded.level, dragon_kills = excluded.dragon_kills`);
r = await db.query(`select dragon_kills, level from public.profiles where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 2 && r.rows[0].level !== 15, 'Ruhmeshalle lässt sich nicht direkt fälschen');
await db.exec(`update public.fighters set level = 1, level_day = null, level_gain = 0 where user_id = '${A}'`);
await as(A, `update public.fighters set level = 15 where user_id = '${A}'`);
r = await db.query(`select level from public.fighters where user_id = '${A}'`);
ok(r.rows[0].level === 5, 'Stufen: höchstens 4 Aufstiege am Tag (1 → 5)');
await as(A, `update public.fighters set level = 6 where user_id = '${A}'`);
r = await db.query(`select level from public.fighters where user_id = '${A}'`);
ok(r.rows[0].level === 5, 'fünfter Aufstieg am selben Tag zählt nicht');
await db.exec(`update public.fighters set dragon_kills = 7, last_dk_at = now() - interval '10 days' where user_id = '${A}'`);
await as(A, `insert into public.fighters (user_id, name, level, dragon_kills) values ('${A}', 'Angreifer', 5, 7) on conflict (user_id) do update set dragon_kills = excluded.dragon_kills, level = excluded.level`);
r = await db.query(`select dragon_kills from public.fighters where user_id = '${A}'`);
ok(r.rows[0].dragon_kills === 7, 'Speichern über "anlegen oder ändern" lässt echte Drachenkills stehen');
await as(A, `update public.fighters set gold = 99999999, exp = 99999999, weapon_tier = 15, bonus_atk = 50, bonus_def = 50, base_max_hp = 9999 where user_id = '${A}'`);
r = await db.query(`select gold, exp, weapon_tier, bonus_atk, bonus_def, base_max_hp, public.f_exp_needed(5, 7) need from public.fighters where user_id = '${A}'`);
const g = r.rows[0];
ok(g.gold === 30000 && g.exp === 3 * g.need + 1000 && g.weapon_tier === 10 && g.bonus_atk === 7 && g.bonus_def === 0 && g.base_max_hp === 285, `Gold, Erfahrung, Waffe, Drachenpunkte gekappt (${g.gold}, ${g.exp}, ${g.weapon_tier}, ${g.bonus_atk}/${g.bonus_def}, ${g.base_max_hp})`);
await as(A, `update public.fighters set days_played = 900 where user_id = '${A}'`);
r = await db.query(`select days_played from public.fighters where user_id = '${A}'`);
ok(r.rows[0].days_played <= 12, 'Spieltage können nicht springen: ' + r.rows[0].days_played);
r = await db.query(`select count(*)::int n from public.cheat_log where user_id = '${A}'`);
ok(r.rows[0].n >= 6, `Auffälliges wird festgehalten (${r.rows[0].n} Einträge)`);
let logRead = false; try { await as(A, `select * from public.cheat_log`); } catch { logRead = true; }
ok(logRead, 'Spieler sehen das Protokoll nicht');
let flagIt = false; try { await as(A, `select public.bw_flag('${B}', 'x', 1, 1)`); } catch { flagIt = true; }
ok(flagIt, 'Spieler können niemanden anschwärzen');
const tsExp = await import('../src/game/balance.ts');
r = await db.query(`select public.f_exp_needed(1, 0) a, public.f_exp_needed(9, 0) b, public.f_exp_needed(14, 6) c`);
ok(r.rows[0].a === tsExp.expNeeded(1) && r.rows[0].b === tsExp.expNeeded(9) && r.rows[0].c === tsExp.expNeeded(14, 6), 'Erfahrungstabelle in Datenbank und Spiel gleich');
const asAnon = async (sql) => { await db.exec('reset role; set role anon'); try { return await db.query(sql); } finally { await db.exec('reset role'); } };
r = await asAnon(`select * from public.last_dragon_slayer()`);
ok(r.rows?.[0]?.name === 'Angreifer', 'Denkmal: letzter Drachentöter auch ohne Anmeldung');

// ---------- Teil 4: Melden ----------
await db.exec(`update public.commentary set created_at = now() - interval '1 minute'`);
await as(A, `insert into public.commentary (section, body) values ('dorfplatz', 'Ihr seid alle doof')`);
const cid = (await db.query(`select id from public.commentary where body = 'Ihr seid alle doof'`)).rows[0].id;
r = await as(B, `select public.report('chat', ${cid}, null) m`);
ok(/Danke/.test(r.rows[0].m), 'Melden: ' + r.rows[0].m);
r = await as(B, `select public.report('chat', ${cid}, null) m`);
ok(/schon gemeldet/.test(r.rows[0].m), 'doppelt melden zählt nicht');
let self = false; try { await as(A, `select public.report('chat', ${cid}, null)`); } catch (e) { self = /selbst/.test(e.message); }
ok(self, 'sich selbst kann man nicht melden');
await as(C, `select public.report('chat', ${cid}, null)`);
r = await as(B, `select count(*)::int n from public.commentary where id = ${cid}`);
ok(r.rows[0].n === 1, 'nach 2 Meldungen noch sichtbar');
await as(N, `select public.report('chat', ${cid}, null)`);
r = await as(B, `select count(*)::int n from public.commentary where id = ${cid}`);
ok(r.rows[0].n === 0, 'nach 3 Meldungen sofort ausgeblendet');
r = await db.query(`select content from public.reports where kind = 'chat' limit 1`);
ok(/Angreifer: Ihr seid alle doof/.test(r.rows[0].content), 'Meldung hält fest, was dastand');
let readRep = false; try { await as(B, `select * from public.reports`); } catch { readRep = true; }
ok(readRep, 'Meldungen sind für Spieler nicht lesbar');
const mid = (await db.query(`select id from public.mail where from_user = '${C}' limit 1`)).rows[0].id;
let foreignMail = false; try { await as(A, `select public.report('brief', ${mid}, null)`); } catch (e) { foreignMail = /nicht mehr/.test(e.message); }
ok(foreignMail, 'fremde Briefe kann man nicht melden');
r = await as(B, `select public.report('brief', ${mid}, null) m`);
ok(/Danke/.test(r.rows[0].m), 'eigenen Brief melden');
await as(B, `select public.report('steckbrief', 0, '${A}')`);

// ---------- Teil 4: Blockieren ----------
await as(B, `insert into public.blocks (blocked) values ('${A}')`);
await db.exec(`update public.mail set created_at = now() - interval '1 minute'`);
await as(A, `insert into public.mail (to_user, subject, body) values ('${B}', 'Na?', 'Bist du noch sauer?')`);
r = await db.query(`select count(*)::int n from public.mail where subject = 'Na?'`);
ok(r.rows[0].n === 0, 'Briefe von Blockierten kommen nicht an (ohne Fehlermeldung)');
r = await as(B, `select * from public.my_blocks()`);
ok(r.rows.length === 1 && r.rows[0].name === 'Angreifer', 'Liste der Blockierten mit Namen');
r = await as(A, `select count(*)::int n from public.blocks`);
ok(r.rows[0].n === 0, 'man sieht nicht, wer einen blockiert hat');
await as(B, `delete from public.blocks where blocked = '${A}'`);
r = await as(B, `select * from public.my_blocks()`);
ok(r.rows.length === 0, 'Blockierung aufheben');

// ---------- Teil 4: die Wache ----------
let notAdmin = false; try { await as(B, `select * from public.mod_reports()`); } catch (e) { notAdmin = /Wache/.test(e.message); }
ok(notAdmin, 'Meldungen nur für die Wache');
await db.exec(`insert into public.admins values ('${C}')`);
r = await as(C, `select public.is_admin() a`);
ok(r.rows[0].a === true, 'Wache erkannt');
r = await as(C, `select * from public.mod_reports()`);
const chatRep = r.rows.find((x) => x.kind === 'chat');
ok(r.rows.length === 3 && chatRep.reports === 3 && chatRep.hidden === true && chatRep.target_name === 'Angreifer', `Wache sieht ${r.rows.length} offene Meldungen, zusammengefasst`);
await as(C, `select public.mod_decide('chat', ${cid}, '${A}', 'ok')`);
r = await as(B, `select count(*)::int n from public.commentary where id = ${cid}`);
ok(r.rows[0].n === 1, 'Fehlalarm: Beitrag wieder sichtbar');
await as(C, `select public.mod_decide('steckbrief', 0, '${A}', 'ban')`);
r = await db.query(`select banned, bio_hidden from public.fighters where user_id = '${A}'`);
ok(r.rows[0].banned && r.rows[0].bio_hidden, 'Sperren blendet aus und sperrt');
let bannedTalk = false; await db.exec(`update public.commentary set created_at = now() - interval '1 minute'`);
try { await as(A, `insert into public.commentary (section, body) values ('dorfplatz', 'Hallo?')`); } catch (e) { bannedTalk = /gesperrt/.test(e.message); }
ok(bannedTalk, 'Gesperrte können nicht mehr reden');
r = await as(B, `select name from public.warriors()`);
ok(!r.rows.some((x) => x.name === 'Angreifer'), 'Gesperrte fehlen in der Kriegerliste');
r = await asAnon(`select count(*)::int n from public.profiles where user_id = '${A}'`);
ok(r.rows[0].n === 0, 'und in der Ruhmeshalle');
r = await as(C, `select * from public.mod_banned()`);
ok(r.rows.length === 1, 'Liste der Gesperrten');
r = await as(C, `select * from public.mod_cheats()`);
ok(r.rows.length >= 6 && r.rows[0].name, 'Wache sieht Auffälliges aus dem Schummelschutz');
await as(C, `select public.mod_unban('${A}')`);
r = await db.query(`select banned from public.fighters where user_id = '${A}'`);
ok(!r.rows[0].banned, 'Sperre aufheben');
await as(B, `select public.report('name', 0, '${A}')`); await as(C, `select public.report('name', 0, '${A}')`); await as(N, `select public.report('name', 0, '${A}')`);
await as(A, `update public.fighters set name = 'Angreifer' where user_id = '${A}'`);
r = await db.query(`select name from public.fighters where user_id = '${A}'`);
ok(r.rows[0].name === 'Namenloser Held', 'gemeldeter Name wird ersetzt und bleibt es');
await as(C, `select public.mod_decide('name', 0, '${A}', 'ok')`);
await as(A, `update public.fighters set name = 'Angreifer' where user_id = '${A}'`);
r = await db.query(`select name from public.fighters where user_id = '${A}'`);
ok(r.rows[0].name === 'Angreifer', 'nach Fehlalarm gilt der eigene Name wieder');

// ---------- Neue Gesprächsorte ----------
await db.exec(`update public.commentary set created_at = now() - interval '1 minute'; update public.fighters set dragon_kills = 0 where user_id = '${B}'`);
await as(A, `insert into public.commentary (section, body) values ('garten', 'Schöne Rosen hier.')`);
r = await db.query(`select count(*)::int n from public.commentary where section = 'garten'`);
ok(r.rows[0].n === 1, 'Gespräch im Rosengarten');
let rock = false; try { await as(B, `insert into public.commentary (section, body) values ('felsen', 'Darf ich auch?')`); } catch (e) { rock = /Drachentöter/.test(e.message); }
ok(rock, 'am Wyrmstein reden nur Drachentöter');
await db.exec(`update public.commentary set created_at = now() - interval '1 minute'`);
await as(A, `insert into public.commentary (section, body) values ('felsen', 'Sieben Drachen, und keiner war leicht.')`);
r = await db.query(`select count(*)::int n from public.commentary where section = 'felsen'`);
ok(r.rows[0].n === 1, 'Drachentöter reden am Wyrmstein');

// ---------- Teil 4: Konto löschen ----------
await db.exec(`update public.mail set created_at = now() - interval '1 minute'`);
await as(N, `insert into public.mail (to_user, subject, body) values ('${B}', 'Tschüss', 'Ich höre auf.')`);
await as(N, `insert into public.news (body) values ('Neuling hat ein Pony gekauft.')`);
r = await as(N, `select public.delete_account() m`);
const gone = (await db.query(`select (select count(*) from auth.users where id = '${N}')::int u, (select count(*) from public.fighters where user_id = '${N}')::int f,
  (select count(*) from public.profiles where user_id = '${N}')::int p, (select count(*) from public.news where body like 'Neuling%')::int n`)).rows[0];
ok(gone.u + gone.f + gone.p + gone.n === 0, 'Konto löschen: Konto, Kampfwerte, Ruhmeshalle und eigene Neuigkeiten weg');
r = await db.query(`select from_user, from_name from public.mail where subject = 'Tschüss'`);
ok(r.rows[0].from_user === null && r.rows[0].from_name === 'Ein verschwundener Held', 'geschickte Briefe bleiben beim Empfänger, ohne Namen');
let anonDel = false; try { await db.exec(`reset role; set role anon;`); await db.query(`select public.delete_account()`); } catch { anonDel = true; } finally { await db.exec('reset role'); }
ok(anonDel, 'ohne Anmeldung kann niemand löschen');

// ---------- Teil 5: Kopfgeld ----------
await db.exec(`update public.fighters set level = 6, gold = 5000, banned = false, bounties_today = 0, pvp_wins = 0, alive = true where user_id in ('${A}','${B}','${C}');`);
let bad5 = ''; try { await as(A, `select public.set_bounty('${B}', 100)`); } catch (e) { bad5 = e.message; }
ok(/zwischen 300 und 1200/.test(bad5), 'Kopfgeld: Betrag muss 50 bis 200 je Stufe sein: ' + bad5);
r = await as(A, `select public.set_bounty('${B}', 500) j`);
ok(r.rows[0].j.paid === 550 && r.rows[0].j.total === 500, 'Kopfgeld gesetzt, Dag behält 10 %');
r = await db.query(`select gold from public.fighters where user_id = '${A}'`);
ok(r.rows[0].gold === 4450, 'Gold für Kopfgeld abgezogen');
let selfB = false; try { await as(A, `select public.set_bounty('${A}', 400)`); } catch (e) { selfB = /selbst/.test(e.message); }
ok(selfB, 'kein Kopfgeld auf sich selbst');
await as(C, `select public.set_bounty('${B}', 600)`);
r = await as(C, `select * from public.bounty_list()`);
ok(r.rows[0].name === 'Opfer' && Number(r.rows[0].total) === 1100 && r.rows[0].setters === 2, 'Liste der Kopfgelder');
let hook = false; try { await as(A, `select public.bw_after_pvp('${A}', '${B}')`); } catch { hook = true; }
ok(hook, 'Spieler können sich Kopfgeld nicht selbst auszahlen');
r = await db.query(`select public.bw_after_pvp('${A}', '${B}') as g`);
ok(r.rows[0].g === 600, 'Sieger bekommt die Kopfgelder der anderen (nicht sein eigenes)');
r = await db.query(`select gold, pvp_wins from public.fighters where user_id = '${A}'`);
ok(r.rows[0].gold === 5050 && r.rows[0].pvp_wins === 1, 'Gold gutgeschrieben, Sieg gezählt (' + JSON.stringify(r.rows[0]) + ')');
r = await as(C, `select * from public.bounty_list()`);
ok(Number(r.rows[0].total) === 500, 'eigenes Kopfgeld bleibt offen');
r = await db.query(`select body from public.news where body like '%Kopfgeld von 600%'`);
ok(r.rows.length === 1, 'Neuigkeit über das kassierte Kopfgeld');

// ---------- Teil 5: Überweisen ----------
await db.exec(`update public.fighters set sent_today = 0, sent_day = null; delete from public.transfers; update public.fighters set level = 2 where user_id = '${B}'`);
let tooMuch = ''; try { await as(A, `select public.transfer_gold('${B}', 51)`); } catch (e) { tooMuch = e.message; }
ok(/höchstens 50 Gold/.test(tooMuch), 'Überweisung höchstens 25 je Stufe des Empfängers');
r = await as(A, `select public.transfer_gold('${B}', 50) j`);
ok(r.rows[0].j.amount === 50 && r.rows[0].j.left_today === 100, 'Überweisung klappt, Tagesrest stimmt');
r = await as(B, `select kind, gold, other_name from public.pvp_events where kind = 'transfer'`);
ok(r.rows.length === 1 && r.rows[0].gold === 50 && r.rows[0].other_name === 'Angreifer', 'Empfänger bekommt die Nachricht mit dem Gold');
await as(A, `select public.transfer_gold('${B}', 50)`); await as(A, `select public.transfer_gold('${B}', 50)`);
let daily = ''; try { await as(A, `select public.transfer_gold('${C}', 10)`); } catch (e) { daily = e.message; }
ok(/nur noch 0 Gold/.test(daily), 'Tagesgrenze für Überweisungen');
await db.exec(`update public.fighters set sent_today = 0 where user_id = '${A}'`);
let three = ''; try { await as(C, `select public.transfer_gold('${B}', 10)`); } catch (e) { three = e.message; }
ok(/drei Überweisungen/.test(three), 'höchstens drei Überweisungen pro Empfänger und Tag');
await db.exec(`update public.fighters set level = 2, dragon_kills = 0 where user_id = '${C}'`);
let low = ''; try { await as(C, `select public.transfer_gold('${A}', 10)`); } catch (e) { low = e.message; }
ok(/ab Stufe 3/.test(low), 'Überweisen erst ab Stufe 3');

// ---------- Teil 5: Fünf Sechser ----------
await db.exec(`update public.jackpot set pot = 500; delete from public.fivesix_plays; update public.fighters set gold = 5000, level = 6 where user_id = '${A}'`);
r = await as(A, `select public.fivesix_info() j`);
ok(r.rows[0].j.pot === 500 && r.rows[0].j.plays_left === 10 && r.rows[0].j.cost === 30, 'Jackpot-Info: Topf, Würfe, Kosten');
let wins = 0, potGrew = true, lastPot = 500;
for (let i = 0; i < 10; i++) {
  const j = (await as(A, `select public.fivesix_roll() j`)).rows[0].j;
  wins += j.win;
  if (j.dice.length !== 5) potGrew = false;
  if (!j.win && j.pot !== lastPot + 30) potGrew = false;
  lastPot = j.pot;
}
ok(potGrew, 'jeder Wurf ohne Gewinn füllt den Topf um den Einsatz');
let eleven = false; try { await as(A, `select public.fivesix_roll()`); } catch (e) { eleven = /genug gewürfelt/.test(e.message); }
ok(eleven, 'höchstens 10 Würfe am Tag');
r = await db.query(`select gold from public.fighters where user_id = '${A}'`);
ok(r.rows[0].gold === 5000 - 300 + wins, 'Gold auf dem Server stimmt mit Einsätzen und Gewinnen');
{
  let fives = 0; await db.exec(`update public.jackpot set pot = 1000`);
  for (let i = 0; i < 4000 && !fives; i++) {
    await db.exec(`delete from public.fivesix_plays; update public.fighters set gold = 5000 where user_id = '${A}'`);
    const j = (await as(A, `select public.fivesix_roll() j`)).rows[0].j;
    if (j.sixes === 5) fives = j.win;
  }
  if (fives) { r = await db.query(`select pot, last5, last5_pot from public.jackpot`); ok(r.rows[0].pot === 500 && r.rows[0].last5 === 'Angreifer', `Jackpot geknackt (${fives} Gold), Topf wieder bei 500`); }
  else console.log('   (in 4000 Würfen keine fünf Sechser, Wahrscheinlichkeit 1:7776)');
}

// ---------- Teil 5: Aushang ----------
let notAdm = false; try { await as(B, `select public.post_aushang('Hallo', 'Test')`); } catch (e) { notAdm = /Wache/.test(e.message); }
ok(notAdm, 'Aushang nur für die Wache');
await as(C, `select public.post_aushang('Neue Version 0.40', 'Das Kontor kann jetzt überweisen.')`);
r = await asAnon(`select title, author from public.aushang order by id desc limit 1`);
ok(r.rows[0]?.title === 'Neue Version 0.40' && r.rows[0].author === 'Wach', 'Aushang für alle lesbar, mit Namen der Wache');

// ---------- Teil 5: Ranglisten ----------
await as(A, `update public.fighters set charm = 9999, wealth = 999999999, fastest_dk = 2, feste_treasures = 5 where user_id = '${A}'`);
r = await db.query(`select charm, wealth, fastest_dk, feste_treasures, dragon_kills, level, days_played from public.fighters where user_id = '${A}'`);
const fa = r.rows[0];
ok(fa.charm === 300 && Number(fa.wealth) === 50000 * fa.level * (1 + fa.dragon_kills) && (fa.dragon_kills === 0 ? fa.fastest_dk === 0 : fa.fastest_dk === 4) && fa.feste_treasures <= fa.days_played,
  `Ranglisten-Werte begrenzt (Charme ${fa.charm}, schnellster Drache ${fa.fastest_dk})`);
await db.exec(`update public.fighters set fastest_dk = 0, pvp_wins = 3 where user_id = '${C}'; update public.fighters set fastest_dk = 12, dragon_kills = greatest(dragon_kills, 1) where user_id = '${B}'`);
r = await asAnon(`select name, value from public.hall_of_fame('furcht', 5)`);
ok(r.rows[0].name === 'Wach' && Number(r.rows[0].value) === 3, 'Rangliste der Gefürchtetsten (auch ohne Anmeldung)');
r = await asAnon(`select name, value from public.hall_of_fame('schnell', 5)`);
ok(r.rows.every((x) => Number(x.value) > 0) && r.rows.some((x) => x.name === 'Opfer'), 'Schnellste Drachentöter ohne die, die noch keinen haben');
r = await asAnon(`select name from public.hall_of_fame('charme', 5)`);
ok(r.rows[0].name === 'Angreifer', 'Charmanteste');
await db.exec(`update public.fighters set banned = true where user_id = '${A}'`);
r = await asAnon(`select name from public.hall_of_fame('charme', 5)`);
ok(!r.rows.some((x) => x.name === 'Angreifer'), 'Gesperrte erscheinen in keiner Rangliste');
await db.exec(`update public.fighters set banned = false where user_id = '${A}'`);

// Aktualisierung einer Datenbank mit dem alten Teil 2 (ohne Rassen)
{
  const old = new PGlite();
  await old.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  await old.exec(readFileSync(new URL('../server/supabase.sql', import.meta.url), 'utf8'));
  const { execSync } = await import('node:child_process');
  let oldSql = '';
  try { oldSql = execSync('git show d5ae20c:server/supabase-2-dorf.sql', { cwd: new URL('..', import.meta.url).pathname }).toString(); } catch { /* ohne git */ }
  if (oldSql) {
    await old.exec(oldSql);
    await old.exec(`insert into auth.users values ('${A}','a@x'); insert into public.fighters (user_id, name, specialty) values ('${A}', 'Alt', 'klinge')`);
    await old.exec(readFileSync(new URL('../server/supabase-2-dorf.sql', import.meta.url), 'utf8'));
    const x = await old.query(`select race, specialty from public.fighters`);
    ok(x.rows[0].race === 'mensch' && x.rows[0].specialty === 'klinge', 'alte Datenbank lässt sich aktualisieren, bestehende Kämpfer bleiben');
  }
}

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Prüfungen bestanden');
process.exit(fails ? 1 : 0);
