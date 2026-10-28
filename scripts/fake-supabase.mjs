// Kleiner Nachbau von Supabase (Anmeldung + REST + RPC) über ein echtes Postgres (PGlite) mit den Regeln aus server/*.sql.
// Nur für Tests: node scripts/fake-supabase.mjs [port]. Jede Anfrage läuft als Rolle "authenticated" bzw. "anon",
// damit Zugriffsregeln (RLS) und Spaltenrechte genau wie bei Supabase greifen.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.argv[2] ?? 54321);
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text unique, password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const f of ['supabase.sql', 'supabase-2-dorf.sql', 'supabase-3-briefe.sql', 'supabase-4-schutz.sql', 'supabase-5-dorfleben.sql', 'supabase-6-spieltage.sql', 'supabase-7-gilden.sql', 'supabase-8-vollversion.sql']) await db.exec(readFileSync(new URL(`../server/${f}`, import.meta.url), 'utf8'));

let queue = Promise.resolve();
/** Führt SQL als angemeldeter Spieler (oder anon) aus. Nacheinander, weil PGlite nur eine Verbindung hat. */
function as(uid, sql, params = []) {
  const run = async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
    try { return await db.query(sql, params); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}
const admin = (sql, params = []) => { const p = queue.then(() => db.query(sql, params)); queue = p.catch(() => {}); return p; };

const COLS = {
  saves: ['user_id', 'data', 'saved_at'],
  profiles: ['user_id', 'name', 'level', 'dragon_kills', 'gender'],
  fighters: ['user_id', 'name', 'specialty', 'race', 'gender', 'level', 'exp', 'gold', 'hp', 'base_max_hp', 'bonus_atk', 'bonus_def', 'weapon_tier', 'armor_tier', 'dragon_kills', 'days_played', 'alive', 'in_inn', 'bio', 'mount', 'married_to', 'heirlooms', 'charm', 'wealth', 'fastest_dk', 'feste_treasures'],
  news: ['body'],
  commentary: ['section', 'body'],
  mail: ['to_user', 'subject', 'body'],
  blocks: ['blocked'],
};

function filters(params) {
  const where = []; const vals = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    if (op === 'eq') { vals.push(val === 'false' ? false : val === 'true' ? true : val); where.push(`${k} = $${vals.length}`); }
    else if (op === 'like' || op === 'ilike') { vals.push(val.replace(/\*/g, '%')); where.push(`${k} ${op} $${vals.length}`); }
    else if (op === 'in') { const items = val.replace(/[()]/g, '').split(',').map(Number); vals.push(items); where.push(`${k} = any($${vals.length})`); }
  }
  return { where: where.length ? 'where ' + where.join(' and ') : '', vals };
}

