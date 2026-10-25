// Alle Spielformeln an einer Stelle. Wer am Balancing dreht, dreht nur hier.
// Mit `npm run simulate` lässt sich prüfen, wie sich Änderungen auswirken.

import { ARMORS, WEAPONS } from '../content/items';
import { MOUNTS } from '../content/mounts';
import type { Combatant, MountId, Player } from './types';

export const MAX_LEVEL = 15;
export const FOREST_FIGHTS_PER_DAY = 20;
export const EVENT_CHANCE = 0.15; // wie im Original (forestchance 15)
export const GEM_DROP_CHANCE = 0.03;
/** Anteil der Erfahrung der aktuellen Stufe, der beim Tod verloren geht. */
export const DEATH_EXP_LOSS = 0.15;
export const BANK_INTEREST = 0.03;
export const HARZBIER_BUFF = { name: 'Harzbier-Mut', atkMult: 1.15, rounds: 10 };

// ---------- Schattenreich (wie im Original: Seelenkraft, Schattenkämpfe, Gunst) ----------
export const GRAVE_FIGHTS_PER_DAY = 10;
export const RESURRECT_FAVOR = 100;
/** Im Original kostet die Rückkehr 6 von 10 Waldkämpfen; bei uns entsprechend 60 %. */
export const RESURRECT_TURN_SHARE = 0.4;

export function maxSoul(p: Player): number {
  return 50 + 5 * p.level;
}

/** Im Schattenreich zählen weder Waffe noch Rüstung, nur die Stufe. */
export function graveAttack(p: Player): number {
  return 10 + (p.level - 1) * 1.5;
}

export function shadeStats(p: Player): Omit<Combatant, 'name'> {
  const atk = 9 + (p.level - 1) * 1.5;
  const hp = Math.round(maxSoul(p) * 0.6);
  return { level: p.level, hp, maxHp: hp, atk: Math.round(atk), def: Math.round(atk * 0.7) };
}

/** Gunst für eine besiegte Seele: 10 bis 20, plus ein Drittel der Stufe. */
export function favorRange(level: number): [number, number] {
  const b = Math.floor(level / 3);
  return [10 + b, 20 + b];
}

/** Seelenkraft auffüllen kostet bis zu 10 Gunst, je nachdem wie viel fehlt. */
export function soulRestoreCost(p: Player): number {
  return Math.round((10 * (maxSoul(p) - p.soul)) / maxSoul(p));
}

export function maxHp(p: Player): number {
  return 10 + 10 * p.level + p.baseMaxHp + (p.potionHp ?? 0);
}

/** Rassenvorteil für Troll (Angriff) und Elf (Verteidigung), wie im Original: 1 + Stufe/5. */
export function raceBonus(p: Pick<Player, 'level'>): number {
  return 1 + Math.floor(p.level / 5);
}

export function attack(p: Player): number {
  return 3 + 2 * p.level + WEAPONS[p.weaponTier].value + p.bonusAtk + (p.race === 'troll' ? raceBonus(p) : 0);
}

export function defense(p: Player): number {
  return 3 + 2 * p.level + ARMORS[p.armorTier].value + p.bonusDef + (p.race === 'elf' ? raceBonus(p) : 0);
}

/** Fähigkeitspunkte pro Tag wie im Original: ein Punkt fürs Interesse, plus einer je drei Fähigkeitsstufen. */
export function specialUsesPerDay(p: Player): number {
  return 1 + Math.floor((p.skill ?? 0) / 3);
}

/** Zwerge finden 20 % mehr Gold. */
export const DWARF_GOLD = 1.2;

/** Erfahrung pro Sieg im Wald, bevor Zufall und Modus wirken. */
export function expPerKill(level: number): number {
  return 10 + 8 * level;
}

export function goldPerKill(level: number): number {
  return 6 + 12 * level;
}

/** Siege, die man ungefähr pro Stufe braucht. */
function killsPerLevel(level: number): number {
  return 20 + 1.5 * level;
}

const EXP_TABLE: number[] = (() => {
  // EXP_TABLE[L] = Erfahrung, die man insgesamt braucht, um den Meister der Stufe L herauszufordern.
  const t = [0, 0];
  let sum = 0;
  for (let l = 1; l < MAX_LEVEL; l++) {
    sum += Math.round(killsPerLevel(l) * expPerKill(l));
    t[l] = sum;
  }
  return t;
})();

