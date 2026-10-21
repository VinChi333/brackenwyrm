// Spielstand speichern und laden. Im Prototyp lokal im Browser,
// später zusätzlich auf dem Server, damit Handy und PC denselben Stand haben.

import type { GameState, Stats } from './types';

const KEY = 'brackenwyrm.save.v1';
const CODE_PREFIX = 'BW1:';

/** keepTime: Zeitpunkt nicht erneuern (für einen vom Server geladenen Stand). */
export function saveGame(s: GameState, keepTime = false): boolean {
  if (!keepTime || !s.savedAt) s.savedAt = Date.now();
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
  return { kills: 0, deaths: 0, masters: 0, events: 0, runStartDay: day, fastestDragon: 0, lastDeathDay: 0, bestHit: { dmg: 0, foe: '', day: 0 }, shades: 0, resurrections: 0, realDays: 1, firstPlayed: '' };
}

/** Prüft und ergänzt einen Spielstand aus beliebiger Quelle (Browser, Code, Server). */
export function validate(x: unknown): GameState | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as GameState;
  if (s.v !== 1 || !s.player || typeof s.player.level !== 'number' || typeof s.day !== 'number') return null;
  s.settings = Object.assign({ retro: false, reducedMotion: false }, s.settings ?? {});
  s.news = Array.isArray(s.news) ? s.news : [];
  s.bestiary = s.bestiary && typeof s.bestiary === 'object' ? s.bestiary : {};
  s.player.buffs = Array.isArray(s.player.buffs) ? s.player.buffs : [];
  s.player.gender = s.player.gender === 'f' ? 'f' : 'm';
  s.player.innTalks = typeof s.player.innTalks === 'number' ? s.player.innTalks : 0;
  s.player.soul = typeof s.player.soul === 'number' ? s.player.soul : 50 + 5 * s.player.level;
  s.player.favor = typeof s.player.favor === 'number' ? s.player.favor : 0;
  s.player.graveFights = typeof s.player.graveFights === 'number' ? s.player.graveFights : 10;
  s.player.innRoom = !!s.player.innRoom;
  s.player.bonusFights = typeof s.player.bonusFights === 'number' ? s.player.bonusFights : 0;
  s.player.charm = typeof s.player.charm === 'number' ? s.player.charm : 0;
  s.player.dragonPoints = Array.isArray(s.player.dragonPoints) ? s.player.dragonPoints : [];
  s.flawlessDragon = !!s.flawlessDragon;
  s.outbox = Array.isArray(s.outbox) ? s.outbox.slice(-20) : [];
  s.stats = Object.assign(newStats(1), s.stats ?? {});
  s.pendingEvent = s.pendingEvent ?? null;
  s.chronicle = Array.isArray(s.chronicle) ? s.chronicle : [];
  // Spielstände aus Versionen ohne Zeitstempel gelten als vorhanden, aber älter als alles andere.
  if (typeof s.savedAt !== 'number' || !(s.savedAt > 0)) s.savedAt = 1;
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
  dev: boolean;           // Entwicklermodus: Testknöpfe sichtbar
  lastSyncedAt: number;   // savedAt des Stands, der zuletzt mit dem Server übereinstimmte (0 = nie)
  welcomed: boolean;      // Tester-Begrüßung gesehen
  fightHint: boolean;     // Hinweis "Befehle stehen links" schon gesehen
}

const PREFS_KEY = 'brackenwyrm.prefs';

export function loadPrefs(): Prefs {
  const base: Prefs = { reducedMotion: false, dev: false, welcomed: false, fightHint: false, lastSyncedAt: 0 };
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
