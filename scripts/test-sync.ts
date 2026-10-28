// Tests für den Abgleich mit dem Server. Aufruf: npm test
import assert from 'node:assert/strict';
import { Cloud } from '../src/game/cloud';
import { newGame } from '../src/game/engine';
import { decideSync } from '../src/game/sync';
import { validate } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n++; console.log('ok  ', name); });

await t('alter Spielstand ohne Zeitstempel zählt als vorhanden', () => {
  const s = newGame('Alt', 'dunkel') as unknown as Record<string, unknown>;
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
  if (u.includes('/rest/v1/profiles?')) return json([{ name: 'Hilda', level: 3, dragon_kills: 2, gender: 'f' }]);
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
  const s = newGame('Hilda', 'mystik', 'f');
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
  assert.deepEqual(db.profile, { user_id: 'u1', name: 'Hilda', level: 3, dragon_kills: 0, gender: 'f' });
});
await t('Ruhmeshalle wird gelesen', async () => {
  const rows = await cloud.hallOfFame();
  assert.deepEqual(rows, [{ name: 'Hilda', level: 3, dragonKills: 2, gender: 'f' }]);
});
await t('ohne Einrichtung ist das Konto abgeschaltet', () => {
  assert.equal(new Cloud('', '', fake as typeof fetch, store).enabled, false);
});

// Anmeldung läuft nach einer Stunde ab: still erneuern, nie einfach abmelden
function expiryServer(opts: { refreshOk?: boolean; forbid?: boolean } = {}) {
  let refreshes = 0;
  const http = async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const u = String(url); const auth = (init.headers as Record<string, string>)?.Authorization ?? '';
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });
    if (u.includes('grant_type=refresh_token')) {
      refreshes++;
      return opts.refreshOk === false ? json({ error_code: 'refresh_token_not_found' }, 400)
        : json({ access_token: 'NEU', refresh_token: 'R2', expires_in: 3600, user: { id: 'u1', email: 'a@b.de' } });
    }
    if (auth !== 'Bearer NEU') return json({ message: 'JWT expired' }, 401);
    if (opts.forbid) return json({ code: '42501', message: 'permission denied' }, 403);
    if (u.endsWith('/rpc/is_admin')) return json(true);
    return json([]);
  };
  const m = new Map<string, string>();
  const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  return { http, st, m, refreshes: () => refreshes };
}
const oldSession = (expiresAt: number) => JSON.stringify({ accessToken: 'ALT', refreshToken: 'R', expiresAt, userId: 'u1', email: 'a@b.de' });

await t('abgelaufene Anmeldung wird still erneuert (Wache bleibt sichtbar)', async () => {
  const x = expiryServer(); x.m.set('brackenwyrm.session', oldSession(Date.now() - 1000));
  const c = new Cloud('https://x', 'k', x.http as typeof fetch, x.st);
  assert.equal(await c.isAdmin(), true);
  assert.equal(c.signedIn, true);
  assert.equal(JSON.parse(x.m.get('brackenwyrm.session')!).accessToken, 'NEU');
});
await t('Server lehnt den Schlüssel ab, obwohl er noch gültig scheint: erneuern und nochmal', async () => {
  const x = expiryServer(); x.m.set('brackenwyrm.session', oldSession(Date.now() + 3_000_000));
  const c = new Cloud('https://x', 'k', x.http as typeof fetch, x.st);
  assert.equal(await c.isAdmin(), true);
  assert.equal(c.signedIn, true);
});
await t('mehrere Anfragen gleichzeitig erneuern nur einmal', async () => {
  const x = expiryServer(); x.m.set('brackenwyrm.session', oldSession(Date.now() - 1000));
  const c = new Cloud('https://x', 'k', x.http as typeof fetch, x.st);
  await Promise.all([c.isAdmin(), c.pull(), c.isAdmin()]);
  assert.equal(x.refreshes(), 1);
});
await t('Erneuern abgelehnt: abmelden und Bescheid geben', async () => {
  const x = expiryServer({ refreshOk: false }); x.m.set('brackenwyrm.session', oldSession(Date.now() - 1000));
  const c = new Cloud('https://x', 'k', x.http as typeof fetch, x.st);
  let told = 0; c.onExpired = () => { told++; };
  await assert.rejects(c.pull(), (e: { code: string }) => e.code === 'auth');
  assert.equal(c.signedIn, false);
  assert.equal(told, 1);
});
await t('fehlende Berechtigung (403) meldet nicht ab', async () => {
  const x = expiryServer({ forbid: true }); x.m.set('brackenwyrm.session', oldSession(Date.now() - 1000));
  const c = new Cloud('https://x', 'k', x.http as typeof fetch, x.st);
  await assert.rejects(c.pull(), (e: { code: string }) => e.code === 'server');
  assert.equal(c.signedIn, true);
});
console.log(`\n${n} Tests bestanden`);
