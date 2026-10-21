// Flirten und Heiraten im Gasthaus. Regeln wie im Original (Modul "lovers" von LoGD):
// Jeder Flirtversuch würfelt zwischen deinem Charme und einer Schwelle. Wer genug Charme hat, schafft es sicher,
// sonst ist es Glück. Erfolg gibt einen Charmepunkt (bis zu einer Obergrenze je Stufe), grobe Fehlversuche kosten einen.
// Einmal pro Tag. Ab 22 Charme sagt der Schwarm Ja. Verheiratete verlieren jeden Tag etwas Charme und
// werden verlassen, wenn er auf 0 fällt.

import { PARTNERS, defaultPartner, looksVerdict } from '../content/lovers';
import { roll } from './rng';
import type { Buff, GameState, PartnerId, Player } from './types';

/** Schwelle, Obergrenze für den Charmegewinn und bis zu welchem Charme ein Fehlversuch einen Punkt kostet. */
const MOVES: { need: number; cap: number; loseBelow: number }[] = [
  { need: 2, cap: 4, loseBelow: 0 },
  { need: 4, cap: 7, loseBelow: 0 },
  { need: 7, cap: 11, loseBelow: 0 },
  { need: 11, cap: 14, loseBelow: 10 },
  { need: 14, cap: 18, loseBelow: 13 },
  { need: 18, cap: 25, loseBelow: Infinity },
];
export const MARRY_CHARM = 22;
export const STAIRS_TURNS = 2;

export function partnerOf(p: Player): PartnerId {
  return p.loverPref ?? defaultPartner(p.gender);
}

/** Gegenstück, das man nach seinem Aussehen fragt (der gute Freund statt des Schwarms). */
export function friendOf(p: Player): PartnerId {
  return partnerOf(p) === 'frieda' ? 'florian' : 'frieda';
}

export function loverBuff(id: PartnerId): Buff {
  return { name: PARTNERS[id].buffName, atkMult: 1, defMult: 1.2, rounds: 60 };
}

export interface FlirtResult { lines: string[]; kind: 'good' | 'bad' | 'info' | 'gold' }

/** Für Verheiratete: einfach zum Partner gehen. */
export function visitSpouse(s: GameState): FlirtResult {
  const p = s.player;
  const pt = PARTNERS[p.marriedTo as PartnerId];
  if (p.seenLover) return { lines: [pt.notToday], kind: 'info' };
  p.seenLover = true;
  if (roll(1, 4) === 1) {
    const lines = [pt.married.grumpy[roll(0, pt.married.grumpy.length - 1)]];
    if (p.charm > 0) { p.charm -= 1; lines.push('Du verlierst einen Charmepunkt.'); }
    return { lines, kind: 'bad' };
  }
  p.buffs = p.buffs.filter((b) => b.name !== pt.buffName);
  p.buffs.push(loverBuff(pt.id));
  p.charm += 1;
  return { lines: [pt.married.happy[roll(0, pt.married.happy.length - 1)], `${pt.buffName} schützt dich im Kampf (+20 % Verteidigung). Du bekommst einen Charmepunkt.`], kind: 'good' };
}

/** Flirtversuch 0 bis 6 (6 = Heiratsantrag). Gibt die Erzählung zurück; Neuigkeiten gehen über announce(). */
export function flirt(s: GameState, move: number, announce: (s: GameState, t: string) => void): FlirtResult {
  const p = s.player;
  const id = partnerOf(p);
  const pt = PARTNERS[id];
  if (p.marriedTo && p.marriedTo !== id) return { lines: [`Du bist mit ${PARTNERS[p.marriedTo].name} verheiratet. Mit jemand anderem zu flirten wäre keine gute Idee …`], kind: 'info' };
  if (p.marriedTo === id) return visitSpouse(s);
  if (p.seenLover) return { lines: [pt.notToday], kind: 'info' };
  if (move < 0 || move > 6) return { lines: [], kind: 'info' };
  p.seenLover = true;
  let c = p.charm;
  const lines: string[] = [];
  let kind: FlirtResult['kind'] = 'info';

  if (move === 6) {
    if (c >= MARRY_CHARM) {
      p.marriedTo = id;
      p.buffs = p.buffs.filter((b) => b.name !== pt.buffName);
      p.buffs.push(loverBuff(id));
      lines.push(pt.proposalYes, `Ihr seid verheiratet! ${pt.buffName} schützt dich im Kampf (+20 % Verteidigung).`);
      announce(s, pt.weddingNews(p.name));
      s.news.push(`Du hast ${pt.name} geheiratet.`);
      return { lines, kind: 'gold' };
    }
    p.forestFights = 0;
    lines.push(pt.proposalNo, 'Du hast heute keine Waldkämpfe mehr.');
    return { lines, kind: 'bad' };
  }

  const m = MOVES[move];
  const lo = Math.min(c, m.need);
  const hi = Math.max(c, m.need);
  const ok = roll(lo, hi) >= m.need;
  const text = pt.moves[move];
  if (ok) {
    lines.push(text.ok);
    kind = 'good';
    if (c < m.cap) c += 1;
    if (move === 5) {
      if (p.forestFights > 0) {
        p.forestFights = Math.max(0, p.forestFights - STAIRS_TURNS);
        lines.push(`Du bist erschöpft. (−${STAIRS_TURNS} Waldkämpfe)`);
      }
      announce(s, pt.stairsNews(p.name));
    }
  } else {
    lines.push(text.fail);
    kind = 'bad';
    if (c > 0 && c < m.loseBelow) c -= 1;
  }
  if (c > p.charm) lines.push('Du bekommst einen Charmepunkt!');
  if (c < p.charm) lines.push('Du verlierst einen Charmepunkt!');
  p.charm = c;
  return { lines, kind };
}

/** Den guten Freund ehrlich fragen, wie man aussieht (verrät ungefähr den Charme). */
export function askLooks(p: Player): string {
  const friend = PARTNERS[friendOf(p)];
  const c = p.charm + roll(-1, 1);
  return `${friend.name} mustert dich lange und sehr ernst. Nur ein Freund ist wirklich ehrlich, deshalb hast du gefragt. Schließlich sagt ${friend.pron}: „${looksVerdict(c, p.gender === 'f')}“`;
}

/** Beim neuen Tag: Verheiratete lassen sich etwas gehen. Gibt Meldungen für die Neuigkeiten zurück. */
export function loverNewDay(s: GameState, announce: (s: GameState, t: string) => void): string[] {
  const p = s.player;
  p.seenLover = false;
  if (!p.marriedTo) return [];
  const pt = PARTNERS[p.marriedTo];
  const dk = Math.max(1, Math.round(0.85 * Math.sqrt(p.dragonKills)));
  const loss = roll(1, dk);
  p.charm -= loss;
  const out = [`Du bist verheiratet, also musst du nicht mehr so auf dein Äußeres achten. Du lässt dich ein bisschen gehen (−${loss} Charme).`];
  if (p.charm <= 0) {
    out.push(pt.leftLetter(p.name, p.gender === 'f'));
    announce(s, pt.leftNews(p.name));
    p.marriedTo = '';
    p.charm = 0;
  }
  return out;
}
