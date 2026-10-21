// Die Spielregeln. Jede Aktion verändert den GameState; die Darstellung liest ihn nur.

import { eventById, pickEvent } from '../content/events';
import { FRIEDA_TALKS_PER_DAY, friedaSays } from '../content/inn';
import { ARMORS, WEAPONS, tradeIn } from '../content/items';
import { masterForLevel } from '../content/masters';
import { DRAGON, MONSTERS, acc, datIndef, monsterById, monstersOfLevel, nom } from '../content/monsters';
import { say } from '../content/fighttext';
import { shadeById, SHADES } from '../content/shades';
import { SPECIALTIES } from '../content/specialties';
import {
  DEATH_EXP_LOSS, EVENT_CHANCE, FOREST_FIGHTS_PER_DAY, GEM_DROP_CHANCE, GRAVE_FIGHTS_PER_DAY, HARZBIER_BUFF, MAX_LEVEL,
  RESURRECT_FAVOR, RESURRECT_TURN_SHARE, favorRange, graveAttack, maxSoul, shadeStats, soulRestoreCost,
  attack, bankInterest, defense, dragonStats, expNeeded, expPerKill, goldPerKill, harzbierCost,
  healCost, masterStats, maxHp, monsterStats, specialUsesPerDay,
} from './balance';
import { between, chance, pick, rand, roll } from './rng';
import { newStats } from './storage';
import type { Fight, GameState, Gender, LogLine, Player, SpecialtyId } from './types';

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function newPlayer(name: string, specialty: SpecialtyId, gender: Gender = 'm'): Player {
  const p: Player = {
    name, specialty, gender, level: 1, exp: 0, hp: 0, baseMaxHp: 0, bonusAtk: 0, bonusDef: 0,
    weaponTier: 0, armorTier: 0, gold: 50, bank: 0, gems: 0, forestFights: FOREST_FIGHTS_PER_DAY,
    specialUses: 0, dragonKills: 0, alive: true, seenMaster: false, drankToday: false, songToday: false, innTalks: 0, soul: 0, favor: 0, graveFights: GRAVE_FIGHTS_PER_DAY, innRoom: false, buffs: [],
  };
  p.hp = maxHp(p);
  p.soul = maxSoul(p);
  p.specialUses = specialUsesPerDay(p);
  return p;
}

export function newGame(name: string, specialty: SpecialtyId, gender: Gender = 'm'): GameState {
  return {
    v: 1,
    player: newPlayer(name, specialty, gender),
    day: 1,
    lastRealDate: todayKey(),
    fight: null,
    pendingDragonBonus: false,
    news: ['Du kommst in Moosgrund an. Hinter dem Dorf rauscht der Brackenwald.'],
    bestiary: {},
    stats: { ...newStats(1), firstPlayed: todayKey() },
    chronicle: [],
    outbox: [],
    pendingEvent: null,
    settings: { retro: false, reducedMotion: false },
  };
}

/** Prüft, ob seit dem letzten Spielen ein echter Kalendertag vergangen ist. */
export function checkRealDay(s: GameState, today = todayKey()): boolean {
  if (s.lastRealDate === today) return false;
  s.lastRealDate = today;
  s.stats.realDays += 1;
  startNewDay(s);
  return true;
}

export function startNewDay(s: GameState): void {
  const p = s.player;
  s.day += 1;
  s.news = [];
  if (!p.alive) {
    p.alive = true;
    s.news.push('Morwen, die Fährfrau der Schatten, setzt dich am Morgen wieder am Dorfrand ab. „Bis zum nächsten Mal“, sagt sie.');
  }
  s.fight = null;
  s.pendingEvent = null;
  p.innTalks = 0;
  p.innRoom = false;
  p.hp = maxHp(p);
  p.soul = maxSoul(p);
  p.graveFights = GRAVE_FIGHTS_PER_DAY;
  p.forestFights = FOREST_FIGHTS_PER_DAY;
  p.specialUses = specialUsesPerDay(p);
  p.seenMaster = false;
  p.drankToday = false;
  p.songToday = false;
  p.buffs = [];
  const interest = bankInterest(p);
  if (interest > 0) {
    p.bank += interest;
    s.news.push(`Das Kontor schreibt dir ${interest} Gold Zinsen gut.`);
  }
  s.news.push(`Ein neuer Tag bricht an. Tag ${s.day}. Du hast ${p.forestFights} Waldkämpfe.`);
}

