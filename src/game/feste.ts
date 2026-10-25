// Die versunkene Feste: ein Labyrinth (9 × 9), jeden Tag neu und für alle gleich (aus dem Datum gewürfelt).
// Angelehnt an das "Abandoned Castle" aus dem Original: Gänge, Fallen, Truhen, kleine Gegner, ein Hüter und ein Schatz.
// Regeln:
//   - Ab Stufe 5, nachdem man den Weg im Wald gefunden hat. Einmal am Tag, der Gang hinein kostet 3 Waldkämpfe.
//   - Licht für 80 Schritte (Fackel +30, Laterne +15). Vor der Halle des Hüters steht immer ein Brunnen. Ist es aus, ist der Ausflug vorbei, man verliert aber nichts.
//   - Kleine Gegner wachsen mit der Stufe, der Hüter ist stärker als ein Meister. Vor ihm gibt es keine Flucht.
//   - Der Schatz: Gold, Edelsteine und mit etwas Glück ein Erbstück (das erste Mal sicher).

import { expPerKill, goldPerKill, masterToughness, maxHp, monsterStats, toughen, forestToughness } from './balance';
import { between, chance, pick, roll } from './rng';
import { FESTE_MONSTERS, FESTE_TEXT, HEIRLOOMS, HUETER, SCROLLS, hasHeirloom, heirloom } from '../content/feste';
import type { FesteRun, Fight, GameState, Player } from './types';
export type { FesteRun };

export const SIZE = 9;
export const FESTE_MIN_LEVEL = 5;
export const FESTE_COST = 3;          // Waldkämpfe für den Gang hinein
export const FESTE_LIGHT = Number(globalThis.process?.env?.FESTE_LIGHT ?? 80);
export const TORCH_LIGHT = 30;
export const LANTERN_LIGHT = 15;
export const HEIRLOOM_CHANCE = 1 / 3;
/** Kleine Gegner sind schwächer als im Wald: man kann sich in der Feste kaum heilen. */
export const SMALL_SCALE = Number(globalThis.process?.env?.FESTE_SCALE ?? 0.7);
export const BOSS_HP = Number(globalThis.process?.env?.FESTE_BOSS ?? 1.8);
export const BOSS_ATK = Number(globalThis.process?.env?.FESTE_BOSS_ATK ?? 1.15);

export type Dir = 'n' | 'o' | 's' | 'w';
const DX: Record<Dir, number> = { n: 0, o: 1, s: 0, w: -1 };
const DY: Record<Dir, number> = { n: -1, o: 0, s: 1, w: 0 };
const BIT: Record<Dir, number> = { n: 1, o: 2, s: 4, w: 8 };
const OPP: Record<Dir, Dir> = { n: 's', o: 'w', s: 'n', w: 'o' };
export const DIRS: Dir[] = ['n', 'o', 's', 'w'];
export const DIR_NAME: Record<Dir, string> = { n: 'Norden', o: 'Osten', s: 'Süden', w: 'Westen' };

export type CellThing = '' | 'monster' | 'trap' | 'chest' | 'well' | 'torch' | 'scroll' | 'boss';

export interface Maze {
  day: string;
  open: number[];          // pro Feld: offene Richtungen als Bits (n=1, o=2, s=4, w=8)
  things: CellThing[];
  foes: string[];          // Gegner-Id auf Monsterfeldern
  start: number;
  boss: number;            // dort steht der Hüter, dahinter liegt der Schatz
}


// ---------- Das Labyrinth aus dem Datum ----------

function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellXY(c: number): [number, number] { return [c % SIZE, Math.floor(c / SIZE)]; }
function cellAt(x: number, y: number): number { return y * SIZE + x; }
function inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < SIZE && y < SIZE; }

/** Nachbarfeld in Richtung d, wenn dort keine Wand ist. */
export function step(m: Maze, c: number, d: Dir): number | null {
  if (!(m.open[c] & BIT[d])) return null;
  const [x, y] = cellXY(c);
  return cellAt(x + DX[d], y + DY[d]);
}

function distances(m: Maze, from: number): number[] {
  const dist = new Array(SIZE * SIZE).fill(-1);
  dist[from] = 0;
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    for (const d of DIRS) {
      const n = step(m, c, d);
      if (n !== null && dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); }
    }
  }
  return dist;
}

const MAZE_CACHE = new Map<string, Maze>();

