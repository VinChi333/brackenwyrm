// Die Spielregeln. Jede Aktion verändert den GameState; die Darstellung liest ihn nur.

import { eventById, pickEvent } from '../content/events';
import { FRIEDA_TALKS_PER_DAY, friedaSays } from '../content/inn';
import { ARMORS, WEAPONS, tradeIn } from '../content/items';
import { masterForLevel } from '../content/masters';
import { DRAGON, MONSTERS, acc, monsterById, monstersOfLevel, nom } from '../content/monsters';
import { SPECIALTIES } from '../content/specialties';
import {
  DEATH_EXP_LOSS, EVENT_CHANCE, FOREST_FIGHTS_PER_DAY, GEM_DROP_CHANCE, HARZBIER_BUFF, MAX_LEVEL,
  attack, bankInterest, defense, dragonStats, expNeeded, expPerKill, goldPerKill, harzbierCost,
  healCost, masterStats, maxHp, monsterStats, specialUsesPerDay,
} from './balance';
import { between, chance, pick, rand, roll } from './rng';
import { newStats } from './storage';
import type { Fight, GameState, LogLine, Player, SpecialtyId } from './types';

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function newPlayer(name: string, specialty: SpecialtyId): Player {
  const p: Player = {
    name, specialty, level: 1, exp: 0, hp: 0, baseMaxHp: 0, bonusAtk: 0, bonusDef: 0,
    weaponTier: 0, armorTier: 0, gold: 50, bank: 0, gems: 0, forestFights: FOREST_FIGHTS_PER_DAY,
    specialUses: 0, dragonKills: 0, alive: true, seenMaster: false, drankToday: false, songToday: false, innTalks: 0, buffs: [],
  };
  p.hp = maxHp(p);
  p.specialUses = specialUsesPerDay(p);
  return p;
}

export function newGame(name: string, specialty: SpecialtyId): GameState {
  return {
    v: 1,
    player: newPlayer(name, specialty),
    day: 1,
    lastRealDate: todayKey(),
    fight: null,
    pendingDragonBonus: false,
    news: ['Du kommst in Moosgrund an. Hinter dem Dorf rauscht der Brackenwald.'],
    bestiary: {},
    stats: newStats(1),
    pendingEvent: null,
    settings: { retro: false, reducedMotion: false },
  };
}

/** Prüft, ob seit dem letzten Spielen ein echter Kalendertag vergangen ist. */
export function checkRealDay(s: GameState, today = todayKey()): boolean {
  if (s.lastRealDate === today) return false;
  s.lastRealDate = today;
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
  p.hp = maxHp(p);
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
    log: [{ t: intro, k: 'warn' }],
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
  if (f.kind === 'master') return 'trifft dich';
  return monsterById(f.monsterId)?.hits ?? 'trifft dich';
}

export type FightAction = 'attack' | 'special' | 'flee';

export function canUseSpecial(p: Player): boolean {
  return p.specialUses > 0;
}