// ---------- Kampf ----------

function scaleVar(base: number): number {
  return Math.max(1, Math.round(base * between(0.85, 1.15)));
}

function makeFight(kind: Fight['kind'], monsterId: string, name: string, stats: ReturnType<typeof monsterStats>, expReward: number, goldReward: number, intro: string): Fight {
  return {
    kind, monsterId,
    foe: { name, ...stats },
    expReward, goldReward,
    round: 0,
    log: [{ t: intro, k: 'warn', r: 0 }],
    over: '', bound: 0,
    lastHeroDmg: 0, lastFoeDmg: 0, lastHeroMiss: false, lastFoeMiss: false, lastCrit: false, lastSpecial: false,
    seq: 0,
  };
}

export type ForestMode = 'normal' | 'easy' | 'hard';

export type ForestResult = { type: 'fight' } | { type: 'event'; lines: LogLine[] } | { type: 'choice' } | { type: 'none'; reason: string };

export function forestSearch(s: GameState, mode: ForestMode): ForestResult {
  const p = s.player;
  if (!p.alive) return { type: 'none', reason: 'Tote gehen nicht in den Wald. Sie spuken höchstens darin.' };
  if (p.forestFights <= 0) return { type: 'none', reason: 'Du bist zu müde für weitere Abenteuer. Morgen ist auch noch ein Tag.' };
  if (p.hp <= 0) return { type: 'none', reason: 'Du solltest erst zur Heilerin.' };
  if (s.pendingEvent) return { type: 'choice' };
  p.forestFights -= 1;

  if (mode === 'normal' && rand() < EVENT_CHANCE) {
    const ev = pickEvent(p);
    s.stats.events += 1;
    if (ev.choices && ev.prompt) {
      s.pendingEvent = { id: ev.id, lines: ev.prompt(p) };
      return { type: 'choice' };
    }
    return { type: 'event', lines: ev.run ? ev.run(p) : [] };
  }

  let lvl = p.level;
  let expMult = 1;
  let goldMult = 1;
  if (mode === 'easy') { lvl = Math.max(1, p.level - 1); expMult = lvl < p.level ? 0.6 : 0.8; goldMult = 0.7; }
  if (mode === 'hard') { lvl = Math.min(MAX_LEVEL, p.level + 1); expMult = 1.3; goldMult = 1.3; }
  const pool = monstersOfLevel(lvl);
  const m = pick(pool.length ? pool : MONSTERS);
  const stats = monsterStats(m.level, 0.92 + (m.scale ?? 1) * 0.08);
  stats.hp = scaleVar(stats.hp);
  stats.maxHp = stats.hp;
  const expR = Math.round(scaleVar(expPerKill(m.level)) * expMult);
  const goldR = Math.round(goldPerKill(m.level) * between(0.6, 1.4) * goldMult);
  s.fight = makeFight('forest', m.id, m.name, stats, expR, goldR, m.intro);
  return { type: 'fight' };
}

/** Löst ein wartendes Waldereignis mit der gewählten Möglichkeit auf. */
export function resolveEvent(s: GameState, choiceId: string): LogLine[] {
  const pe = s.pendingEvent;
  const ev = pe ? eventById(pe.id) : undefined;
  const choice = ev?.choices?.find((c) => c.id === choiceId);
  if (!pe || !choice) { s.pendingEvent = null; return []; }
  if (choice.available && !choice.available(s.player)) return [{ t: 'Das geht gerade nicht.', k: 'warn' }];
  s.pendingEvent = null;
  return choice.run(s.player);
}