export function mazeFor(day: string): Maze {
  const hit = MAZE_CACHE.get(day);
  if (hit) return hit;
  const r = seeded(`feste-${day}`);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const N = SIZE * SIZE;
  const open = new Array(N).fill(0);
  const start = cellAt(Math.floor(SIZE / 2), SIZE - 1);
  // Gänge graben (Tiefensuche mit Rücksprung): jedes Feld ist erreichbar.
  const visited = new Array(N).fill(false);
  const stack = [start];
  visited[start] = true;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const [x, y] = cellXY(c);
    const options = DIRS.filter((d) => inside(x + DX[d], y + DY[d]) && !visited[cellAt(x + DX[d], y + DY[d])]);
    if (!options.length) { stack.pop(); continue; }
    const d = options[ri(0, options.length - 1)];
    const n = cellAt(x + DX[d], y + DY[d]);
    open[c] |= BIT[d]; open[n] |= BIT[OPP[d]];
    visited[n] = true;
    stack.push(n);
  }
  // Ein paar Durchbrüche, damit es nicht nur Sackgassen gibt.
  for (let k = 0; k < 7; k++) {
    const c = ri(0, N - 1);
    const [x, y] = cellXY(c);
    const d = DIRS[ri(0, 3)];
    if (!inside(x + DX[d], y + DY[d])) continue;
    const n = cellAt(x + DX[d], y + DY[d]);
    open[c] |= BIT[d]; open[n] |= BIT[OPP[d]];
  }
  const m: Maze = { day, open, things: new Array(N).fill(''), foes: new Array(N).fill(''), start, boss: start };
  // Der Hüter steht am weitesten vom Eingang weg.
  const dist = distances(m, start);
  let far = start;
  for (let c = 0; c < N; c++) if (dist[c] > dist[far]) far = c;
  m.boss = far;
  m.things[far] = 'boss';
  // Vor der Halle des Hüters steht immer ein Brunnen: Man soll ihm nicht halb tot gegenübertreten.
  const before = DIRS.map((d) => step(m, far, d)).filter((x): x is number => x !== null).sort((a, b) => dist[a] - dist[b])[0];
  if (before !== undefined && before !== start) m.things[before] = 'well';
  // Inhalte verteilen, nicht direkt am Eingang.
  const free = Array.from({ length: N }, (_, c) => c).filter((c) => c !== far && !m.things[c] && dist[c] > 1);
  const take = (): number => free.splice(ri(0, free.length - 1), 1)[0];
  const place = (thing: CellThing, n: number) => { for (let i = 0; i < n && free.length; i++) m.things[take()] = thing; };
  place('monster', 7); place('trap', 3); place('chest', 4); place('well', 1); place('torch', 1); place('scroll', 3);
  // Je tiefer, desto gefährlicher die Gegner.
  const maxD = dist[far] || 1;
  for (let c = 0; c < N; c++) {
    if (m.things[c] !== 'monster') continue;
    const depth = dist[c] / maxD;
    const idx = Math.min(FESTE_MONSTERS.length - 1, Math.floor(depth * FESTE_MONSTERS.length * 0.9 + r() * 1.5));
    m.foes[c] = FESTE_MONSTERS[idx].id;
  }
  MAZE_CACHE.set(day, m);
  return m;
}

// ---------- Ein Ausflug in die Feste ----------

export function festeLight(p: Player): number {
  return FESTE_LIGHT + (hasHeirloom(p, 'laterne') ? LANTERN_LIGHT : 0);
}

export function canEnterFeste(s: GameState, today: string): 'ok' | 'notFound' | 'level' | 'dead' | 'today' | 'tired' {
  const p = s.player;
  if (!p.festeFound) return 'notFound';
  if (p.level < FESTE_MIN_LEVEL) return 'level';
  if (!p.alive) return 'dead';
  if (p.festeDay === today) return 'today';
  if (p.forestFights < FESTE_COST) return 'tired';
  return 'ok';
}

function reveal(run: FesteRun, m: Maze, c: number): void {
  const add = (x: number) => { if (!run.seen.includes(x)) run.seen.push(x); };
  add(c);
  for (const d of DIRS) { const n = step(m, c, d); if (n !== null) add(n); }
}

export function enterFeste(s: GameState, today: string): boolean {
  if (canEnterFeste(s, today) !== 'ok') return false;
  const p = s.player;
  const m = mazeFor(today);
  p.forestFights -= FESTE_COST;
  p.festeDay = today;
  s.feste = { day: today, pos: m.start, from: m.start, light: festeLight(p), seen: [], done: [], bossDown: false, over: '', log: [{ t: FESTE_TEXT.enter, k: 'info' }], gold: 0, gems: 0 };
  reveal(s.feste, m, m.start);
  return true;
}

/** Wohin es von hier aus geht (für die Knöpfe). */
export function exits(s: GameState): Dir[] {
  const run = s.feste;
  if (!run || run.over) return [];
  const m = mazeFor(run.day);
  return DIRS.filter((d) => step(m, run.pos, d) !== null);
}

