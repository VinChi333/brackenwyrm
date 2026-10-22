// Spielerkonto und Online-Spielstand über Supabase (Anmeldung per E-Mail-Code, Datenbank per REST).
// Ohne VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY ist alles abgeschaltet und das Spiel läuft rein lokal.

import { validate } from './storage';
import { LEGACY_REVERSE, normalizeSpecialty } from '../content/specialties';
import { normalizeRace } from '../content/races';
import type { GameState, Gender, RaceId, SpecialtyId } from './types';

const URL_ = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const KEY_ = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const SESSION_KEY = 'brackenwyrm.session';

export interface Session { accessToken: string; refreshToken: string; expiresAt: number; userId: string; email: string }
export interface RemoteSave { state: GameState; savedAt: number }
export interface FameRow { name: string; dragonKills: number; level: number; gender?: Gender; title?: string }
export interface PvpTarget { userId: string; name: string; level: number; specialty: SpecialtyId; race: RaceId; gender: Gender; dragonKills: number; attackable: boolean; note: string }
export interface PvpResult {
  won: boolean;
  rounds: [number, number][];       // [Schaden des Angreifers, Schaden des Opfers] je Runde, 0 = daneben
  hero: { hp: number; max: number };
  foe: { name: string; level: number; specialty: string; race?: string; gender: Gender; hp: number; max: number; weapon_tier: number };
  gold: number; exp_win: number; exp_lose: number; fights_left: number;
}
export interface PvpEvent { id: number; kind: 'slain' | 'defended' | 'haunted'; other_name: string; place: string; gold: number; exp: number; created_at: string }
export interface NewsRow { created_at: string; body: string }
export interface WarriorRow { userId: string; name: string; gender: Gender; level: number; race: RaceId; specialty: SpecialtyId; dragonKills: number; alive: boolean; online: boolean; inInn: boolean; lastSeen: string }
export interface MailRow { id: number; created_at: string; from_user: string | null; from_name: string; subject: string; body: string; seen: boolean }
export interface CommentRow { id: number; created_at: string; name: string; body: string }

export class CloudError extends Error {
  constructor(public code: 'offline' | 'auth' | 'server' | 'bad_code' | 'bad_login' | 'exists' | 'weak' | 'confirm' | 'rule', message: string) { super(message); }
}

type Fetch = typeof fetch;

export class Cloud {
  private session: Session | null;
  constructor(private url = URL_, private key = KEY_, private http: Fetch = (...a) => fetch(...a), private store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage()) {
    this.session = this.readSession();
  }

  get enabled(): boolean { return !!(this.url && this.key); }
  get signedIn(): boolean { return !!this.session; }
  get email(): string { return this.session?.email ?? ''; }
  get userId(): string { return this.session?.userId ?? ''; }

  /** Neues Konto mit E-Mail und Passwort. Braucht in Supabase "Confirm email" = aus. */
  async signUp(email: string, password: string): Promise<void> {
    const r = await this.authCall('/auth/v1/signup', { email, password });
    if (!r?.access_token) throw new CloudError('confirm', 'Konto angelegt, muss aber erst per E-Mail bestätigt werden. In Supabase "Confirm email" ausschalten.');
    this.setSession(r);
  }

  /** Anmelden mit E-Mail und Passwort. */
  async signIn(email: string, password: string): Promise<void> {
    this.setSession(await this.authCall('/auth/v1/token?grant_type=password', { email, password }));
  }