// ---------- Schattenreich ----------

export function graveSearch(s: GameState): string | null {
  const p = s.player;
  if (p.alive) return 'Lebende haben am Nebelfluss nichts verloren.';
  if (p.graveFights <= 0) return 'Für heute hast du keine Kraft mehr für Schattenkämpfe. Morwen bringt dich bei Sonnenaufgang zurück.';
  if (p.soul <= 0) return 'Deine Seele ist zu schwach. Bitte Morwen, deine Seelenkraft zu stärken.';
  p.graveFights -= 1;
  const m = pick(SHADES);
  s.fight = makeFight('grave', m.id, m.name, shadeStats(p), 0, 0, m.intro);
  return null;
}

/** Gasthaus: Zimmer für die Nacht. Wer im Zimmer schläft, ist nur über eine Bestechung Friedas angreifbar. */
export function roomCost(level: number): number {
  return 10 * level + 10;
}

export function rentRoom(s: GameState): string {
  const p = s.player;
  if (p.innRoom) return 'Dein Zimmer ist schon bezahlt. Frieda hat dir sogar das Kissen aufgeschüttelt.';
  const cost = roomCost(p.level);
  if (p.gold < cost) return `Ein Zimmer kostet ${cost} Gold. So viel hast du nicht dabei.`;
  p.gold -= cost;
  p.innRoom = true;
  return `Frieda gibt dir den Schlüssel zu Zimmer 3. „Abschließen nicht vergessen.“ Wer hier schläft, ist vor Überfällen auf den Feldern sicher. (${cost} Gold)`;
}

export function restoreSoul(s: GameState): string {
  const p = s.player;
  const cost = soulRestoreCost(p);
  if (p.soul >= maxSoul(p)) return 'Deine Seele leuchtet schon hell genug.';
  if (p.favor < cost) return `Morwen will dafür ${cost} Gunst. So viel hast du nicht.`;
  p.favor -= cost;
  p.soul = maxSoul(p);
  return `Morwen haucht dich an. Deine Seelenkraft ist wieder voll. (${cost} Gunst)`;
}

/** Mit 100 Gunst zurück ins Leben, wie ein neuer Tag, aber mit weniger Waldkämpfen. */
export function resurrect(s: GameState): string {
  const p = s.player;
  if (p.alive) return 'Du lebst doch schon.';
  if (p.favor < RESURRECT_FAVOR) return `Morwen schüttelt den Kopf. „Komm wieder, wenn du ${RESURRECT_FAVOR} Gunst hast.“`;
  p.favor -= RESURRECT_FAVOR;
  p.alive = true;
  p.hp = maxHp(p);
  p.forestFights = Math.round(FOREST_FIGHTS_PER_DAY * RESURRECT_TURN_SHARE);
  p.specialUses = specialUsesPerDay(p);
  p.seenMaster = false;
  p.drankToday = false;
  p.songToday = false;
  p.innTalks = 0;
  p.buffs = [];
  s.fight = null;
  s.stats.resurrections += 1;
  announce(s, `Morwen hat ${p.name} vorzeitig aus dem Schattenreich zurückgebracht.`);
  const msg = `Morwen stakt dich über den Fluss und setzt dich am Dorfrand ab. „Ausnahmsweise“, sagt sie. Du lebst wieder und hast noch ${p.forestFights} Waldkämpfe.`;
  s.news.push(msg);
  return msg;
}

export function canChallengeMaster(p: Player): 'ok' | 'notReady' | 'seen' | 'max' | 'dead' {
  if (!p.alive) return 'dead';
  if (p.level >= MAX_LEVEL) return 'max';
  if (p.seenMaster) return 'seen';
  if (p.exp < expNeeded(p.level)) return 'notReady';
  return 'ok';
}