const otpSent = new Map();
const server = createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; for await (const c of req) body += c;
  const data = body ? JSON.parse(body) : null;
  const url = new URL(req.url, 'http://x');
  const uid = (req.headers.authorization ?? '').replace('Bearer ', '') || null;
  const send = (status, obj) => { res.writeHead(status, { ...cors, 'content-type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
  try {
    if (url.pathname === '/auth/v1/signup') {
      const exists = (await admin('select id from auth.users where email = $1', [data.email])).rows[0];
      if (exists) return send(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const id = randomUUID();
      await admin('insert into auth.users values ($1, $2, $3)', [id, data.email, data.password]);
      return send(200, { access_token: id, refresh_token: id, expires_in: 3600, user: { id, email: data.email } });
    }
    // Abgelaufener Zugangsschlüssel (zum Testen: "EXP:<id>") wird wie bei Supabase mit 401 abgelehnt
    if (uid?.startsWith('EXP:') && url.pathname.startsWith('/rest/')) return send(401, { code: 'PGRST301', message: 'JWT expired' });
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const u = (await admin('select id, email from auth.users where id::text = $1', [String(data.refresh_token)])).rows[0];
      if (!u) return send(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      return send(200, { access_token: u.id, refresh_token: u.id, expires_in: 3600, user: { id: u.id, email: u.email } });
    }
    if (url.pathname === '/auth/v1/token') {
      const u = (await admin('select id from auth.users where email = $1 and password = $2', [data.email, data.password])).rows[0];
      if (!u) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      return send(200, { access_token: u.id, refresh_token: u.id, expires_in: 3600, user: { id: u.id, email: data.email } });
    }
    // Code per E-Mail (Passwort vergessen). Der Code steht in der Ausgabe ("CODE <email> <code>") und ist zum Testen immer 123456.
    if (url.pathname === '/auth/v1/otp') {
      const u = (await admin('select id from auth.users where email = $1', [data.email])).rows[0];
      if (!u && data.create_user === false) return send(422, { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
      const last = otpSent.get(data.email) ?? 0;
      if (Date.now() - last < 3000) return send(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 60 seconds.' });
      otpSent.set(data.email, Date.now());
      console.log(`CODE ${data.email} 123456`);
      return send(200, {});
    }
    if (url.pathname === '/auth/v1/verify') {
      const u = (await admin('select id from auth.users where email = $1', [data.email])).rows[0];
      if (!u || String(data.token) !== '123456') return send(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      return send(200, { access_token: u.id, refresh_token: u.id, expires_in: 3600, user: { id: u.id, email: data.email } });
    }
    if (url.pathname === '/auth/v1/user' && req.method === 'PUT') {
      if (!uid) return send(401, { msg: 'no session' });
      if (!data?.password || data.password.length < 6) return send(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      const same = (await admin('select 1 from auth.users where id = $1 and password = $2', [uid, data.password])).rows[0];
      if (same) return send(422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
      await admin('update auth.users set password = $2 where id = $1', [uid, data.password]);
      const e = (await admin('select email from auth.users where id = $1', [uid])).rows[0];
      return send(200, { id: uid, email: e?.email });
    }
    const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?(\w+)$/);
    if (!m) return send(404, { message: 'not found' });
    const [, rpc, name] = m;
    if (rpc) {
      const args = Object.keys(data ?? {});
      const r = await as(uid, `select to_jsonb(x) as j from public.${name}(${args.map((a, i) => `${a} => $${i + 1}`).join(', ')}) x`, args.map((a) => data[a]));
      const rows = r.rows.map((x) => x.j);
      // Funktionen mit einem einzelnen jsonb-Ergebnis liefern bei PostgREST den Wert selbst, Tabellenfunktionen eine Liste
      const set = (await admin('select bool_or(proretset) as s from pg_proc where proname = $1', [name])).rows[0]?.s;
      return send(200, set ? rows : rows[0] ?? null);
    }
    if (req.method === 'GET') {
      const { where, vals } = filters(url.searchParams);
      const sel = url.searchParams.get('select') ?? '*';
      const order = url.searchParams.get('order'); const limit = url.searchParams.get('limit');
      const r = await as(uid, `select ${sel} from public.${name} ${where} ${order ? 'order by ' + order.replace('.desc', ' desc').replace('.asc', '') : ''} ${limit ? 'limit ' + Number(limit) : ''}`, vals);
      return send(200, r.rows);
    }
    if (req.method === 'POST') {
      const cols = COLS[name].filter((c) => c in data);
      const vals = cols.map((c) => (typeof data[c] === 'object' && data[c] !== null ? JSON.stringify(data[c]) : data[c]));
      const upsert = (req.headers.prefer ?? '').includes('merge-duplicates');
      const ignore = (req.headers.prefer ?? '').includes('ignore-duplicates');
      const sql = `insert into public.${name} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})` +
        (upsert ? ` on conflict (user_id) do update set ${cols.filter((c) => c !== 'user_id').map((c) => `${c} = excluded.${c}`).join(', ')}` : ignore ? ' on conflict do nothing' : '');
      await as(uid, sql, vals);
      return send(201);
    }
    if (req.method === 'PATCH') {
      const { where, vals } = filters(url.searchParams);
      const sets = Object.keys(data).map((c, i) => `${c} = $${vals.length + i + 1}`);
      await as(uid, `update public.${name} set ${sets.join(', ')} ${where}`, [...vals, ...Object.values(data)]);
      return send(204);
    }
    if (req.method === 'DELETE') {
      const { where, vals } = filters(url.searchParams);
      await as(uid, `delete from public.${name} ${where}`, vals);
      return send(204);
    }
    return send(405, { message: 'method' });
  } catch (e) {
    const msg = String(e.message ?? e);
    return send(e.code === 'P0001' ? 400 : msg.includes('permission denied') || msg.includes('row-level security') ? 403 : 400, { code: e.code ?? 'XX', message: msg });
  }
});

// Testhilfe: einen Spieler "einschlafen" lassen (zuletzt gesehen vor einer Stunde)
server.on('request', () => {});
export async function sleep(user) { await admin(`update public.fighters set last_seen = now() - interval '1 hour' where name = $1`, [user]); }
globalThis.__admin = admin;
server.listen(port, () => console.log(`Fake-Supabase läuft auf http://localhost:${port}`));
process.stdin.on('data', async (d) => {
  // Befehle über stdin für Tests: "sleep <Name>" oder "sql <SQL>"
  const line = d.toString().trim();
  if (line.startsWith('sleep ')) { await sleep(line.slice(6)); console.log('OK sleep'); }
  if (line.startsWith('sql ')) { const r = await admin(line.slice(4)); console.log('SQL ' + JSON.stringify(r.rows)); }
});
