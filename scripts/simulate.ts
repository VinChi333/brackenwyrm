// Balancing-Simulation: ein einfacher Bot spielt viele Durchgänge bis zum Drachenkill.
// Aufruf: npm run simulate   (optional: npm run simulate -- 200  für 200 Durchgänge)

import { ARMORS, WEAPONS, tradeIn } from '../src/content/items';
import {
  bankDeposit, bankWithdraw, buyItem, canChallengeMaster, chooseDragonBonus, closeFight, fightAction, forestSearch,
  heal, healCost, maxHp, newGame, startDragonFight, startMasterFight, startNewDay,
} from '../src/game/engine';
import { MAX_LEVEL, expNeeded } from '../src/game/balance';
import { seedRng } from '../src/game/rng';
import type { GameState } from '../src/game/types';

const RUNS = Number(process.argv[2] ?? 100);
seedRng(42);

interface LevelStats { fights: number; wins: number; deaths: number; rounds: number; hpLossPct: number; days: number }
const perLevel: LevelStats[] = Array.from({ length: MAX_LEVEL + 1 }, () => ({ fights: 0, wins: 0, deaths: 0, rounds: 0, hpLossPct: 0, days: 0 }));
let masterTries = 0, masterWins = 0;
const masterByLevel: { t: number; w: number }[] = Array.from({ length: MAX_LEVEL + 1 }, () => ({ t: 0, w: 0 }));
let dragonTries = 0, dragonWins = 0;
const daysToDragon: number[] = [];
let goldStarved = 0;

function bestAffordable(s: GameState, kind: 'weapon' | 'armor'): void {
  const p = s.player;
  const list = kind === 'weapon' ? WEAPONS : ARMORS;
  const cur = list[kind === 'weapon' ? p.weaponTier : p.armorTier];
  for (let t = Math.min(list.length - 1, p.level); t > cur.tier; t--) {
    const price = list[t].price - tradeIn(cur);
    if (p.gold >= price) { buyItem(s, kind, t); return; }
  }
}

function fightOut(s: GameState): void {
  const f = s.fight!;
  while (!f.over) {
    const p = s.player;
    const useSpecial = p.specialUses > 0 && f.foe.hp > f.foe.maxHp * 0.35 && (f.kind !== 'forest' || p.hp < maxHp(p) * 0.6);
    fightAction(s, useSpecial ? 'special' : 'attack');
  }
}

function topUp(s: GameState, threshold: number): void {
  const p = s.player;
  if (p.hp >= maxHp(p) * threshold) return;
  const need = healCost(p, maxHp(p) - p.hp);
  if (p.gold < need && p.bank > 0) bankWithdraw(s, need - p.gold);
  if (p.gold >= need) heal(s, 'full'); else { heal(s, 'half'); if (p.hp < maxHp(p) * threshold) goldStarved++; }
}

for (let run = 0; run < RUNS; run++) {
  const s = newGame('Bot', (['klinge', 'wurzel', 'schleich'] as const)[run % 3]);
  let levelStartDay = 1;
  let safety = 0;
  while (safety++ < 400) {
    const p = s.player;
    // Ausrüstung kaufen (Bankgeld mitnehmen)
    if (p.bank > 0) bankWithdraw(s, p.bank);
    bestAffordable(s, 'weapon');
    bestAffordable(s, 'armor');

    // Meister?
    if (canChallengeMaster(p) === 'ok') {
      topUp(s, 0.99);
      const lvl = p.level;
      startMasterFight(s);
      fightOut(s);
      masterTries++; masterByLevel[lvl].t++;
      if (s.fight!.over === 'win') {
        masterWins++; masterByLevel[lvl].w++;
        perLevel[lvl].days += s.day - levelStartDay + 1;
        levelStartDay = s.day;
      }
      closeFight(s);
      bestAffordable(s, 'weapon');
      bestAffordable(s, 'armor');
    }

    // Drache?
    if (p.level >= MAX_LEVEL && p.alive && p.forestFights > 0 && p.weaponTier >= 13 && p.armorTier >= 13) {
      topUp(s, 0.99);
      startDragonFight(s);
      fightOut(s);
      dragonTries++;
      const won = s.fight!.over === 'win';
      closeFight(s);
      if (won) { dragonWins++; daysToDragon.push(s.day); chooseDragonBonus(s, 'atk'); break; }
    }

    // Waldkämpfe
    while (p.alive && p.forestFights > 0) {
      topUp(s, 0.45);
      if (p.hp < maxHp(p) * 0.3) break;
      const startHp = p.hp;
      const r = forestSearch(s, 'normal');
      if (r.type !== 'fight') continue;
      const L = p.level;
      fightOut(s);
      const f = s.fight!;
      perLevel[L].fights++;
      perLevel[L].rounds += f.round;
      perLevel[L].hpLossPct += (startHp - p.hp) / maxHp(p);
      if (f.over === 'win') perLevel[L].wins++;
      if (f.over === 'lose') perLevel[L].deaths++;
      closeFight(s);
      if (canChallengeMaster(p) === 'ok') break;
    }
    // Überschuss sichern
    if (p.alive && p.gold > 0) bankDeposit(s, p.gold);
    if (canChallengeMaster(p) === 'ok' && p.alive) continue;
    startNewDay(s);
  }
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
console.log(`Durchgänge: ${RUNS}`);
console.log('Stufe | Kämpfe | Sieg   | Tod   | Runden | LP-Verlust/Kampf | Tage | EXP nötig | Meister-Sieg');
for (let l = 1; l <= MAX_LEVEL; l++) {
  const x = perLevel[l];
  console.log(
    `${String(l).padStart(5)} | ${String(x.fights).padStart(6)} | ${pct(x.wins, x.fights).padStart(6)} | ${pct(x.deaths, x.fights).padStart(5)} | ${(x.rounds / Math.max(1, x.fights)).toFixed(1).padStart(6)} | ${pct(x.hpLossPct, x.fights).padStart(16)} | ${(x.days / RUNS).toFixed(1).padStart(4)} | ${String(expNeeded(l)).padStart(9)} | ${pct(masterByLevel[l].w, masterByLevel[l].t)}`,
  );
}
console.log(`Meister gesamt: ${pct(masterWins, masterTries)} (${masterTries} Versuche)`);
console.log(`Drache: ${pct(dragonWins, dragonTries)} (${dragonTries} Versuche)`);
const avg = daysToDragon.reduce((a, b) => a + b, 0) / Math.max(1, daysToDragon.length);
console.log(`Tage bis zum ersten Drachenkill: Ø ${avg.toFixed(1)} (${daysToDragon.length}/${RUNS} geschafft)`);
console.log(`Situationen mit zu wenig Gold zum Heilen: ${goldStarved}`);