export function startMasterFight(s: GameState): boolean {
  const p = s.player;
  if (canChallengeMaster(p) !== 'ok') return false;
  const m = masterForLevel(p.level);
  if (!m) return false;
  p.seenMaster = true;
  s.fight = makeFight('master', `master-${p.level}`, m.name, masterStats(p.level), 0, 0, m.greeting);
  return true;
}

export function canSeekDragon(p: Player): boolean {
  return p.alive && p.level >= MAX_LEVEL && p.forestFights > 0;
}

export function startDragonFight(s: GameState): boolean {
  const p = s.player;
  if (!canSeekDragon(p)) return false;
  p.forestFights -= 1;
  s.fight = makeFight('dragon', 'dragon', DRAGON.name, dragonStats(), 0, 0, DRAGON.intro);
  return true;
}

interface Hit { dmg: number; miss: boolean; crit: boolean }

function strike(atk: number, def: number, opts: { noMiss?: boolean; ignoreDef?: boolean; mult?: number } = {}): Hit {
  if (!opts.noMiss && chance(0.08)) return { dmg: 0, miss: true, crit: false };
  const raw = atk * between(0.6, 1.4) * (opts.mult ?? 1);
  const block = opts.ignoreDef ? 0 : def * between(0.25, 0.75);
  let dmg = Math.max(1, Math.round(raw - block));
  const crit = chance(0.07);
  if (crit) dmg *= 2;
  return { dmg, miss: false, crit };
}

function heroAtk(p: Player): number {
  const mult = p.buffs.reduce((m, b) => m * b.atkMult, 1);
  return attack(p) * mult;
}

function tickBuffs(p: Player, log: LogLine[]): void {
  for (const b of p.buffs) b.rounds -= 1;
  const gone = p.buffs.filter((b) => b.rounds <= 0);
  p.buffs = p.buffs.filter((b) => b.rounds > 0);
  for (const b of gone) log.push({ t: `${b.name} lässt nach.`, k: 'info' });
}

function foeLabel(f: Fight): { n: string; a: string; N: string } {
  if (f.kind === 'master') {
    const m = masterForLevel(f.foe.level);
    return { n: f.foe.name, a: m?.accName ?? f.foe.name, N: f.foe.name };
  }
  const n = nom(f.monsterId, f.foe.name);
  return { n, a: acc(f.monsterId, f.foe.name), N: n.charAt(0).toUpperCase() + n.slice(1) };
}

function foeHits(f: Fight): string {
  if (f.kind === 'dragon') return DRAGON.hits;
  if (f.kind === 'grave') return shadeById(f.monsterId)?.hits ?? 'greift nach dir';
  if (f.kind === 'master') return 'trifft dich';
  return monsterById(f.monsterId)?.hits ?? 'trifft dich';
}

export type FightAction = 'attack' | 'special' | 'flee';

export function canUseSpecial(p: Player): boolean {
  return p.specialUses > 0;
}

/** Hängt Zeilen an den Kampfbericht an und merkt sich die Runde. Der Bericht bleibt ganz erhalten. */
/** Kurze Meldung für die Tagesneuigkeiten aller Spieler (geht beim nächsten Abgleich an den Server). */
export function announce(s: GameState, text: string): void {
  s.outbox = [...(s.outbox ?? []), text].slice(-20);
}

function pushLog(f: Fight, lines: LogLine[]): void {
  f.log.push(...lines);
  for (const l of f.log) if (l.r === undefined) l.r = f.round;
}