  /** Auth-Anfrage mit verständlichen Fehlermeldungen. */
  private async authCall(path: string, body: unknown): Promise<any> {
    if (!this.enabled) throw new CloudError('server', 'Online-Spielstand ist nicht eingerichtet.');
    let res: Response;
    try {
      res = await this.http(this.url + path, { method: 'POST', headers: { apikey: this.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new CloudError('offline', 'Keine Verbindung zum Server.');
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.ok) return data;
    const code = String(data?.error_code ?? data?.code ?? data?.error ?? '');
    const msg = String(data?.msg ?? data?.message ?? data?.error_description ?? '');
    if (/already|exists|registered/i.test(code + msg)) throw new CloudError('exists', 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.');
    if (/weak|password.*(short|least|characters)/i.test(code + msg)) throw new CloudError('weak', 'Das Passwort ist zu kurz oder zu einfach (mindestens 6 Zeichen).');
    if (/invalid.*(credential|grant)|invalid login/i.test(code + msg)) throw new CloudError('bad_login', 'E-Mail oder Passwort stimmt nicht.');
    if (/not.*confirmed/i.test(code + msg)) throw new CloudError('confirm', 'Die E-Mail-Adresse ist noch nicht bestätigt.');
    throw new CloudError('server', `Anmeldung fehlgeschlagen (${res.status}).`);
  }

  /** Schickt einen Anmeldecode an die E-Mail-Adresse (legt das Konto bei Bedarf an). */
  async requestCode(email: string): Promise<void> {
    await this.call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } }, false);
  }

  /** Prüft den Code aus der E-Mail und meldet an. */
  async verifyCode(email: string, code: string): Promise<void> {
    try {
      const r = await this.call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code.trim() } }, false);
      this.setSession(r);
    } catch (e) {
      if (e instanceof CloudError && e.code === 'auth') throw new CloudError('bad_code', 'Der Code stimmt nicht oder ist abgelaufen.');
      throw e;
    }
  }

  signOut(): void {
    this.session = null;
    this.store?.removeItem(SESSION_KEY);
  }

  async pull(): Promise<RemoteSave | null> {
    const s = await this.ensureSession();
    const rows = await this.call(`/rest/v1/saves?select=data,saved_at&user_id=eq.${s.userId}`, { method: 'GET' });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    const state = validate(row.data);
    return state ? { state, savedAt: Number(row.saved_at) } : null;
  }

  async push(state: GameState): Promise<void> {
    const s = await this.ensureSession();
    const p = state.player;
    await this.call('/rest/v1/saves', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { user_id: s.userId, data: state, saved_at: state.savedAt ?? Date.now() },
    });
    const profile = { user_id: s.userId, name: p.name, level: p.level, dragon_kills: p.dragonKills };
    const sendProfile = (body: object) => this.call('/rest/v1/profiles', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body });
    try {
      await sendProfile({ ...profile, gender: p.gender });
    } catch (e) {
      // Datenbank noch ohne Spalte "gender" (Teil 2 nicht ausgeführt): ohne sie speichern
      if (e instanceof CloudError && /gender|PGRST204|42703/.test(e.message)) await sendProfile(profile);
      else throw e;
    }
    await this.pushFighter(state);
  }

  /** Kampfwerte für Spieler gegen Spieler. Nur wenn Teil 2 der Datenbank eingerichtet ist; sonst still überspringen. */
  async pushFighter(state: GameState): Promise<void> {
    const s = await this.ensureSession();
    const p = state.player;
    const body: Record<string, unknown> = {
      user_id: s.userId, name: p.name, specialty: p.specialty, race: p.race, gender: p.gender, level: p.level, exp: Math.max(0, Math.round(p.exp)),
      gold: Math.max(0, p.gold), hp: Math.max(0, p.hp), base_max_hp: p.baseMaxHp, bonus_atk: p.bonusAtk, bonus_def: p.bonusDef,
      weapon_tier: p.weaponTier, armor_tier: p.armorTier, dragon_kills: p.dragonKills, days_played: state.stats.realDays,
      alive: p.alive, in_inn: p.alive && p.innRoom,
    };
    const send = (b: object) => this.call('/rest/v1/fighters', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: b });
    try {
      await send(body);
    } catch (e) {
      if (e instanceof CloudError && /404|42P01|PGRST205/.test(e.message)) return;  // Tabelle gibt es (noch) nicht
      // Datenbank noch auf altem Stand (ohne Rasse, alte Fähigkeiten): so speichern, wie sie es kennt
      if (e instanceof CloudError && /race|PGRST204|42703|23514|check/i.test(e.message)) {
        const { race: _race, ...old } = body;
        await send({ ...old, specialty: LEGACY_REVERSE[p.specialty] });
        return;
      }
      throw e;
    }
  }

  // ---------- Spieler gegen Spieler ----------

  /** Ungelesene Nachrichten ("Du wurdest im Schlaf angegriffen"). */
  async pvpEvents(): Promise<PvpEvent[]> {
    await this.ensureSession();
    try {
      const rows = await this.call('/rest/v1/pvp_events?select=id,kind,other_name,place,gold,exp,created_at&applied=eq.false&order=id', { method: 'GET' });
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      if (e instanceof CloudError && /404|42P01|PGRST205/.test(e.message)) return [];
      throw e;
    }
  }

  async ackEvents(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.call(`/rest/v1/pvp_events?id=in.(${ids.map(Number).join(',')})`, { method: 'PATCH', prefer: 'return=minimal', body: { applied: true } });
  }

  async pvpTargets(place: 'felder' | 'gasthaus'): Promise<PvpTarget[]> {
    await this.ensureSession();
    const rows = await this.call('/rest/v1/rpc/pvp_targets', { method: 'POST', body: { place } });
    return (Array.isArray(rows) ? rows : []).map((r: { user_id: string; name: string; level: number; specialty: string; race?: string; gender: Gender; dragon_kills: number; attackable: boolean; note: string }) => ({
      userId: r.user_id, name: r.name, level: r.level, specialty: normalizeSpecialty(r.specialty), race: normalizeRace(r.race), gender: r.gender, dragonKills: r.dragon_kills, attackable: r.attackable, note: r.note,
    }));
  }

  async pvpStatus(): Promise<{ fights_left: number; immune: boolean } | null> {
    await this.ensureSession();
    return await this.call('/rest/v1/rpc/pvp_status', { method: 'POST', body: {} });
  }

  async pvpAttack(target: string, place: 'felder' | 'gasthaus'): Promise<PvpResult> {
    await this.ensureSession();
    return await this.call('/rest/v1/rpc/pvp_attack', { method: 'POST', body: { target, place } });
  }

  // ---------- Dorfplatz und Neuigkeiten ----------

  async news(limit = 30): Promise<NewsRow[]> {
    const rows = await this.call(`/rest/v1/news?select=created_at,body&order=created_at.desc&limit=${limit}`, { method: 'GET' }, !!this.session);
    return Array.isArray(rows) ? rows : [];
  }

  async postNews(body: string): Promise<void> {
    await this.ensureSession();
    await this.call('/rest/v1/news', { method: 'POST', prefer: 'return=minimal', body: { body: body.slice(0, 200) } });
  }

  async comments(section = 'dorfplatz', limit = 25): Promise<CommentRow[]> {
    const rows = await this.call(`/rest/v1/commentary?select=id,created_at,name,body&section=eq.${encodeURIComponent(section)}&order=created_at.desc&limit=${limit}`, { method: 'GET' }, !!this.session);
    return Array.isArray(rows) ? rows : [];
  }

  async postComment(body: string, section = 'dorfplatz'): Promise<void> {
    await this.ensureSession();
    await this.call('/rest/v1/commentary', { method: 'POST', prefer: 'return=minimal', body: { section, body: body.slice(0, 200) } });
  }

  // ---------- Kriegerliste und Briefe (Teil 3 der Datenbank) ----------

  /** Teil 3 fehlt noch? Dann melden die Aufrufe das verständlich. */
  private missingPart3(e: unknown): boolean {
    return e instanceof CloudError && /404|42P01|PGRST202|PGRST205|42883|warriors|mail/.test(e.message) && e.code === 'server';
  }

  async warriors(): Promise<WarriorRow[]> {
    await this.ensureSession();
    try {
      const rows = await this.call('/rest/v1/rpc/warriors', { method: 'POST', body: {} });
      return (Array.isArray(rows) ? rows : []).map((r: Record<string, unknown>) => ({
        userId: String(r.user_id), name: String(r.name), gender: r.gender === 'f' ? 'f' : 'm', level: Number(r.level), race: normalizeRace(r.race),
        specialty: normalizeSpecialty(r.specialty), dragonKills: Number(r.dragon_kills), alive: !!r.alive, online: !!r.online, inInn: !!r.in_inn, lastSeen: String(r.last_seen),
      }));
    } catch (e) {
      if (this.missingPart3(e)) throw new CloudError('server', 'Die Kriegerliste ist auf dem Server noch nicht eingerichtet (Teil 3).');
      throw e;
    }
  }

  async mailbox(limit = 50): Promise<MailRow[]> {
    await this.ensureSession();
    try {
      const rows = await this.call(`/rest/v1/mail?select=id,created_at,from_user,from_name,subject,body,seen&order=created_at.desc&limit=${limit}`, { method: 'GET' });
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      if (this.missingPart3(e)) throw new CloudError('server', 'Briefe sind auf dem Server noch nicht eingerichtet (Teil 3).');
      throw e;
    }
  }

  /** Zahl ungelesener Briefe; 0, wenn Briefe (noch) nicht eingerichtet sind. */
  async unreadMail(): Promise<number> {
    if (!this.session) return 0;
    try {
      const rows = await this.call('/rest/v1/mail?select=id&seen=eq.false&limit=100', { method: 'GET' });
      return Array.isArray(rows) ? rows.length : 0;
    } catch {
      return 0;
    }
  }

  async sendMail(to: string, subject: string, body: string): Promise<void> {
    await this.ensureSession();
    await this.call('/rest/v1/mail', { method: 'POST', prefer: 'return=minimal', body: { to_user: to, subject: subject.slice(0, 60), body: body.slice(0, 1000) } });
  }

  async markMailSeen(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.ensureSession();
    await this.call(`/rest/v1/mail?id=in.(${ids.map(Number).join(',')})`, { method: 'PATCH', prefer: 'return=minimal', body: { seen: true } });
  }

  async deleteMail(id: number): Promise<void> {
    await this.ensureSession();
    await this.call(`/rest/v1/mail?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  }

  /** Spuken (Teil 3): einen lebenden Helden heimsuchen. */
  async haunt(target: string): Promise<{ success: boolean; name: string }> {
    await this.ensureSession();
    try {
      return await this.call('/rest/v1/rpc/haunt', { method: 'POST', body: { target } });
    } catch (e) {
      if (this.missingPart3(e)) throw new CloudError('server', 'Spuken ist auf dem Server noch nicht eingerichtet (Teil 3).');
      throw e;
    }
  }

  /** Die besten Drachentöter aller Spieler für die Ruhmeshalle. */
  async hallOfFame(limit = 20): Promise<FameRow[]> {
    const q = (cols: string) => this.call(`/rest/v1/profiles?select=${cols}&order=dragon_kills.desc,level.desc&limit=${limit}`, { method: 'GET' }, !!this.session);
    let rows: unknown;
    try { rows = await q('name,level,dragon_kills,gender'); } catch (e) {
      if (e instanceof CloudError && /gender|42703/.test(e.message)) rows = await q('name,level,dragon_kills'); else throw e;
    }
    return (Array.isArray(rows) ? rows : []).map((r: { name: string; level: number; dragon_kills: number; gender?: string }) => ({
      name: r.name, level: r.level, dragonKills: r.dragon_kills, gender: r.gender === 'f' ? 'f' : 'm',
    }));
  }

  // ---------- intern ----------

  private async ensureSession(): Promise<Session> {
    const s = this.session;
    if (!s) throw new CloudError('auth', 'Nicht angemeldet.');
    if (Date.now() < s.expiresAt - 60_000) return s;
    const r = await this.call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refreshToken } }, false);
    this.setSession(r);
    return this.session!;
  }

  private async call(path: string, o: { method: string; body?: unknown; prefer?: string }, auth = true): Promise<any> {
    if (!this.enabled) throw new CloudError('server', 'Online-Spielstand ist nicht eingerichtet.');
    const headers: Record<string, string> = { apikey: this.key, 'Content-Type': 'application/json' };
    // Angemeldet: eigener Zugangsschlüssel. Sonst nur der öffentliche Projektschlüssel als apikey
    // (funktioniert mit dem alten anon key und dem neuen publishable key).
    if (auth && this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
    if (o.prefer) headers.Prefer = o.prefer;
    let res: Response;
    try {
      res = await this.http(this.url + path, { method: o.method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
    } catch {
      throw new CloudError('offline', 'Keine Verbindung. Der Spielstand bleibt auf diesem Gerät und wird später abgeglichen.');
    }
    if (res.status === 401 || res.status === 403) {
      if (auth) this.signOut();
      throw new CloudError('auth', 'Anmeldung abgelaufen. Bitte neu anmelden.');
    }
    if (res.status === 400 && path.startsWith('/auth/v1/verify')) throw new CloudError('auth', 'Code ungültig.');
    if (!res.ok) {
      // Die genaue Meldung des Servers mitgeben, damit sich Fehler finden lassen.
      let detail = '';
      let d: { code?: string; message?: string; hint?: string } = {};
      try { d = JSON.parse(await res.text()); detail = [d.code, d.message, d.hint].filter(Boolean).join(' – '); } catch { /* keine Details */ }
      // Spielregeln vom Server ("Du hast heute schon 3 Spielerkämpfe gehabt.") direkt so anzeigen
      if (d.code === 'P0001' && d.message) throw new CloudError('rule', d.message);
      const where = path.split('?')[0].replace('/rest/v1/', '');
      throw new CloudError('server', `Server-Fehler ${res.status} bei ${where}${detail ? `: ${detail}` : ''}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  private setSession(r: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } }): void {
    this.session = { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() + r.expires_in * 1000, userId: r.user.id, email: r.user.email };
    this.store?.setItem(SESSION_KEY, JSON.stringify(this.session));
  }

  private readSession(): Session | null {
    try {
      const raw = this.store?.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
