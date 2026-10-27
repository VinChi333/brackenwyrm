// Getränke am Tresen (Original: "Exotic Drinks" bei Cedrik) und das Lallen im Gespräch (Original: drunkenize).
// Rausch von 0 bis 100: ab 66 schenkt Frieda nichts mehr aus. Wer über 66 ins Bett geht, verliert morgens einen Waldkampf.
// Harte Getränke höchstens zweimal am Tag.

import { maxHp } from './balance';
import { chance, rand } from './rng';
import type { Buff, GameState } from './types';

import { t } from '../i18n';

export type DrinkId = 'harzbier' | 'moosmet' | 'kraeuterschnaps' | 'drachenfeuer' | 'quellwasser';

export interface Drink {
  id: DrinkId;
  name: string;
  costPerLevel: number;
  drunk: number;         // so viel Rausch
  hard?: boolean;
  blurb: string;
  serve: string;         // was Frieda tut
}

export const MAX_DRUNK = 66;
export const MAX_HARD = 2;

export const DRINKS: Drink[] = [
  { id: 'harzbier', name: t('Harzbier'), costPerLevel: 8, drunk: 25, blurb: t('Heilt ein wenig, macht Mut (mehr Angriff).'),
    serve: t('Frieda zapft ein schäumendes Harzbier aus dem Fass und schiebt es dir über den Tresen. Es schmeckt nach Tannenzapfen und Mut.') },
  { id: 'moosmet', name: t('Moosmet'), costPerLevel: 10, drunk: 20, blurb: t('Süß und schwer. Macht dich zäher (mehr Verteidigung).'),
    serve: t('Frieda gießt dir einen grünlich schimmernden Met ein. Er ist so süß, dass dir die Zähne summen.') },
  { id: 'kraeuterschnaps', name: t('Mirlas Kräuterschnaps'), costPerLevel: 12, drunk: 30, blurb: t('Mit etwas Glück ein zusätzlicher Waldkampf.'),
    serve: t('Frieda holt eine Flasche mit Mirlas Etikett unter dem Tresen hervor. „Medizin“, sagt sie und zwinkert.') },
  { id: 'drachenfeuer', name: t('Drachenfeuer'), costPerLevel: 15, drunk: 45, hard: true, blurb: t('Hart. Brennende Fäuste: viel mehr Schaden, weniger Deckung.'),
    serve: t('Frieda nimmt eine Flasche mit drei Kreuzen und einem Wyrm darauf und gießt ein winziges Gläschen ein. Du kippst es und Rauch steigt dir aus den Ohren.') },
  { id: 'quellwasser', name: t('Quellwasser'), costPerLevel: 0, drunk: -35, blurb: t('Kostenlos. Macht wieder klar im Kopf.'),
    serve: t('Frieda stellt dir einen Krug kaltes Quellwasser hin. „Geht aufs Haus.“') },
];

const BUFFS: Partial<Record<DrinkId, Buff>> = {
  harzbier: { id: 'drink', name: t('Harzbier-Mut'), atkMult: 1.15, rounds: 10, wearOff: t('Der Harzbier-Mut verfliegt.') },
  moosmet: { id: 'drink', name: t('Met-Wärme'), atkMult: 1, defMult: 1.15, rounds: 12, wearOff: t('Die Wärme vom Met lässt nach.') },
  drachenfeuer: { id: 'drink', name: t('Brennende Fäuste'), atkMult: 1.35, defMult: 0.85, rounds: 12, roundMsg: t('Deine Fäuste glühen.'), wearOff: t('Endlich brennen deine Hände nicht mehr.') },
};

export function drinkById(id: string): Drink | undefined {
  return DRINKS.find((d) => d.id === id);
}

export function drinkCost(d: Drink, level: number): number {
  return d.costPerLevel * level;
}

export function drunkWord(drunk: number): string {
  if (drunk <= 0) return t('nüchtern');
  if (drunk < 20) return 'beschwipst';
  if (drunk < 40) return 'angeheitert';
  if (drunk < 60) return 'ordentlich betrunken';
  return 'sturzbetrunken';
}