export function fightAction(s: GameState, action: FightAction): void {
  const f = s.fight;
  const p = s.player;
  if (!f || f.over) return;
  const L = foeLabel(f);
  const log: LogLine[] = [];
  f.round += 1;
  f.seq += 1;
  f.lastHeroDmg = 0; f.lastFoeDmg = 0; f.lastHeroMiss = false; f.lastFoeMiss = false; f.lastCrit = false; f.lastSpecial = false;

  let foeSkips = false;

  if (action === 'flee') {
    const odds = f.kind === 'forest' ? 0.5 : f.kind === 'dragon' ? 0.33 : 1;
    if (f.kind === 'master') {
      log.push({ t: `Du gibst auf. ${f.foe.name} nickt verständnisvoll.`, k: 'info' });
      f.over = 'fled';
      f.log = [...f.log, ...log].slice(-8);
      return;
    }
    if (chance(odds)) {
      log.push({ t: f.kind === 'dragon' ? 'Du rennst, bis die Farnschlucht hinter dir liegt. Der Wyrm lacht dir nach.' : 'Du verschwindest im Dickicht. Diesmal war der Wald auf deiner Seite.', k: 'info' });
      f.over = 'fled';
      f.log = [...f.log, ...log].slice(-8);
      return;
    }
    log.push({ t: 'Du versuchst zu fliehen, aber eine Wurzel hat andere Pläne.', k: 'warn' });
  } else {
    let h: Hit;
    const atk = heroAtk(p);
    if (action === 'special' && canUseSpecial(p)) {
      p.specialUses -= 1;
      f.lastSpecial = true;
      const sp = SPECIALTIES[p.specialty];
      if (p.specialty === 'klinge') {
        h = strike(atk, f.foe.def, { noMiss: true, mult: 1.9 });
        log.push({ t: `${sp.move}! Du spaltest ${L.a} mit voller Wucht: ${h.dmg} Schaden.`, k: 'good' });
      } else if (p.specialty === 'wurzel') {
        h = strike(atk, f.foe.def, { noMiss: true, ignoreDef: true, mult: 1.1 });
        foeSkips = true;
        log.push({ t: `${sp.move}! Wurzeln brechen aus dem Boden und fesseln ${L.a}: ${h.dmg} Schaden.`, k: 'good' });
      } else {
        h = strike(atk, f.foe.def, { noMiss: true, mult: 1.6 });
        foeSkips = true;
        log.push({ t: `${sp.move}! Du tauchst in die Schatten und triffst ${L.a} von hinten: ${h.dmg} Schaden.`, k: 'good' });
      }
    } else {
      h = strike(atk, f.foe.def);
      if (h.miss) log.push({ t: `Du verfehlst ${L.a}.`, k: 'info' });
      else if (h.crit) log.push({ t: `Volltreffer! Du triffst ${L.a} für ${h.dmg} Schaden.`, k: 'good' });
      else log.push({ t: `Du triffst ${L.a}: ${h.dmg} Schaden.`, k: 'good' });
    }
    f.lastHeroDmg = h.dmg;
    f.lastHeroMiss = h.miss;
    f.lastCrit = h.crit;
    f.foe.hp = Math.max(0, f.foe.hp - h.dmg);
    tickBuffs(p, log);

    if (f.foe.hp <= 0) {
      f.log = [...f.log, ...log].slice(-8);
      winFight(s);
      return;
    }
  }

  // Gegenangriff
  if (foeSkips) {
    log.push({ t: `${L.N} kommt nicht zum Gegenschlag.`, k: 'info' });
  } else {
    const h = strike(f.foe.atk, defense(p));
    f.lastFoeDmg = h.dmg;
    f.lastFoeMiss = h.miss;
    if (h.miss) log.push({ t: `${L.N} verfehlt dich.`, k: 'info' });
    else log.push({ t: `${L.N} ${foeHits(f)}: ${h.dmg} Schaden.`, k: 'bad' });
    p.hp = Math.max(0, p.hp - h.dmg);
  }
  f.log = [...f.log, ...log].slice(-8);
  if (p.hp <= 0) loseFight(s);
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
  } else if (f.kind === 'master') {
    const m = masterForLevel(p.level)!;
    s.stats.masters += 1;
    p.level += 1;
    p.hp = maxHp(p);
    f.log.push({ t: m.victory, k: 'info' });
    f.log.push({ t: `Du steigst auf Stufe ${p.level}! Deine Lebenskraft wächst auf ${maxHp(p)}.`, k: 'gold' });
    s.news.push(`Du hast ${m.name} besiegt und bist jetzt Stufe ${p.level}.`);
  } else {
    p.dragonKills += 1;
    s.pendingDragonBonus = true;
    const days = s.day - s.stats.runStartDay + 1;
    if (!s.stats.fastestDragon || days < s.stats.fastestDragon) s.stats.fastestDragon = days;
    s.bestiary.dragon = (s.bestiary.dragon ?? 0) + 1;
    f.log.push({ t: DRAGON.falls, k: 'info' });
    f.log.push({ t: 'Du hast den Brackenwyrm besiegt!', k: 'gold' });
  }
  f.log = f.log.slice(-8);
}

function loseFight(s: GameState): void {
  const f = s.fight!;
  const p = s.player;
  f.over = 'lose';
  if (f.kind === 'master') {
    p.hp = 1;
    f.log.push({ t: masterForLevel(p.level)?.defeat ?? 'Du bist besiegt.', k: 'warn' });
  } else {
    const lostGold = p.gold;
    const levelStart = p.level > 1 ? expNeeded(p.level - 1) : 0;
    const lostExp = Math.floor(Math.max(0, p.exp - levelStart) * DEATH_EXP_LOSS);
    p.gold = 0;
    p.exp -= lostExp;
    p.alive = false;
    p.buffs = [];
    s.stats.deaths += 1;
    s.stats.lastDeathDay = s.day;
    f.log.push({ t: 'Dir wird schwarz vor Augen. Du sinkst ins Moos …', k: 'bad' });
    f.log.push({ t: `Du verlierst ${lostGold} Gold und ${lostExp} Erfahrung.`, k: 'bad' });
    s.news.push(f.kind === 'dragon' ? 'Der Brackenwyrm hat dich besiegt.' : `Du bist im Wald gefallen.`);
  }
  f.log = f.log.slice(-8);
}

export function closeFight(s: GameState): void {
  if (s.fight && s.fight.over) s.fight = null;
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

export { expNeeded, maxHp, attack, defense, healCost, harzbierCost, specialUsesPerDay };
