// Prüft die versunkene Feste: Labyrinth, Regeln, Kämpfe, Schatz und Erbstücke. Mit kleiner Simulation am Ende.
import assert from 'node:assert/strict';
import { forestFightsPerDay, maxHp, attack, defense } from '../src/game/balance';
import { closeFight, fightAction, newGame, startNewDay } from '../src/game/engine';
import { DIRS, FESTE_COST, FESTE_LIGHT, SIZE, afterFesteFight, canEnterFeste, enterFeste, exits, leaveFeste, mazeFor, moveFeste, step, type Dir } from '../src/game/feste';
import { HEIRLOOMS } from '../src/content/feste';
import { seedRng } from '../src/game/rng';
import type { GameState } from '../src/game/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
const DAY = '2026-10-25';

function hero(level: number): GameState {
  const s = newGame('Probe', 'dunkel');
  const p = s.player;
  p.level = level; p.festeFound = true; p.weaponTier = Math.max(0, level - 1); p.armorTier = Math.max(0, level - 1);
  p.hp = maxHp(p); p.forestFights = 20;
  return s;
}

/** Weg von a nach b (Breitensuche), mit vollem Wissen über das Labyrinth. */
function path(day: string, a: number, b: number): Dir[] {
  const m = mazeFor(day);
  const prev = new Map<number, [number, Dir]>();
  const q = [a]; const seen = new Set([a]);
  while (q.length) {
    const c = q.shift()!;
    if (c === b) break;
    for (const d of DIRS) { const x = step(m, c, d); if (x !== null && !seen.has(x)) { seen.add(x); prev.set(x, [c, d]); q.push(x); } }
  }
  const out: Dir[] = [];
  for (let c = b; c !== a;) { const [pc, d] = prev.get(c)!; out.unshift(d); c = pc; }
  return out;
}

t('Labyrinth: jeden Tag gleich für alle, an anderen Tagen anders, alles erreichbar', () => {
  const a = mazeFor(DAY); const b = mazeFor(DAY); const c = mazeFor('2026-10-26');
  assert.equal(a, b);
  assert.notDeepEqual(a.open, c.open);
  for (let x = 0; x < SIZE * SIZE; x++) assert.ok(path(DAY, a.start, x).length >= 0);
  const count = (k: string) => a.things.filter((x) => x === k).length;
  assert.equal(count('boss'), 1); assert.equal(count('monster'), 7); assert.ok(count('well') >= 1); assert.equal(count('chest'), 4); assert.equal(count('scroll'), 3);
  assert.equal(a.things[a.start], '');
});
t('Zugang: erst finden, ab Stufe 5, 3 Waldkämpfe, einmal am Tag', () => {
  const s = hero(4); s.player.festeFound = false;
  assert.equal(canEnterFeste(s, DAY), 'notFound');
  s.player.festeFound = true;
  assert.equal(canEnterFeste(s, DAY), 'level');
  s.player.level = 5;
  assert.equal(enterFeste(s, DAY), true);
  assert.equal(s.player.forestFights, 20 - FESTE_COST);
  assert.equal(s.feste!.light, FESTE_LIGHT);
  leaveFeste(s);
  assert.equal(canEnterFeste(s, DAY), 'today');
  startNewDay(s);
  assert.equal(s.feste, null);
  assert.equal(canEnterFeste(s, '2026-10-26'), 'ok');
});
t('Gehen: Wände halten, Licht nimmt ab, Gegner starten einen Kampf, Flucht führt zurück', () => {
  seedRng(3);
  const s = hero(8); enterFeste(s, DAY);
  const m = mazeFor(DAY);
  const blocked = DIRS.find((d) => !exits(s).includes(d))!;
  const before = s.feste!.light;
  moveFeste(s, blocked);
  assert.equal(s.feste!.light, before, 'gegen die Wand kostet nichts');
  const target = m.things.findIndex((x) => x === 'monster');
  const route = path(DAY, m.start, target);
  for (const d of route) { if (s.fight) { s.fight.over = 'win'; afterFesteFight(s, 'win', s.fight.monsterId); closeFight(s); } moveFeste(s, d); }
  assert.ok(s.fight && s.fight.kind === 'feste', 'Kampf beginnt');
  const pos = s.feste!.pos; const from = s.feste!.from;
  afterFesteFight(s, 'fled', s.fight!.monsterId); closeFight(s);
  assert.equal(s.feste!.pos, from); assert.notEqual(pos, from);
});
t('Hüter: keine Flucht; Sieg bringt den Schatz und beim ersten Mal sicher ein Erbstück', () => {
  seedRng(5);
  const s = hero(15); enterFeste(s, DAY);
  const m = mazeFor(DAY);
  s.feste!.light = 999;
  for (const d of path(DAY, m.start, m.boss)) {
    if (s.fight) { const id = s.fight.monsterId; s.fight.over = 'win'; afterFesteFight(s, 'win', id); closeFight(s); }
    moveFeste(s, d);
  }
  assert.equal(s.fight?.monsterId, 'hueter');
  fightAction(s, 'flee');
  assert.equal(s.fight!.over, '', 'Flucht klappt nicht');
  const gold = s.player.gold;
  s.fight!.over = 'win'; afterFesteFight(s, 'win', 'hueter'); closeFight(s);
  assert.equal(s.feste!.over, 'treasure');
  assert.ok(s.player.gold > gold);
  assert.equal(s.player.heirlooms!.length, 1);
});
t('Erbstücke wirken', () => {
  const s = hero(5); const p = s.player;
  const ff = forestFightsPerDay(p), a = attack(p), d = defense(p), hp = maxHp(p);
  p.heirlooms = ['jagdhorn', 'klinge', 'schild', 'amulett'];
  assert.equal(forestFightsPerDay(p), ff + 1); assert.equal(attack(p), a + 1); assert.equal(defense(p), d + 1); assert.equal(maxHp(p), hp + 5);
  assert.equal(HEIRLOOMS.length, 8);
});
t('Licht aus: Ausflug vorbei, nichts verloren', () => {
  const s = hero(10); enterFeste(s, DAY);
  s.feste!.light = 1;
  const d = exits(s)[0];
  const gold = s.player.gold;
  moveFeste(s, d);
  if (s.fight) { const id = s.fight.monsterId; s.fight.over = 'win'; closeFight(s); afterFesteFight(s, 'win', id); }
  assert.equal(s.feste!.over, 'dark');
  assert.ok(s.player.gold >= gold);
});