export function orderDrink(s: GameState, id: DrinkId): { ok: boolean; lines: string[] } {
  const p = s.player;
  const d = drinkById(id);
  if (!d) return { ok: false, lines: [t('Das hat Frieda nicht.')] };
  const drunk = p.drunk ?? 0;
  if (d.drunk > 0 && drunk >= MAX_DRUNK) return { ok: false, lines: [t('Frieda nimmt dir das Glas weg. „Du hattest genug, Schätzchen. Trink Wasser.“')] };
  if (d.hard && (p.hardDrinks ?? 0) >= MAX_HARD) return { ok: false, lines: [t('„Noch ein Drachenfeuer?“ Frieda schüttelt den Kopf. „Morgen. Vielleicht.“')] };
  const cost = drinkCost(d, p.level);
  if (p.gold < cost) return { ok: false, lines: [t`${d.name} kostet ${cost} Gold.`] };
  p.gold -= cost;
  p.drunk = Math.max(0, Math.min(100, drunk + d.drunk));
  if (d.hard) p.hardDrinks = (p.hardDrinks ?? 0) + 1;
  const lines = [d.serve];
  const buff = BUFFS[id];
  if (buff) {
    p.buffs = [...p.buffs.filter((b) => b.id !== 'drink'), { ...buff }];
    lines.push(t`(${buff.name}: ${buff.rounds} Kampfrunden)`);
  }
  if (id === 'harzbier') p.hp = Math.min(Math.max(p.hp, maxHp(p)), p.hp + Math.round(maxHp(p) * 0.2));
  if (id === 'kraeuterschnaps' && chance(0.33)) { p.forestFights += 1; lines.push(t('Der Schnaps fährt dir in die Beine. Du fühlst dich, als könntest du noch einmal in den Wald! (+1 Waldkampf)')); }
  if (id === 'drachenfeuer') p.hp = Math.max(1, p.hp - Math.round(maxHp(p) * 0.05));
  if (id === 'quellwasser' && drunk > 0) lines.push(t('Der Nebel in deinem Kopf lichtet sich ein wenig.'));
  lines.push(t`Du bist jetzt ${drunkWord(p.drunk)}.`);
  return { ok: true, lines };
}

/** Am Morgen: Wer betrunken ins Bett ging, hat einen Kater. */
export function soberUp(s: GameState): string | null {
  const p = s.player;
  const was = p.drunk ?? 0;
  p.drunk = 0;
  p.hardDrinks = 0;
  if (was > MAX_DRUNK) {
    p.forestFights = Math.max(0, p.forestFights - 1);
    return t('Du wachst mit einem fürchterlichen Kater im Rinnstein auf und kriechst zurück ins Dorf. Ein Waldkampf weniger.');
  }
  return null;
}

/** Lallen wie im Original: Buchstaben verdoppeln, ab und zu ein *hic*. */
export function slur(text: string, drunk: number): string {
  if (drunk <= 0 || !text) return text;
  const map: Record<string, string> = { a: 'aa', e: 'ee', f: 'ff', h: 'hh', i: 'iy', l: 'll', m: 'mm', n: 'nn', o: 'oo', r: 'rr', s: 'sss', u: 'uu', w: 'ww', z: 'zz' };
  let out = text;
  let changes = 0;
  const target = Math.max(1, Math.round(text.length * drunk / 500));
  for (let guard = 0; changes < target && guard < 200; guard++) {
    if (rand() < 0.85) {
      const letters = Object.keys(map);
      const l = letters[Math.floor(rand() * letters.length)];
      const i = out.toLowerCase().indexOf(l, Math.floor(rand() * out.length));
      if (i < 0 || out.slice(Math.max(0, i - 4), i + 5).includes('*hic*')) continue;
      const rep = out[i] === out[i].toUpperCase() ? map[l].toUpperCase() : map[l];
      out = out.slice(0, i) + rep + out.slice(i + 1);
    } else {
      const spaces = [...out.matchAll(/ /g)].map((m) => m.index ?? 0);
      const at = spaces.length ? spaces[Math.floor(rand() * spaces.length)] : out.length;
      out = `${out.slice(0, at)} *hic*${out.slice(at)}`;
    }
    changes++;
  }
  return out.slice(0, 200);
}