export function fightAction(s: GameState, action: FightAction): void {
  const f = s.fight;
  const p = s.player;
  if (!f || f.over) return;
  const L = foeLabel(f);
  const N = { a: L.a, N: L.N, hits: foeHits(f), move: SPECIALTIES[p.specialty].move };
  const grave = f.kind === 'grave';
  // Im Schattenreich kämpft die Seele: Seelenkraft statt Lebenspunkten, Stufe statt Ausrüstung.
  const heroPool = () => (grave ? p.soul : p.hp);
  const setHeroPool = (v: number) => { if (grave) p.soul = v; else p.hp = v; };
  const log: LogLine[] = [];
  f.round += 1;
  f.seq += 1;
  f.lastHeroDmg = 0; f.lastFoeDmg = 0; f.lastHeroMiss = false; f.lastFoeMiss = false; f.lastCrit = false; f.lastSpecial = false;

  let foeSkips = false;

  if (action === 'flee') {
    const odds = f.kind === 'forest' ? 0.5 : f.kind === 'dragon' || f.kind === 'grave' ? 0.33 : 1;
    if (f.kind === 'master') {
      log.push({ t: `Du gibst auf. ${f.foe.name} nickt verständnisvoll.`, k: 'info' });
      f.over = 'fled';
      pushLog(f, log);
      return;
    }
    if (chance(odds)) {
      if (grave) {
        const lost = Math.min(p.favor, 5 + roll(0, p.level));
        p.favor -= lost;
        log.push({ t: `Du fliehst in den Nebel. Morwen hat es gesehen: ${lost} Gunst weniger.`, k: 'warn' });
        f.over = 'fled';
        pushLog(f, log);
        return;
      }
      log.push({ t: f.kind === 'dragon' ? 'Du rennst, bis die Farnschlucht hinter dir liegt. Der Wyrm lacht dir nach.' : 'Du verschwindest im Dickicht. Diesmal war der Wald auf deiner Seite.', k: 'info' });
      f.over = 'fled';
      pushLog(f, log);
      return;
    }
    log.push({ t: 'Du versuchst zu fliehen, aber eine Wurzel hat andere Pläne.', k: 'warn' });
  } else {
    let h: Hit;
    const atk = grave ? graveAttack(p) : heroAtk(p);
    if (action === 'special' && canUseSpecial(p) && !grave) {
      p.specialUses -= 1;
      f.lastSpecial = true;
      if (p.specialty === 'klinge') {
        h = strike(atk, f.foe.def, { noMiss: true, mult: 1.9 });
      } else if (p.specialty === 'wurzel') {
        h = strike(atk, f.foe.def, { noMiss: true, ignoreDef: true, mult: 1.1 });
        foeSkips = true;
      } else {
        h = strike(atk, f.foe.def, { noMiss: true, mult: 1.6 });
        foeSkips = true;
      }
      log.push({ t: say.special(N, h.dmg, p.specialty) + (h.crit ? ' Ein Volltreffer!' : ''), k: h.crit ? 'crit' : 'special' });
    } else {
      h = strike(atk, f.foe.def);
      if (h.miss) log.push({ t: say.heroMiss(N), k: 'info' });
      else if (h.crit) log.push({ t: say.heroCrit(N, h.dmg, p.specialty), k: 'crit' });
      else log.push({ t: say.heroHit(N, h.dmg, h.dmg / f.foe.maxHp), k: 'good' });
    }
    f.topHit = Math.max(f.topHit ?? 0, h.dmg);
    const best = s.stats.bestHit;
    if (h.dmg > best.dmg) s.stats.bestHit = { dmg: h.dmg, foe: f.foe.name, day: s.day };
    f.lastHeroDmg = h.dmg;
    f.lastHeroMiss = h.miss;
    f.lastCrit = h.crit;
    f.foe.hp = Math.max(0, f.foe.hp - h.dmg);
    tickBuffs(p, log);

    if (f.foe.hp <= 0) {
      pushLog(f, log);
      winFight(s);
      return;
    }
  }

  // Gegenangriff
  if (foeSkips) {
    log.push({ t: say.foeSkips(N), k: 'info' });
  } else {
    const h = strike(f.foe.atk, grave ? graveAttack(p) : defense(p));
    f.lastFoeDmg = h.dmg;
    f.lastFoeMiss = h.miss;
    if (h.miss) log.push({ t: say.foeMiss(N), k: 'info' });
    else if (h.crit) log.push({ t: say.foeCrit(N, h.dmg), k: 'bad' });
    else log.push({ t: say.foeHit(N, h.dmg, h.dmg / (grave ? maxSoul(p) : maxHp(p))), k: 'bad' });
    setHeroPool(Math.max(0, heroPool() - h.dmg));
  }
  pushLog(f, log);
  if (heroPool() <= 0) loseFight(s);
}

