// Spielerkonto und Online-Spielstand über Supabase (Anmeldung per E-Mail-Code, Datenbank per REST).
// Ohne VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY ist alles abgeschaltet und das Spiel läuft rein lokal.

import { validate } from './storage';
import type { GameState } from './types';

const URL_ = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const KEY_ = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const SESSION_KEY = 'brackenwyrm.session';

export interface Session { accessToken: string; refreshToken: string; expiresAt: number; userId: string; email: string }
export interface RemoteSave { state: GameState; savedAt: number }
export interface FameRow { name: string; dragonKills: number; level: number; title?: string }

export class CloudError extends Error {
  constructor(public code: 'offline' | 'auth' | 'server' | 'bad_code' | 'bad_login' | 'exists' | 'weak' | 'confirm', message: string) { super(message); }
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
    await this.call('/rest/v1/profiles', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: { user_id: s.userId, name: p.name, level: p.level, dragon_kills: p.dragonKills },
    });
  }

  /** Die besten Drachentöter aller Spieler für die Ruhmeshalle. */
  async hallOfFame(limit = 20): Promise<FameRow[]> {
    const rows = await this.call(`/rest/v1/profiles?select=name,level,dragon_kills&order=dragon_kills.desc,level.desc&limit=${limit}`, { method: 'GET' }, !!this.session);
    return (Array.isArray(rows) ? rows : []).map((r: { name: string; level: number; dragon_kills: number }) => ({ name: r.name, level: r.level, dragonKills: r.dragon_kills }));
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
    if (!res.ok) throw new CloudError('server', `Server antwortet mit Fehler ${res.status}.`);
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
