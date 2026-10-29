// Neue Orte im Dorf, angelehnt an das Original:
//   Quirins Tränke  (im Original: Cedriks Tränke im Gasthaus) – Edelsteine gegen Tränke, je 2 Edelsteine.
//   Die Seherin     (im Original: das Zelt der Zigeunerin) – für Stufe × 20 Gold mit den Toten sprechen.
// Der Wyrmstein (Veteranen) und der Rosengarten sind reine Gesprächsorte und brauchen hier keine Regeln.

import { maxHp } from './balance';
import { RACES, raceName } from '../content/races';
import { SPECIALTIES } from '../content/specialties';
import type { GameState, RaceId, SpecialtyId } from './types';

import { lang, t } from '../i18n';

export type PotionId = 'charme' | 'leben' | 'heil' | 'vergessen' | 'verwandlung';

export interface Potion { id: PotionId; name: string; gems: number; effect: string; blurb: string }

export const POTIONS: Potion[] = [
  { id: 'charme', name: t('Charmetrank'), gems: 2, effect: t('+1 Charme'), blurb: t('Riecht nach Rosen und ein bisschen nach Frieda.') },
  { id: 'leben', name: t('Lebenstrank'), gems: 2, effect: t('+1 Lebenspunkt, für immer'), blurb: t('Dick wie Honig. Bleibt dir auch nach dem Drachen.') },
  { id: 'heil', name: t('Heiltrank'), gems: 2, effect: t('volle Lebenspunkte und 20 obendrauf'), blurb: t('Die 20 Extrapunkte halten, bis sie im Kampf verbraucht sind.') },
  { id: 'vergessen', name: t('Trank des Vergessens'), gems: 2, effect: t('neue Fähigkeit wählen'), blurb: t('Du vergisst, was du als Kind gelernt hast, und lernst etwas anderes.') },
  { id: 'verwandlung', name: t('Verwandlungstrank'), gems: 2, effect: t('neues Volk wählen'), blurb: t('Danach ist dir eine Weile schlecht (10 Runden schwächer im Kampf).') },
];

export const HEAL_BONUS = 20;
export const SICKNESS_ROUNDS = 10;

export function potion(id: string): Potion | undefined {
  return POTIONS.find((x) => x.id === id);
}

/** Einen Trank trinken. Gibt die Erzählung zurück oder einen Grund, warum es nicht geht. */
export function drinkPotion(s: GameState, id: PotionId): { ok: true; lines: string[] } | { ok: false; why: string } {
  const p = s.player;
  const pt = potion(id);
  if (!pt) return { ok: false, why: t('Diesen Trank kennt Quirin nicht.') };
  if (!p.alive) return { ok: false, why: t('Tote trinken nicht.') };
  if (p.gems < pt.gems) return { ok: false, why: t`Quirin schüttelt den Kopf. „${pt.gems} Edelsteine, nicht einer weniger.“` };
  if ((id === 'vergessen' || id === 'verwandlung') && p.pendingChoice) {
    return { ok: false, why: t('Du hast den letzten Trank noch nicht ganz verdaut. Entscheide dich erst.') };
  }
  p.gems -= pt.gems;
  const lines = [t`Du legst ${pt.gems} Edelsteine auf den Tresen. Quirin reicht dir ein Fläschchen, und du trinkst …`];
  if (id === 'charme') {
    p.charm += 1;
    lines.push(t('Du fühlst dich unwiderstehlich! (+1 Charme)'));
  } else if (id === 'leben') {
    p.potionHp = (p.potionHp ?? 0) + 1;
    p.hp += 1;
    lines.push(t`Du fühlst dich kräftig! (+1 Lebenspunkt für immer, jetzt ${maxHp(p)})`);
  } else if (id === 'heil') {
    p.hp = Math.max(p.hp, maxHp(p)) + HEAL_BONUS;
    lines.push(t`Du fühlst dich gesund! (Lebenspunkte voll, ${HEAL_BONUS} obendrauf)`);
  } else if (id === 'vergessen') {
    p.pendingChoice = 'spec';
    lines.push(t('Du fühlst dich völlig orientierungslos. Was hast du eigentlich als Kind gelernt? Zeit, sich neu zu entscheiden.'));
  } else {
    p.pendingChoice = 'race';
    lines.push(t('Du krümmst dich, deine Knochen fühlen sich an wie Pudding. Was wirst du wohl, wenn es vorbei ist?'));
  }
  return { ok: true, lines };
}

/** Nach dem Vergessenstrank: neue Fähigkeit. Die Fähigkeitspunkte bleiben. */
export function chooseNewSpecialty(s: GameState, id: SpecialtyId): string {
  const p = s.player;
  if (p.pendingChoice !== 'spec' || !SPECIALTIES[id]) return '';
  p.specialty = id;
  p.pendingChoice = '';
  const c = SPECIALTIES[id].childhood;
  return t`Plötzlich fällt es dir wieder ein: Als Kind hast du ${c.charAt(0).toLowerCase() + c.slice(1)}. Deine Fähigkeit ist jetzt ${SPECIALTIES[id].name}.`;
}

/** Nach dem Verwandlungstrank: neue Rasse, dazu die Übelkeit wie im Original. */
export function chooseNewRace(s: GameState, id: RaceId): string {
  const p = s.player;
  if (p.pendingChoice !== 'race' || !RACES[id]) return '';
  p.race = id;
  p.pendingChoice = '';
  p.buffs = [...p.buffs.filter((b) => b.id !== 'transmute'), {
    id: 'transmute', name: t('Verwandlungsübelkeit'), atkMult: 0.75, defMult: 0.75, rounds: SICKNESS_ROUNDS,
    wearOff: t('Die Übelkeit lässt nach. Endlich.'),
  }];
  const n = raceName(id, p.gender);
  return t`Als das Würgen aufhört, bist du ${lang === 'en' ? (/^[aeiou]/i.test(n) ? 'an' : 'a') : /(in|e)$/.test(n) ? 'eine' : 'ein'} ${n}. Dir ist noch ${SICKNESS_ROUNDS} Kampfrunden lang übel.`;
}

// ---------- Die Seherin ----------

export function seerCost(level: number): number {
  return level * 20;
}

export function paySeer(s: GameState): string | null {
  const p = s.player;
  if (p.seerPaid) return null;
  const cost = seerCost(p.level);
  if (p.gold < cost) return t`Oda lächelt dünn. „Die Toten sind tot, aber billig sind sie nicht. ${cost} Gold, Schätzchen.“`;
  p.gold -= cost;
  p.seerPaid = true;
  return null;
}