/** Erfahrungstabelle des Originals, nur als Maßstab für den Zuschlag nach Drachenkills. */
const ORIG_EXP = [0, 100, 400, 1002, 1912, 3140, 4707, 6641, 8985, 11795, 15143, 19121, 23840, 29437, 36071, 43930];

/**
 * Erfahrung für den Meister der Stufe. Wie im Original wächst sie mit den Drachenkills:
 * + (Drachenkills / 4) × Stufe × 100 Original-Erfahrung, auf unsere Werte umgerechnet.
 */
export function expNeeded(level: number, dragonKills = 0): number {
  const base = EXP_TABLE[level];
  if (base === undefined) return Infinity;
  if (!dragonKills) return base;
  return Math.round(base + (dragonKills / 4) * level * 100 * (base / ORIG_EXP[level]));
}

// ---------- Gegner wachsen mit den Drachenpunkten (wie im Original, buffbadguy) ----------
/** Drachenpunkte in Angriff und Verteidigung plus zusätzliche Lebenspunkte / 5. */
export function dkPower(p: Pick<Player, 'bonusAtk' | 'bonusDef' | 'baseMaxHp'>): number {
  return p.bonusAtk + p.bonusDef + Math.floor(p.baseMaxHp / 5);
}

export interface Toughening { atk: number; def: number; hp: number; points: number }

/** Verteilt Punkte zufällig auf Angriff, Verteidigung und Lebenspunkte (Rest × 5), wie im Original. */
export function toughen(points: number, rnd: (a: number, b: number) => number, cap = Infinity): Toughening {
  const atk = Math.min(rnd(0, points), cap);
  const def = Math.min(rnd(0, points - atk), cap);
  return { atk, def, hp: (points - atk - def) * 5, points };
}

/** Waldgegner: ein Viertel der Drachenpunkte (+5 % je 100 Drachenkills). */
export function forestToughness(p: Player): number {
  return Math.round(dkPower(p) * (0.25 + (p.dragonKills / 100) * 0.05));
}
/** Meister: ein Drittel, Angriff und Verteidigung höchstens je ein Viertel davon. */
export function masterToughness(p: Player): number {
  return Math.round(dkPower(p) * 0.33);
}
/** Drache: drei Viertel. */
export function dragonToughness(p: Player): number {
  return Math.round(dkPower(p) * 0.75);
}

/** Gold pro fehlendem Lebenspunkt bei der Heilerin. */
export function healCostPerHp(level: number): number {
  return 0.15 * level + 0.5;
}

export function healCost(p: Player, hpToHeal: number): number {
  return Math.ceil(hpToHeal * healCostPerHp(p.level));
}

export function harzbierCost(level: number): number {
  return 8 * level;
}

export function bankInterest(p: Player): number {
  return Math.min(Math.floor(p.bank * BANK_INTEREST), 60 * p.level + 60);
}

export function monsterStats(level: number, scale = 1): Omit<Combatant, 'name'> {
  const hp = Math.round((5 + 10 * level) * scale);
  return {
    level,
    hp,
    maxHp: hp,
    atk: Math.round((1 + 2.8 * level) * scale),
    def: Math.round((1 + 2.2 * level) * scale),
  };
}

export function masterStats(level: number): Omit<Combatant, 'name'> {
  const hp = 12 + 12 * level;
  return { level, hp, maxHp: hp, atk: Math.round(2 + 4.6 * level), def: Math.round(2 + 3.2 * level) };
}

export function dragonStats(): Omit<Combatant, 'name'> {
  return { level: 18, hp: 300, maxHp: 300, atk: 64, def: 54 };
}

// ---------- Drachen-Neustart (wie im Original) ----------
/** Waldkämpfe pro Tag inklusive Drachenpunkten. */
export function forestFightsPerDay(p: { bonusFights?: number; race?: string; mount?: MountId | '' }): number {
  return FOREST_FIGHTS_PER_DAY + (p.bonusFights ?? 0) + (p.race === 'mensch' ? 1 : 0) + (p.mount ? MOUNTS[p.mount].fights : 0);
}
/** Startgold nach einem Drachenkill: 50 plus 50 je Drachenkill, höchstens 300. */
export function restartGold(dragonKills: number): number {
  return Math.min(300, 50 + 50 * dragonKills);
}
/** Edelsteine zum Neustart: ab dem 8. Drachenkill einer je weiterem Kill, höchstens 10. */
export function restartGems(dragonKills: number): number {
  return Math.min(10, Math.max(0, dragonKills - 7));
}
export const FLAWLESS_GOLD = 150;
export const FLAWLESS_GEMS = 1;
export const CHARM_PER_DRAGON = 5;