function winFight(s: GameState): void {
  const f = s.fight!;
  const p = s.player;
  f.over = 'win';
  if (f.kind === 'forest') {
    const m = monsterById(f.monsterId);
    p.exp += f.expReward;
    p.gold += f.goldReward;
    f.log.push({ t: m?.falls ?? 'Der Gegner fällt.', k: 'info' });
    f.log.push({ t: `Du erhältst ${f.goldReward} Gold und ${f.expReward} Erfahrung.`, k: 'gold' });
    s.stats.kills += 1;
    const before = s.bestiary[f.monsterId] ?? 0;
    s.bestiary[f.monsterId] = before + 1;
    if (!before) f.log.push({ t: `Neue Karte im Bestiarium: ${f.foe.name}!`, k: 'gold' });
    if (chance(GEM_DROP_CHANCE)) {
      p.gems += 1;
      f.log.push({ t: 'Im Farn glitzert etwas: ein Edelstein!', k: 'gold' });
    }
  } else if (f.kind === 'grave') {
    const sh = shadeById(f.monsterId);
    const [lo, hi] = favorRange(p.level);
    const gain = roll(lo, hi);
    p.favor += gain;
    s.stats.shades += 1;
    f.log.push({ t: sh?.falls ?? 'Die Seele verweht.', k: 'info' });
    f.log.push({ t: `Morwen nickt dir vom Boot aus zu. +${gain} Gunst (jetzt ${p.favor}).`, k: 'gold' });
    const before = s.bestiary[f.monsterId] ?? 0;
    s.bestiary[f.monsterId] = before + 1;
    if (!before) f.log.push({ t: `Neue Schattenkarte im Bestiarium: ${f.foe.name}!`, k: 'gold' });
    if (p.favor >= RESURRECT_FAVOR) f.log.push({ t: 'Du hast genug Gunst. Morwen würde dich jetzt zurückbringen.', k: 'good' });
  } else if (f.kind === 'master') {
    const m = masterForLevel(p.level)!;
    s.stats.masters += 1;
    p.level += 1;
    p.hp = maxHp(p);
    f.log.push({ t: m.victory, k: 'info' });
    f.log.push({ t: `Du steigst auf Stufe ${p.level}! Deine Lebenskraft wächst auf ${maxHp(p)}.`, k: 'gold' });
    s.news.push(`Du hast ${m.name} besiegt und bist jetzt Stufe ${p.level}.`);
    announce(s, `${p.name} hat ${m.name} auf dem Trainingsplatz besiegt und ist jetzt Stufe ${p.level}.`);
  } else {
    p.dragonKills += 1;
    s.pendingDragonBonus = true;
    const days = s.day - s.stats.runStartDay + 1;
    if (!s.stats.fastestDragon || days < s.stats.fastestDragon) s.stats.fastestDragon = days;
    s.bestiary.dragon = (s.bestiary.dragon ?? 0) + 1;
    f.log.push({ t: DRAGON.falls, k: 'info' });
    f.log.push({ t: 'Du hast den Brackenwyrm besiegt!', k: 'gold' });
    announce(s, p.dragonKills === 1 ? `${p.name} hat den Brackenwyrm besiegt! Ganz Moosgrund feiert.` : `${p.name} hat den Brackenwyrm zum ${p.dragonKills}. Mal besiegt!`);
  }
  pushLog(f, []);
}