// ---------- Simulation: Wie oft schafft man es, mit Licht und Kämpfen? ----------
function explore(level: number, day: string, seed: number): { result: string; steps: number } {
  seedRng(seed);
  const s = hero(level); s.player.bonusAtk = 0;
  enterFeste(s, day);
  const m = mazeFor(day);
  // Spieler ohne Wissen: geht zum nächsten unbesuchten Feld (wie jemand, der systematisch erkundet).
  const visited = new Set<number>([m.start]);
  let steps = 0;
  let killer = '';
  while (!s.feste!.over && s.player.alive) {
    if (s.fight) {
      while (!s.fight.over) fightAction(s, 'attack');
      const f = s.fight; afterFesteFight(s, f.over, f.monsterId); closeFight(s);
      if (!s.player.alive) { killer = f.monsterId === 'hueter' ? 'tot-hueter' : 'tot-klein'; break; }
      if (s.feste!.over) break;
      continue;
    }
    // nächstes unbesuchtes erreichbares Feld
    let best: Dir[] | null = null;
    for (let c = 0; c < SIZE * SIZE; c++) {
      if (visited.has(c) || !s.feste!.seen.includes(c)) continue;
      const r = path(day, s.feste!.pos, c);
      if (!best || r.length < best.length) best = r;
    }
    if (!best) break;
    moveFeste(s, best[0]); steps++;
    visited.add(s.feste!.pos);
    if (s.player.hp < maxHp(s.player) * 0.25 && !s.fight && !s.feste!.seen.includes(mazeFor(day).boss)) { leaveFeste(s); break; }
  }
  return { result: killer || s.feste!.over, steps };
}
for (const level of [5, 10, 15]) {
  const res: Record<string, number> = {};
  for (let i = 0; i < 60; i++) { const r = explore(level, `2026-11-${String(1 + (i % 28)).padStart(2, '0')}-${i}`, 100 + i); res[r.result] = (res[r.result] ?? 0) + 1; }
  console.log(`   Simulation Stufe ${level}:`, JSON.stringify(res));
}
console.log(`${n} Prüfungen bestanden`);
