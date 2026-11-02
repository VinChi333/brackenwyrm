// Spielrechner: Viele gedachte Helden spielen automatisch bis zum Drachen und weiter.
// Drei Spielweisen, damit man sieht, wie sich das Spiel für verschiedene Leute anfühlt.
//
// Aufruf:  npm run rechner                 (100 Helden je Spielweise, 3 Drachen)
//          npm run rechner -- 300 5        (300 Helden, 5 Drachen)
//          npm run rechner -- 100 3 --md bericht.md   (Bericht zusätzlich als Datei)
//
// Zwei Spieltage sind ein echter Tag (6 und 18 Uhr).

import { writeFileSync } from 'node:fs';
import { MOUNTS } from '../src/content/mounts';
import { ARMORS, WEAPONS, tradeIn } from '../src/content/items';
import { FOREST_EVENTS, eventById, eventTrace } from '../src/content/events';
import { MONSTERS } from '../src/content/monsters';
import {
  bankDeposit, bankWithdraw, buyItem, canChallengeMaster, chooseDragonBonus, closeFight, fightAction, forestSearch,
  heal, healCost, maxHp, newGame, resolveEvent, startDragonFight, startMasterFight, startNewDay, type ForestMode,
} from '../src/game/engine';
import { buyMount, tradeCost } from '../src/game/stable';
import { MAX_LEVEL } from '../src/game/balance';
import { chance, roll, seedRng } from '../src/game/rng';
import type { GameState } from '../src/game/types';

const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : '';
const nums = args.filter((a, i) => /^\d+$/.test(a) && (mdAt < 0 || i !== mdAt + 1));
const RUNS = Number(nums[0] ?? 100);
const DKS = Number(nums[1] ?? 3);

interface Style {
  id: string;
  name: string;
  about: string;
  /** Anteil der Spieltage, an denen gespielt wird */
  plays: number;
  /** Heilen, wenn die Lebenspunkte unter diesen Anteil fallen */
  healAt: number;
  /** Nicht mehr in den Wald, wenn darunter (nach dem Heilen) */
  stopAt: number;
  /** Suche "schwer", wenn gesund genug */
  hard: boolean;
}

const STYLES: Style[] = [
  { id: 'fleissig', name: 'Fleißig', about: 'spielt jeden Spieltag (zweimal am Tag), heilt vorsichtig', plays: 1, healAt: 0.45, stopAt: 0.3, hard: false },
  { id: 'gemuetlich', name: 'Gemütlich', about: 'spielt etwa einmal am Tag, heilt sehr vorsichtig', plays: 0.5, healAt: 0.6, stopAt: 0.4, hard: false },
  { id: 'wild', name: 'Draufgänger', about: 'spielt jeden Spieltag, sucht schwere Gegner, heilt spät', plays: 1, healAt: 0.25, stopAt: 0.15, hard: true },
];

interface Cycle {
  days: number;          // Spieltage für diesen Drachen
  deathsForest: number;
  deathsEvent: number;
  deathsDragon: number;
  fights: number;
  goldLost: number;      // Gold in Beutel und Kontor beim Drachenkill (geht verloren)
  killed: boolean;
  events: Map<string, number>;
  monsters: Map<string, number>;
  levelDays: number[];   // Spieltage je Stufe
}

const newCycle = (): Cycle => ({ days: 0, deathsForest: 0, deathsEvent: 0, deathsDragon: 0, fights: 0, goldLost: 0, killed: false, events: new Map(), monsters: new Map(), levelDays: Array(MAX_LEVEL + 1).fill(0) });
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function bestAffordable(s: GameState, kind: 'weapon' | 'armor'): void {
  const p = s.player;
  const list = kind === 'weapon' ? WEAPONS : ARMORS;
  const cur = list[kind === 'weapon' ? p.weaponTier : p.armorTier];
  for (let t = Math.min(list.length - 1, p.level); t > cur.tier; t--) {
    if (p.gold >= list[t].price - tradeIn(cur)) { buyItem(s, kind, t); return; }
  }
}

function fightOut(s: GameState): void {
  const f = s.fight!;
  while (!f.over) {
    const p = s.player;
    const costs = [5, 3, 2, 1].filter((c) => p.specialUses >= c);
    const important = f.kind !== 'forest';
    const want = f.foe.hp > f.foe.maxHp * 0.35 && (important || p.hp < maxHp(p) * 0.6) && costs.length && p.buffs.length < 2;
    fightAction(s, want ? `skill:${important ? costs[0] : costs[costs.length - 1]}` : 'attack');
  }
}

