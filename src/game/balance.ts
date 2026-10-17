// Alle Spielformeln an einer Stelle. Wer am Balancing dreht, dreht nur hier.
// Mit `npm run simulate` lässt sich prüfen, wie sich Änderungen auswirken.

import { ARMORS, WEAPONS } from '../content/items';
import type { Combatant, Player } from './types';

export const MAX_LEVEL = 15;
export const FOREST_FIGHTS_PER_DAY = 20;
export const EVENT_CHANCE = 0.12;
export const GEM_DROP_CHANCE = 0.03;
/** Anteil der Erfahrung der aktuellen Stufe, der beim Tod verloren geht. */
export const DEATH_EXP_LOSS = 0.15;
export const BANK_INTEREST = 0.03;
export const HARZBIER_BUFF = { name: 'Harzbier-Mut', atkMult: 1.15, rounds: 10 };

export function maxHp(p: Player): number {
  return 10 + 10 * p.level + p.baseMaxHp;
}

export function attack(p: Player): number {
  return 3 + 2 * p.level + WEAPONS[p.weaponTier].value + p.bonusAtk;
}

export function defense(p: Player): number {
  return 3 + 2 * p.level + ARMORS[p.armorTier].value + p.bonusDef;
}

export function specialUsesPerDay(p: Player): number {
  return 2 + Math.floor(p.level / 5);
}

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

export function expNeeded(level: number): number {
  return EXP_TABLE[level] ?? Infinity;
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
