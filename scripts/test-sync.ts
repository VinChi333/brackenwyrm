// Tests für den Abgleich mit dem Server. Aufruf: npm test
import assert from 'node:assert/strict';
import { Cloud } from '../src/game/cloud';
import { newGame } from '../src/game/engine';
import { decideSync } from '../src/game/sync';
import { validate } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n++; console.log('ok  ', name); });

await t('alter Spielstand ohne Zeitstempel zählt als vorhanden', () => {
  const s = newGame('Alt', 'klinge') as unknown as Record<string, unknown>;
  delete s.savedAt;
  const v = validate(JSON.parse(JSON.stringify(s)))!;
  assert.equal(decideSync({ local: v.savedAt ?? null, remote: null, lastSynced: 0 }), 'push');
});
await t('nichts da: nichts tun', () => assert.equal(decideSync({ local: null, remote: null, lastSynced: 0 }), 'none'));
await t('nur lokal: hochladen', () => assert.equal(decideSync({ local: 5, remote: null, lastSynced: 0 }), 'push'));
await t('nur Server: herunterladen', () => assert.equal(decideSync({ local: null, remote: 5, lastSynced: 0 }), 'pull'));
await t('gleich: nichts tun', () => assert.equal(decideSync({ local: 7, remote: 7, lastSynced: 7 }), 'none'));
await t('nur hier weitergespielt: hochladen', () => assert.equal(decideSync({ local: 9, remote: 7, lastSynced: 7 }), 'push'));
await t('nur anderswo weitergespielt: herunterladen', () => assert.equal(decideSync({ local: 7, remote: 9, lastSynced: 7 }), 'pull'));
await t('beide weitergespielt: fragen', () => assert.equal(decideSync({ local: 9, remote: 8, lastSynced: 7 }), 'conflict'));
await t('erstes Anmelden mit zwei Ständen: fragen', () => assert.equal(decideSync({ local: 9, remote: 8, lastSynced: 0 }), 'conflict'));

// Netzwerk mit einem nachgebauten Server prüfen
const calls: { url: string; init: RequestInit }[] = [];
const db: Record<string, unknown> = {};
const fake = async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
  const u = String(url);
  calls.push({ url: u, init });
  const body = init.body ? JSON.parse(String(init.body)) : null;
  const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
  if (u.endsWith('/auth/v1/signup')) return body.email === 'neu@b.de'
    ? json({ access_token: 'A', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: body.email } })
    : json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422);
  if (u.includes('/auth/v1/token?grant_type=password')) return body.password === 'geheim1'
    ? json({ access_token: 'A', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: body.email } })
    : json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
  if (u.endsWith('/auth/v1/otp')) return new Response('{}', { status: 200 });
  if (u.endsWith('/auth/v1/verify')) return body.token === '123456'
    ? json({ access_token: 'A', refresh_token: 'R', expires_in: 3600, user: { id: 'u1', email: body.email } })
    : json({ error: 'invalid' }, 400);
  if (u.includes('/rest/v1/saves?')) return json(db.save ? [db.save] : []);
  if (u.endsWith('/rest/v1/saves')) { db.save = { data: body.data, saved_at: body.saved_at }; return new Response('', { status: 201 }); }
  if (u.endsWith('/rest/v1/profiles')) { db.profile = body; return new Response('', { status: 201 }); }
  if (u.includes('/rest/v1/profiles?')) return json([{ name: 'Hilda', level: 3, dragon_kills: 2 }]);
  return json({}, 404);
};
const mem = new Map<string, string>();
const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
const cloud = new Cloud('https://x.supabase.co', 'anon', fake as typeof fetch, store);

await t('vorhandenes Konto: verständlicher Hinweis', async () => {
  await assert.rejects(cloud.signUp('alt@b.de', 'geheim1'), (e: { code: string }) => e.code === 'exists');
});
await t('falsches Passwort: verständlicher Hinweis', async () => {
  await assert.rejects(cloud.signIn('a@b.de', 'falsch'), (e: { code: string }) => e.code === 'bad_login');
  assert.equal(cloud.signedIn, false);
});
await t('neues Konto meldet direkt an', async () => {
  await cloud.signUp('neu@b.de', 'geheim1');
  assert.equal(cloud.signedIn, true);
  cloud.signOut();
});
await t('Anmelden mit Passwort', async () => {
  await cloud.signIn('a@b.de', 'geheim1');
  assert.equal(cloud.email, 'a@b.de');
  cloud.signOut();
});
await t('falscher Code wird abgelehnt', async () => {
  await assert.rejects(cloud.verifyCode('a@b.de', '000000'), (e: { code: string }) => e.code === 'bad_code');
  assert.equal(cloud.signedIn, false);
});
await t('richtiger Code meldet an und merkt sich die Sitzung', async () => {
  await cloud.verifyCode('a@b.de', ' 123456 ');
  assert.equal(cloud.signedIn, true);
  assert.ok(mem.get('brackenwyrm.session'));
});
await t('hochladen und wieder laden ergibt denselben Spielstand', async () => {
  const s = newGame('Hilda', 'wurzel', 'f');
  s.savedAt = 1234;
  s.player.level = 3;
  await cloud.push(s);
  const last = calls.filter((c) => c.url.endsWith('/rest/v1/saves')).pop()!;
  assert.equal((last.init.headers as Record<string, string>).Authorization, 'Bearer A');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, undefined);
  const back = await cloud.pull();
  assert.equal(back?.savedAt, 1234);
  assert.equal(back?.state.player.name, 'Hilda');
  assert.equal(back?.state.player.level, 3);
  assert.deepEqual(db.profile, { user_id: 'u1', name: 'Hilda', level: 3, dragon_kills: 0 });
});
await t('Ruhmeshalle wird gelesen', async () => {
  const rows = await cloud.hallOfFame();
  assert.deepEqual(rows, [{ name: 'Hilda', level: 3, dragonKills: 2 }]);
});
await t('ohne Einrichtung ist das Konto abgeschaltet', () => {
  assert.equal(new Cloud('', '', fake as typeof fetch, store).enabled, false);
});
console.log(`\n${n} Tests bestanden`);