function topUp(s: GameState, threshold: number): void {
  const p = s.player;
  if (p.hp >= maxHp(p) * threshold) return;
  const need = healCost(p, maxHp(p) - p.hp);
  if (p.gold < need && p.bank > 0) bankWithdraw(s, need - p.gold);
  if (p.gold >= need) heal(s, 'full'); else heal(s, 'half');
}

/** Ein Held spielt bis zum DKS-ten Drachen. Liefert pro Drache einen Abschnitt. */
function playHero(style: Style, run: number): Cycle[] {
  const s = newGame('Bot', (['dunkel', 'mystik', 'dieb'] as const)[run % 3], run % 2 ? 'f' : 'm', (['mensch', 'elf', 'troll', 'zwerg'] as const)[Math.floor(run / 3) % 4]);
  const cycles: Cycle[] = [newCycle()];
  let cur = cycles[0];
  eventTrace.onPick = (id) => bump(cur.events, id);
  let safety = 0;
  while (safety++ < 500 * DKS) {
    const p = s.player;
    cur.days++;
    cur.levelDays[p.level]++;
    if (!chance(style.plays)) { startNewDay(s); continue; }

    if (p.bank > 0) bankWithdraw(s, p.bank);
    for (const id of ['hengst', 'wallach', 'pony'] as const) {
      if (MOUNTS[id].rank > (p.mount ? MOUNTS[p.mount].rank : 0) && p.gems >= tradeCost(p, id)) { buyMount(s, id); break; }
    }
    bestAffordable(s, 'weapon');
    bestAffordable(s, 'armor');

    // Meister (mehrmals am Tag, falls er gleich wieder bereit ist)
    while (p.alive && canChallengeMaster(p) === 'ok') {
      topUp(s, 0.99);
      startMasterFight(s);
      fightOut(s);
      const won = s.fight!.over === 'win';
      closeFight(s);
      bestAffordable(s, 'weapon');
      bestAffordable(s, 'armor');
      if (!won) break;
    }

    // Drache
    if (p.level >= MAX_LEVEL && p.alive && p.forestFights > 0 && p.weaponTier >= 13 && p.armorTier >= 13) {
      topUp(s, 0.99);
      const purse = p.gold + p.bank;
      startDragonFight(s);
      fightOut(s);
      const won = s.fight!.over === 'win';
      closeFight(s);
      if (won) {
        cur.goldLost = purse;
        cur.killed = true;
        chooseDragonBonus(s, (['atk', 'hp', 'def', 'ff'] as const)[(p.dragonKills - 1) % 4]);
        if (p.dragonKills >= DKS) break;
        cur = newCycle();
        cycles.push(cur);
        continue;
      }
      if (!p.alive) cur.deathsDragon++;
    }

    // Wald
    while (p.alive && p.forestFights > 0) {
      topUp(s, style.healAt);
      if (p.hp < maxHp(p) * style.stopAt) break;
      const mode: ForestMode = style.hard && p.level < MAX_LEVEL && p.hp > maxHp(p) * 0.7 ? 'hard' : 'normal';
      const r = forestSearch(s, mode);
      if (r.type === 'choice' && s.pendingEvent) {
        const ev = eventById(s.pendingEvent.id)!;
        const ok = ev.choices!.filter((x) => !x.available || x.available(p));
        resolveEvent(s, ok[roll(0, ok.length - 1)].id);
        if (!p.alive) cur.deathsEvent++;
        continue;
      }
      if (r.type === 'event') { if (!p.alive) cur.deathsEvent++; continue; }
      if (r.type !== 'fight') break;
      bump(cur.monsters, s.fight!.monsterId);
      fightOut(s);
      cur.fights++;
      if (s.fight!.over === 'lose') cur.deathsForest++;
      closeFight(s);
      if (canChallengeMaster(p) === 'ok') break;
    }
    if (p.alive && p.gold > 0) bankDeposit(s, p.gold);
    if (p.alive && canChallengeMaster(p) === 'ok') { cur.days--; cur.levelDays[p.level]--; continue; } // gleicher Tag, zurück zum Meister
    startNewDay(s);
  }
  eventTrace.onPick = undefined;
  return cycles.slice(0, DKS);
}

