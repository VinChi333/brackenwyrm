import { pick } from '../game/rng';
import type { SpecialtyId } from '../game/types';

// Kampftexte mit Abwechslung, wie in den Textkämpfen von damals.
// Platzhalter: {a} Gegner im Akkusativ ("den Steintroll"), {N} Gegner im Nominativ, großgeschrieben
// ("Der Steintroll"), {d} Schaden, {hits} Trefferverb des Monsters ("drischt mit seiner Faust auf dich ein").

const HERO_HIT = [
  'Du triffst {a} für {d} Schadenspunkte.',
  'Dein Schlag sitzt. {N} verliert {d} Lebenspunkte.',
  'Du erwischst {a} an der Seite: {d} Schaden.',
  'Du drängst {a} zurück und triffst: {d} Schaden.',
];
const HERO_HIT_WEAK = [
  'Du kratzt {a} nur: {d} Schaden.',
  'Ein Streifschuss. {N} merkt es kaum: {d} Schaden.',
  'Du triffst, aber ohne Kraft: {d} Schaden.',
];
const HERO_HIT_STRONG = [
  'Ein sauberer Treffer! {N} taumelt: {d} Schaden.',
  'Krachend triffst du {a}: {d} Schadenspunkte.',
  'Dein Schlag schleudert {a} zurück: {d} Schaden.',
];

const HERO_MISS = [
  'Du verfehlst {a}.',
  'Dein Schlag geht ins Leere. {N} weicht aus.',
  'Du stolperst über eine Wurzel und triffst nur Luft.',
  '{N} duckt sich unter deinem Angriff weg.',
];

const HERO_CRIT: Record<SpecialtyId, string[]> = {
  klinge: [
    'VOLLTREFFER! Du legst dein ganzes Gewicht in den Schlag und triffst {a} mit voller Wucht: {d} Schadenspunkte!',
    'VOLLTREFFER! Deine Klinge findet die Lücke in der Deckung. {N} heult auf: {d} Schadenspunkte!',
    'VOLLTREFFER! Ein Hieb wie aus dem Lehrbuch von Gundolf. {N} wankt: {d} Schadenspunkte!',
  ],
  wurzel: [
    'VOLLTREFFER! Dein Stab kracht auf {a}, und die Erde bebt mit: {d} Schadenspunkte!',
    'VOLLTREFFER! Für einen Moment leuchten die Runen auf deinem Stab. {N} wird zurückgeschleudert: {d} Schadenspunkte!',
    'VOLLTREFFER! Der Wald selbst scheint mitzuschlagen: {d} Schadenspunkte!',
  ],
  schleich: [
    'VOLLTREFFER! Du findest die verwundbare Stelle und stichst zu: {d} Schadenspunkte!',
    'VOLLTREFFER! {N} sieht dich nicht kommen. Deine Dolche schon: {d} Schadenspunkte!',
    'VOLLTREFFER! Ein Schritt zur Seite, ein Stich ins Herz der Deckung: {d} Schadenspunkte!',
  ],
};

const SPECIAL: Record<SpecialtyId, string[]> = {
  klinge: [
    '{move}! Du spaltest {a} mit voller Wucht: {d} Schaden.',
    '{move}! Du holst weit aus, und die Rinde splittert: {d} Schaden.',
  ],
  wurzel: [
    '{move}! Wurzeln brechen aus dem Boden und fesseln {a}: {d} Schaden.',
    '{move}! Dornige Ranken schlingen sich um {a} und ziehen sich zu: {d} Schaden.',
  ],
  schleich: [
    '{move}! Du tauchst in die Schatten und triffst {a} von hinten: {d} Schaden.',
    '{move}! Plötzlich bist du weg, und dann direkt hinter {a}: {d} Schaden.',
  ],
};

const FOE_HIT = [
  '{N} {hits}: {d} Schaden.',
  '{N} {hits}. Du verlierst {d} Lebenspunkte.',
  '{N} {hits}, du kannst nicht mehr ausweichen: {d} Schaden.',
];
const FOE_HIT_WEAK = [
  '{N} {hits}, aber du fängst das meiste ab: {d} Schaden.',
  '{N} {hits}. Nur ein Kratzer: {d} Schaden.',
];

const FOE_CRIT = [
  'Autsch! {N} {hits}, und zwar mit voller Kraft: {d} Schaden!',
  'Das tat weh! {N} trifft dich mitten in der Deckung: {d} Schaden!',
];

const FOE_MISS = [
  '{N} verfehlt dich.',
  'Du weichst im letzten Moment aus. {N} trifft nur Moos.',
  'Du drehst dich weg. {N} streift dich nur am Ärmel, ohne Schaden.',
  '{N} greift an, aber du bist schneller.',
];

const FOE_SKIPS = [
  '{N} kommt nicht zum Gegenschlag.',
  '{N} sucht dich noch, als du schon wieder bereit bist.',
];

export interface Names { a: string; N: string; hits: string; move: string }

function fill(t: string, n: Names, d = 0): string {
  return t.replace(/\{a\}/g, n.a).replace(/\{N\}/g, n.N).replace(/\{hits\}/g, n.hits).replace(/\{move\}/g, n.move).replace(/\{d\}/g, String(d));
}

export const say = {
  /** share = Anteil an den Lebenspunkten des Gegners, damit die Worte zur Wucht passen. */
  heroHit: (n: Names, d: number, share: number) => fill(pick(share < 0.07 ? HERO_HIT_WEAK : share > 0.28 ? HERO_HIT_STRONG : HERO_HIT), n, d),
  heroMiss: (n: Names) => fill(pick(HERO_MISS), n),
  heroCrit: (n: Names, d: number, s: SpecialtyId) => fill(pick(HERO_CRIT[s]), n, d),
  special: (n: Names, d: number, s: SpecialtyId) => fill(pick(SPECIAL[s]), n, d),
  foeHit: (n: Names, d: number, share: number) => fill(pick(share < 0.04 ? FOE_HIT_WEAK : FOE_HIT), n, d),
  foeCrit: (n: Names, d: number) => fill(pick(FOE_CRIT), n, d),
  foeMiss: (n: Names) => fill(pick(FOE_MISS), n),
  foeSkips: (n: Names) => fill(pick(FOE_SKIPS), n),
};
