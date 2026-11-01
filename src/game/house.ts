// Häuser im Wohnviertel (angelehnt an die Häuser der deutschen Fassungen des Originals).
// Baumeister Holm verkauft den Bauplatz, danach wird in vier Stufen gebaut, höchstens eine Stufe pro Spieltag.
// Bezahlt wird aus dem Beutel, was fehlt, holt sich Holm bei Ansgar aus dem Kontor.
// Das Haus bleibt auch nach dem Drachen stehen. Wer darin schläft, ist vor Überfällen auf den Feldern und im
// Gasthaus sicher (nur Einbrecher kommen herein) und wacht ausgeschlafen auf.
// Truhe und Schlüssel liegen auf dem Server (server/supabase-11-haeuser.sql).

import { gameDayKey } from './clock';
import type { Buff, GameState, House } from './types';

import { t } from '../i18n';

export interface HouseStage { name: string; gold: number; gems: number; text: string }

export const PLOT_COST = 500;
export const HOUSE_NAME_MAX = 30;

export const HOUSE_STAGES: HouseStage[] = [
  { name: t('Fundament'), gold: 2000, gems: 1, text: t('Holms Leute heben die Grube aus und mauern ein Fundament aus Flusssteinen. Ein Edelstein kommt in den Grundstein, für das Glück.') },
  { name: t('Mauern'), gold: 3000, gems: 2, text: t('Stein auf Stein wachsen die Mauern. Die Fensterrahmen sind aus Eiche, und in die Schwelle ritzt Holm deinen Namen.') },
  { name: t('Dach'), gold: 3500, gems: 2, text: t('Der Dachstuhl steht, die Schindeln sind aus Lärche. Oben auf dem First nagelt Holm einen kleinen Wyrm aus Blech fest.') },
  { name: t('Einrichtung'), gold: 3500, gems: 3, text: t('Ein Bett, ein Tisch, ein Kamin, eine schwere Truhe mit drei Schlössern. Holm wischt sich die Hände an der Schürze ab: „Fertig. Willkommen daheim.“') },
];

export const HOME_BUFF: Buff = { id: 'home', name: t('Ausgeschlafen'), atkMult: 1, defMult: 1.1, rounds: 20, wearOff: t('Die Frische aus dem eigenen Bett lässt nach.') };

export function houseDone(h: House | null | undefined): boolean {
  return !!h && h.stage >= HOUSE_STAGES.length;
}

/** Wie viel Gold Beutel und Kontor zusammen hergeben. */
function purse(s: GameState): number {
  return Math.max(0, s.player.gold) + Math.max(0, s.player.bank);
}

/** Bezahlen: erst aus dem Beutel, den Rest aus dem Kontor. */
function pay(s: GameState, gold: number): void {
  const p = s.player;
  const fromPurse = Math.min(Math.max(0, p.gold), gold);
  p.gold -= fromPurse;
  p.bank -= gold - fromPurse;
}

export function cleanHouseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, HOUSE_NAME_MAX);
}

export function buyPlot(s: GameState, rawName: string): string | null {
  const p = s.player;
  if (p.house) return t('Du hast schon einen Bauplatz.');
  if (!p.alive) return t('Tote bauen keine Häuser.');
  const name = cleanHouseName(rawName);
  if (name.length < 2) return t('Wie soll dein Haus heißen? Holm braucht einen Namen fürs Schild.');
  if (purse(s) < PLOT_COST) return t`Ein Bauplatz kostet ${PLOT_COST} Gold.`;
  pay(s, PLOT_COST);
  p.house = { name, stage: 0, stageDay: '' };
  return null;
}

export type BuildCheck = 'ok' | 'none' | 'done' | 'today' | 'gold' | 'gems' | 'dead';

export function canBuild(s: GameState, today = gameDayKey()): BuildCheck {
  const p = s.player;
  const h = p.house;
  if (!h) return 'none';
  if (houseDone(h)) return 'done';
  if (!p.alive) return 'dead';
  if (h.stageDay === today) return 'today';
  const st = HOUSE_STAGES[h.stage];
  if (purse(s) < st.gold) return 'gold';
  if (p.gems < st.gems) return 'gems';
  return 'ok';
}

/** Die nächste Baustufe bezahlen. Gibt die Erzählung zurück oder einen Grund, warum es nicht geht. */
export function buildStage(s: GameState, today = gameDayKey()): { ok: true; lines: string[]; done: boolean } | { ok: false; why: string } {
  const c = canBuild(s, today);
  const h = s.player.house;
  if (c === 'none' || !h) return { ok: false, why: t('Erst brauchst du einen Bauplatz.') };
  if (c === 'done') return { ok: false, why: t('Dein Haus ist schon fertig.') };
  if (c === 'dead') return { ok: false, why: t('Tote bauen keine Häuser.') };
  if (c === 'today') return { ok: false, why: t('„Heute nicht mehr“, sagt Holm. „Der Mörtel muss erst trocknen. Komm am nächsten Spieltag wieder.“') };
  const st = HOUSE_STAGES[h.stage];
  if (c === 'gold') return { ok: false, why: t`Für ${st.name} braucht Holm ${st.gold} Gold (Beutel und Kontor zusammen).` };
  if (c === 'gems') return { ok: false, why: t`Für ${st.name} braucht Holm ${st.gems} ${st.gems === 1 ? t('Edelstein') : t('Edelsteine')}.` };
  pay(s, st.gold);
  s.player.gems -= st.gems;
  h.stage += 1;
  h.stageDay = today;
  const done = houseDone(h);
  return { ok: true, lines: [st.text], done };
}

/** Im eigenen Haus schlafen gehen (homeOf leer) oder bei Freunden (homeOf = Besitzer). */
export function sleepAtHome(s: GameState, homeOf = ''): string | null {
  const p = s.player;
  if (!p.alive) return t('Tote schlafen nicht.');
  if (!homeOf && !houseDone(p.house)) return t('Dein Haus ist noch nicht fertig.');
  const wasInn = p.innRoom;
  p.atHome = true;
  p.homeOf = homeOf;
  p.innRoom = false;
  return wasInn ? t('Friedas Zimmer gibst du zurück, das Geld bleibt bei ihr.') : null;
}

/** Am Morgen nach einer Nacht daheim. Gibt die Meldung zurück. */
export function homeMorning(s: GameState, slept: boolean): string | null {
  const p = s.player;
  p.atHome = false;
  p.homeOf = '';
  if (!slept) return null;
  p.buffs = [...p.buffs.filter((b) => b.id !== 'home'), { ...HOME_BUFF }];
  return t`Du wachst im eigenen Bett auf, ausgeschlafen wie lange nicht. (${HOME_BUFF.name}: mehr Verteidigung für ${HOME_BUFF.rounds} Kampfrunden)`;
}
