// Spielstand speichern und laden. Im Prototyp lokal im Browser,
// später zusätzlich auf dem Server, damit Handy und PC denselben Stand haben.

import type { GameState, Stats } from './types';

const KEY = 'brackenwyrm.save.v1';
const CODE_PREFIX = 'BW1:';

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nichts zu tun */
  }
}

export function newStats(day: number): Stats {
  return { kills: 0, deaths: 0, masters: 0, events: 0, runStartDay: day, fastestDragon: 0, lastDeathDay: 0, bestHit: { dmg: 0, foe: '', day: 0 } };
}

function validate(x: unknown): GameState | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as GameState;
  if (s.v !== 1 || !s.player || typeof s.player.level !== 'number' || typeof s.day !== 'number') return null;
  s.settings = Object.assign({ retro: false, reducedMotion: false }, s.settings ?? {});
  s.news = Array.isArray(s.news) ? s.news : [];
  s.bestiary = s.bestiary && typeof s.bestiary === 'object' ? s.bestiary : {};
  s.player.buffs = Array.isArray(s.player.buffs) ? s.player.buffs : [];
  s.player.gender = s.player.gender === 'f' ? 'f' : 'm';
  s.player.innTalks = typeof s.player.innTalks === 'number' ? s.player.innTalks : 0;
  s.stats = Object.assign(newStats(1), s.stats ?? {});
  s.pendingEvent = s.pendingEvent ?? null;
  s.chronicle = Array.isArray(s.chronicle) ? s.chronicle : [];
  return s;
}

/** Spielstand als Text-Code, um ihn auf ein anderes Gerät mitzunehmen. */
export function exportCode(s: GameState): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return CODE_PREFIX + btoa(bin);
}

export function importCode(code: string): GameState | null {
  try {
    const c = code.trim();
    if (!c.startsWith(CODE_PREFIX)) return null;
    const bin = atob(c.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return validate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

// ---------- Darstellung (gilt für das Gerät, nicht für den Spielstand) ----------

export interface Prefs {
  reducedMotion: boolean;
}

const PREFS_KEY = 'brackenwyrm.prefs';

export function loadPrefs(): Prefs {
  const base: Prefs = { reducedMotion: false };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? Object.assign(base, JSON.parse(raw)) : base;
  } catch {
    return base;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* nicht schlimm: dann gilt die Einstellung nur bis zum Neuladen */
  }
}