function compass(from: number, to: number): string {
  const [x1, y1] = cellXY(from); const [x2, y2] = cellXY(to);
  const ns = y2 < y1 ? 'Nord' : y2 > y1 ? 'Süd' : '';
  const ow = x2 > x1 ? 'ost' : x2 < x1 ? 'west' : '';
  if (!ns && !ow) return 'genau hier';
  if (!ns) return `im ${ow === 'ost' ? 'Osten' : 'Westen'}`;
  if (!ow) return `im ${ns}en`;
  return `im ${ns}${ow}en`;
}

/** Feste-Kampf vorbereiten: kleine Gegner wie im Wald (etwas weniger Lohn), der Hüter wie ein starker Meister. */
function startFesteFight(s: GameState, foeId: string): void {
  const p = s.player;
  if (foeId === HUETER.id) {
    const st = monsterStats(p.level, BOSS_ATK);
    st.hp = Math.round(st.hp * BOSS_HP);
    const t = toughen(masterToughness(p), roll);
    st.atk += t.atk; st.def += t.def; st.hp += t.hp; st.maxHp = st.hp;
    s.fight = festeFight(HUETER.id, HUETER.name, st, expPerKill(p.level) * 6, 0, HUETER.intro);
    return;
  }
  const def = FESTE_MONSTERS.find((x) => x.id === foeId) ?? FESTE_MONSTERS[0];
  const st = monsterStats(p.level, SMALL_SCALE * (0.95 + (def.scale ?? 1) * 0.1));
  const t = toughen(forestToughness(p), roll);
  st.atk += t.atk; st.def += t.def; st.hp += t.hp; st.maxHp = st.hp;
  s.fight = festeFight(def.id, def.name, st, Math.round(expPerKill(p.level) * 0.7), Math.round(goldPerKill(p.level) * 0.8), def.intro);
}

function festeFight(id: string, name: string, stats: ReturnType<typeof monsterStats>, exp: number, gold: number, intro: string): Fight {
  return {
    kind: 'feste', monsterId: id, foe: { name, ...stats }, expReward: exp, goldReward: gold, round: 0,
    log: [{ t: intro, k: 'warn', r: 0 }], over: '', bound: 0,
    lastHeroDmg: 0, lastFoeDmg: 0, lastHeroMiss: false, lastFoeMiss: false, lastCrit: false, lastSpecial: false, seq: 0,
  };
}

/** Einen Schritt gehen. Was auf dem neuen Feld wartet, passiert sofort (Kampf, Falle, Truhe …). */
export function moveFeste(s: GameState, d: Dir): void {
  const run = s.feste;
  const p = s.player;
  if (!run || run.over || s.fight || !p.alive) return;
  const m = mazeFor(run.day);
  const n = step(m, run.pos, d);
  if (n === null) { run.log = [{ t: 'Da ist eine Wand. Massiv, feucht und sehr überzeugt von sich.', k: 'info' }]; return; }
  run.light -= 1;
  run.from = run.pos;
  run.pos = n;
  reveal(run, m, n);
  run.log = [];
  const thing = m.things[n];
  if (thing && !run.done.includes(n)) resolveCell(s, run, m, n, thing);
  else if (n === m.boss && run.bossDown) run.log.push({ t: 'Die Halle des Hüters. Es ist still geworden.', k: 'info' });
  if (!s.fight && !run.over && run.light <= 0) {
    run.over = 'dark';
    run.log.push({ t: FESTE_TEXT.dark, k: 'warn' });
  } else if (!s.fight && !run.over && run.light === 10) {
    run.log.push({ t: 'Deine Fackel wird kleiner. Noch 10 Schritte Licht.', k: 'warn' });
  }
}