function loseFight(s: GameState): void {
  const f = s.fight!;
  const p = s.player;
  f.over = 'lose';
  if (f.kind === 'master') {
    p.hp = 1;
    f.log.push({ t: masterForLevel(p.level)?.defeat ?? 'Du bist besiegt.', k: 'warn' });
  } else if (f.kind === 'grave') {
    p.soul = 0;
    p.graveFights = 0;
    f.log.push({ t: 'Deine Seele zerfasert im Nebel. Für heute hast du keine Kraft mehr für Schattenkämpfe.', k: 'bad' });
  } else {
    const lostGold = p.gold;
    const levelStart = p.level > 1 ? expNeeded(p.level - 1) : 0;
    const lostExp = Math.floor(Math.max(0, p.exp - levelStart) * DEATH_EXP_LOSS);
    p.gold = 0;
    p.exp -= lostExp;
    p.alive = false;
    p.buffs = [];
    p.soul = maxSoul(p);
    s.stats.deaths += 1;
    s.stats.lastDeathDay = s.day;
    f.log.push({ t: 'Dir wird schwarz vor Augen. Du sinkst ins Moos …', k: 'bad' });
    f.log.push({ t: `Du verlierst ${lostGold} Gold und ${lostExp} Erfahrung.`, k: 'bad' });
    s.news.push(f.kind === 'dragon' ? 'Der Brackenwyrm hat dich besiegt.' : `Du bist im Wald gefallen.`);
    announce(s, f.kind === 'dragon' ? `${p.name} ist in der Farnschlucht vom Brackenwyrm verschlungen worden.` : `${p.name} wurde im Brackenwald von ${datIndef(f.monsterId, f.foe.name)} besiegt.`);
  }
  pushLog(f, []);
}

export const CHRONICLE_SIZE = 10;

export function closeFight(s: GameState): void {
  const f = s.fight;
  if (!f || !f.over) return;
  const top = f.topHit ?? 0;
  s.chronicle.unshift({ day: s.day, kind: f.kind, monsterId: f.monsterId, foe: f.foe.name, result: f.over, rounds: f.round, topHit: top, log: f.log });
  s.chronicle = s.chronicle.slice(0, CHRONICLE_SIZE);
  s.fight = null;
}

export type DragonBonus = 'atk' | 'def' | 'hp';

/** Nach dem Drachenkill: alles auf Anfang, ein dauerhafter Bonus bleibt. */
export function chooseDragonBonus(s: GameState, bonus: DragonBonus): void {
  if (!s.pendingDragonBonus) return;
  const p = s.player;
  if (bonus === 'atk') p.bonusAtk += 1;
  if (bonus === 'def') p.bonusDef += 1;
  if (bonus === 'hp') p.baseMaxHp += 5;
  p.level = 1;
  p.exp = 0;
  p.gold = 50;
  p.weaponTier = 0;
  p.armorTier = 0;
  p.hp = maxHp(p);
  p.specialUses = specialUsesPerDay(p);
  p.seenMaster = false;
  p.buffs = [];
  s.fight = null;
  s.pendingDragonBonus = false;
  s.stats.runStartDay = s.day;
  s.news = [`Moosgrund feiert dich als Drachentöter. Es ist dein ${p.dragonKills}. Sieg über den Brackenwyrm. Doch Wyrme kehren wieder …`];
}

// ---------- Dorf ----------

export function heal(s: GameState, mode: 'full' | 'half'): string {
  const p = s.player;
  const missing = maxHp(p) - p.hp;
  if (missing <= 0) return 'Du bist kerngesund. Mirla schickt dich weg.';
  const amount = mode === 'full' ? missing : Math.ceil(missing / 2);
  const cost = healCost(p, amount);
  if (p.gold < cost) return `Das kostet ${cost} Gold. So viel hast du nicht dabei.`;
  p.gold -= cost;
  p.hp += amount;
  return mode === 'full'
    ? `Mirla reibt dir Arnikasalbe auf die Wunden. Du bist wieder ganz heil. (${cost} Gold)`
    : `Mirla verbindet das Gröbste. ${amount} Lebenspunkte geheilt. (${cost} Gold)`;
}