// ---------- Auswertung ----------

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x: number) => x.toFixed(1).replace('.', ',');
const out: string[] = [];
const say = (line = '') => { out.push(line); console.log(line); };

seedRng(42);
const eventIds = FOREST_EVENTS.map((e) => e.id);
say(`# Spielrechner Brackenwyrm`);
say();
say(`${RUNS} Helden je Spielweise, jeweils bis zum ${DKS}. Drachen. ${FOREST_EVENTS.length} Waldereignisse, ${MONSTERS.length} Waldgegner im Spiel.`);
say(`Zwei Spieltage sind ein echter Tag.`);

const summary: string[] = [];
for (const style of STYLES) {
  const all: Cycle[][] = [];
  for (let run = 0; run < RUNS; run++) all.push(playHero(style, run));
  say();
  say(`## ${style.name} (${style.about})`);
  say();
  say(`| Drache | geschafft | Spieltage | echte Tage | Tode Wald | Tode Ereignis | Tode Drache | Gold verloren beim Kill |`);
  say(`|---|---|---|---|---|---|---|---|`);
  for (let d = 0; d < DKS; d++) {
    const c = all.map((x) => x[d]).filter((x): x is Cycle => !!x?.killed);
    const done = c.length;
    say(`| ${d + 1}. | ${done}/${RUNS} | ${f1(avg(c.map((x) => x.days)))} | ${f1(avg(c.map((x) => x.days)) / 2)} | ${f1(avg(c.map((x) => x.deathsForest)))} | ${f1(avg(c.map((x) => x.deathsEvent)))} | ${f1(avg(c.map((x) => x.deathsDragon)))} | ${Math.round(avg(c.map((x) => x.goldLost)))} |`);
    if (d === 0) summary.push(`${style.name}: 1. Drache nach ${f1(avg(c.map((x) => x.days)) / 2)} echten Tagen`);
    if (d === DKS - 1 && DKS > 1) summary[summary.length - 1] += `, ${DKS}. Drache nach ${f1(avg(c.map((x) => x.days)) / 2)}`;
  }

  // Wiederholung beim ersten Drachen
  const first = all.map((x) => x[0]).filter((c) => c.killed);
  const evSeen = first.map((c) => [...c.events.values()].reduce((a, b) => a + b, 0));
  const evDistinct = first.map((c) => c.events.size);
  const evTop = new Map<string, number>();
  for (const c of first) for (const [k, v] of c.events) evTop.set(k, (evTop.get(k) ?? 0) + v);
  const top = [...evTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${f1(v / RUNS)}×`).join(', ');
  const never = eventIds.filter((id) => !evTop.has(id));
  const monPerLevel: number[] = [];
  for (const c of first) {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const ids = MONSTERS.filter((m) => m.level === l).map((m) => m.id);
      const n = ids.reduce((a, id) => a + (c.monsters.get(id) ?? 0), 0);
      if (n) monPerLevel.push(n / ids.length);
    }
  }
  say();
  say(`Bis zum 1. Drachen: ${f1(avg(first.map((c) => c.fights)))} Waldkämpfe, ${f1(avg(evSeen))} Waldereignisse (${f1(avg(evDistinct))} verschiedene).`);
  say(`Dasselbe Ereignis im Schnitt ${f1(avg(evSeen) / Math.max(1, avg(evDistinct)))}× gesehen. Am häufigsten: ${top}.`);
  if (never.length) say(`Nie gesehen: ${never.join(', ')}.`);
  say(`Denselben Gegner trifft man pro Stufe im Schnitt ${f1(avg(monPerLevel))}× (bei ${MONSTERS.filter((m) => m.level === 1).length} Gegnern je Stufe).`);
  const lv = Array.from({ length: MAX_LEVEL }, (_, i) => avg(first.map((c) => c.levelDays[i + 1])));
  say(`Spieltage je Stufe (1. Drache): ${lv.map((x, i) => `${i + 1}: ${f1(x)}`).join(' · ')}`);
}

say();
say(`## Kurz`);
for (const l of summary) say(`- ${l}`);

if (mdFile) { writeFileSync(mdFile, out.join('\n') + '\n'); console.log(`\nBericht gespeichert: ${mdFile}`); }