function resolveCell(s: GameState, run: FesteRun, m: Maze, c: number, thing: CellThing): void {
  const p = s.player;
  const done = () => { run.done.push(c); };
  switch (thing) {
    case 'monster':
      startFesteFight(s, m.foes[c]);
      return;
    case 'boss':
      if (!run.bossDown) { startFesteFight(s, HUETER.id); return; }
      return;
    case 'trap': {
      done();
      const dmg = Math.max(1, Math.round(maxHp(p) * between(0.1, 0.22)));
      p.hp = Math.max(1, p.hp - dmg);
      run.log.push({ t: `${pick(FESTE_TEXT.traps)} ${dmg} Schaden.`, k: 'bad' });
      return;
    }
    case 'chest': {
      done();
      if (chance(0.15)) { run.log.push({ t: FESTE_TEXT.chestEmpty, k: 'info' }); return; }
      const gold = Math.round(goldPerKill(p.level) * between(1.5, 3.5));
      p.gold += gold; run.gold += gold;
      let t = `Eine alte Truhe! Darin: ${gold} Gold`;
      if (chance(0.3)) { p.gems += 1; run.gems += 1; t += ' und ein Edelstein'; }
      run.log.push({ t: `${t}.`, k: 'gold' });
      return;
    }
    case 'well':
      done();
      p.hp = Math.max(p.hp, maxHp(p));
      run.log.push({ t: FESTE_TEXT.well, k: 'good' });
      return;
    case 'torch':
      done();
      run.light += TORCH_LIGHT;
      run.log.push({ t: `${FESTE_TEXT.torch} (+${TORCH_LIGHT} Schritte Licht)`, k: 'good' });
      return;
    case 'scroll': {
      done();
      const i = p.festeScrolls ?? 0;
      const where = compass(c, m.boss);
      if (i < SCROLLS.length) {
        p.festeScrolls = i + 1;
        run.log.push({ t: `Eine Schriftrolle der Wyrmjäger (${i + 1} von ${SCROLLS.length}):`, k: 'info' });
        run.log.push({ t: `„${SCROLLS[i]}“`, k: 'info' });
      } else {
        run.log.push({ t: 'Eine Schriftrolle, die du schon kennst.', k: 'info' });
      }
      run.log.push({ t: `Am Rand hat jemand eine Skizze gekritzelt: Die Halle des Hüters liegt von hier aus ${where}.`, k: 'gold' });
      return;
    }
    default:
  }
}

/** Nach einem Feste-Kampf: Sieg erledigt das Feld, Flucht führt zurück, beim Hüter folgt der Schatz. */
export function afterFesteFight(s: GameState, result: Fight['over'], monsterId: string): void {
  const run = s.feste;
  if (!run) return;
  if (result === 'win') {
    if (!run.done.includes(run.pos)) run.done.push(run.pos);
    if (monsterId === HUETER.id) { run.bossDown = true; takeTreasure(s); }
  } else if (result === 'fled') {
    run.pos = run.from;
    run.log = [{ t: 'Du rennst zurück, woher du gekommen bist. Das Ding bleibt, wo es ist.', k: 'warn' }];
  } else if (result === 'lose') {
    run.over = 'dead';
  }
  if (!run.over && run.light <= 0) { run.over = 'dark'; run.log.push({ t: FESTE_TEXT.dark, k: 'warn' }); }
}

function takeTreasure(s: GameState): void {
  const run = s.feste!;
  const p = s.player;
  const gold = Math.round(goldPerKill(p.level) * 12 * between(0.85, 1.15) * (1 + 0.05 * p.dragonKills));
  const gems = roll(2, 4) + (p.dragonKills >= 3 ? 1 : 0);
  p.gold += gold; p.gems += gems;
  run.gold += gold; run.gems += gems;
  run.log = [{ t: FESTE_TEXT.treasure, k: 'info' }, { t: `Du stopfst dir ${gold} Gold und ${gems} Edelsteine in die Taschen.`, k: 'gold' }];
  const missing = HEIRLOOMS.filter((h) => !hasHeirloom(p, h.id));
  const first = !(p.heirlooms?.length) && !(p.festeTreasures);
  if (missing.length && (first || chance(HEIRLOOM_CHANCE))) {
    const h = pick(missing);
    p.heirlooms = [...(p.heirlooms ?? []), h.id];
    run.heirloom = h.id;
    if (h.id === 'siegelring') p.charm += 1;
    if (h.id === 'amulett') p.hp += 5;
    run.log.push({ t: `Zwischen den Münzen liegt etwas Besonderes: ${h.name}! (${h.bonus}, für immer)`, k: 'gold' });
    if (p.heirlooms.length === HEIRLOOMS.length) run.log.push({ t: 'Du hast alle Erbstücke der Wyrmjäger beisammen. Du bist ihr Erbe.', k: 'gold' });
  }
  p.festeTreasures = (p.festeTreasures ?? 0) + 1;
  run.over = 'treasure';
}

export function leaveFeste(s: GameState): void {
  const run = s.feste;
  if (!run || run.over) return;
  run.over = 'left';
  run.log = [{ t: FESTE_TEXT.left, k: 'info' }];
}

/** Zusammenfassung für die Tagesneuigkeiten (nur beim Schatz). */
export function treasureNews(p: Player, first: boolean): string {
  return `${p.name} hat ${first ? `heute als ${p.gender === 'f' ? 'Erste' : 'Erster'} ` : ''}den Hüter der versunkenen Feste besiegt und ihren Schatz gehoben!`;
}

export function heirloomNames(ids: string[] | undefined): string[] {
  return (ids ?? []).map((id) => heirloom(id)?.name).filter((x): x is string => !!x);
}