export function buyItem(s: GameState, kind: 'weapon' | 'armor', tier: number): string {
  const p = s.player;
  const list = kind === 'weapon' ? WEAPONS : ARMORS;
  const current = list[kind === 'weapon' ? p.weaponTier : p.armorTier];
  const item = list[tier];
  if (!item || tier === current.tier) return 'Das hast du bereits.';
  const price = item.price - tradeIn(current);
  if (p.gold < price) return `Das kostet dich ${price} Gold mit Eintausch. So viel hast du nicht dabei.`;
  p.gold -= price;
  if (kind === 'weapon') p.weaponTier = tier; else p.armorTier = tier;
  return `Du tauschst ${current.name} gegen ${item.name}. (${price} Gold)`;
}

export function bankDeposit(s: GameState, amount: number): string {
  const p = s.player;
  const a = Math.min(Math.max(0, Math.floor(amount)), p.gold);
  if (a <= 0) return 'Du hast kein Gold zum Einzahlen.';
  p.gold -= a;
  p.bank += a;
  return `Du zahlst ${a} Gold ein. Im Kontor ist es sicher, auch wenn du im Wald fällst.`;
}

export function bankWithdraw(s: GameState, amount: number): string {
  const p = s.player;
  const a = Math.min(Math.max(0, Math.floor(amount)), p.bank);
  if (a <= 0) return 'Dein Konto ist leer.';
  p.bank -= a;
  p.gold += a;
  return `Du hebst ${a} Gold ab.`;
}

export function drinkHarzbier(s: GameState): string {
  const p = s.player;
  if (p.drankToday) return 'Wirtin Frieda schiebt dir ein Glas Wasser hin. „Eins am Tag reicht.“';
  const cost = harzbierCost(p.level);
  if (p.gold < cost) return `Ein Harzbier kostet ${cost} Gold.`;
  p.gold -= cost;
  p.drankToday = true;
  p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * 0.2));
  p.buffs.push({ ...HARZBIER_BUFF });
  return `Das Harzbier schmeckt nach Tannenzapfen und Mut. Du fühlst dich stärker. (${cost} Gold)`;
}

export function talkToFrieda(s: GameState): string {
  const p = s.player;
  if (p.innTalks >= FRIEDA_TALKS_PER_DAY) return 'Frieda hat gerade alle Hände voll zu tun. „Morgen wieder, Schätzchen.“';
  const t = friedaSays(s, p.innTalks);
  p.innTalks += 1;
  return t;
}

export function requestSong(s: GameState): string {
  const p = s.player;
  if (p.songToday) return 'Barde Florian ist heiser. „Morgen wieder“, krächzt er.';
  if (p.gems < 1) return 'Florian singt nur für einen Edelstein. Er sagt, das sei Kunst.';
  p.gems -= 1;
  p.songToday = true;
  const r = roll(1, 3);
  if (r === 1) {
    p.forestFights += 3;
    return 'Florian singt die Ballade vom unermüdlichen Wanderer. Du bekommst 3 zusätzliche Waldkämpfe.';
  }
  if (r === 2) {
    p.hp = maxHp(p);
    return 'Florian singt ein Wiegenlied so schön, dass deine Wunden sich schließen.';
  }
  p.specialUses += 2;
  return `Florian singt vom ${SPECIALTIES[p.specialty].name}-Helden aus alten Tagen. Du kannst deine Fähigkeit zweimal mehr einsetzen.`;
}

export { maxSoul, soulRestoreCost, RESURRECT_FAVOR };
export { expNeeded, maxHp, attack, defense, healCost, harzbierCost, specialUsesPerDay };
