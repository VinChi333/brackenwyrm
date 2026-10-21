// Prüft Rassen und Fähigkeiten wie im Original.
import assert from 'node:assert/strict';
import { canUseSkill, chooseDragonBonus, fightAction, forestSearch, newGame, startMasterFight, startNewDay } from '../src/game/engine';
import { attack, defense, forestFightsPerDay, maxHp, specialUsesPerDay } from '../src/game/balance';
import { seedRng } from '../src/game/rng';
import { validate } from '../src/game/storage';
import type { GameState } from '../src/game/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
seedRng(11);

function arena(s: GameState, foeAtk = 30, foeHp = 5000): void {
  s.fight = { kind: 'forest', monsterId: 'borkenwolf', foe: { name: 'Borkenwolf', level: 2, hp: foeHp, maxHp: foeHp, atk: foeAtk, def: 5 }, expReward: 1, goldReward: 1,
    round: 0, log: [], over: '', bound: 0, lastHeroDmg: 0, lastFoeDmg: 0, lastHeroMiss: false, lastFoeMiss: false, lastCrit: false, lastSpecial: false, seq: 0 };
}

t('Rassen: Mensch +1 Waldkampf, Troll Angriff, Elf Verteidigung', () => {
  const m = newGame('M', 'dunkel', 'm', 'mensch').player;
  const tr = newGame('T', 'dunkel', 'm', 'troll').player;
  const e = newGame('E', 'dunkel', 'f', 'elf').player;
  assert.equal(m.forestFights, forestFightsPerDay(tr) + 1);
  assert.equal(attack(tr), attack(m) + 1);
  assert.equal(defense(e), defense(m) + 1);
  tr.level = 10; m.level = 10;
  assert.equal(attack(tr), attack(m) + 3, 'ab Stufe 10: 1 + 10/5');
});
t('Punkte pro Tag: 1 + Fähigkeitsstufe/3', () => {
  const p = newGame('X', 'mystik').player;
  assert.equal(specialUsesPerDay(p), 1);
  p.skill = 5; assert.equal(specialUsesPerDay(p), 2);
  p.skill = 12; assert.equal(specialUsesPerDay(p), 5);
});
t('Künste kosten 1/2/3/5 Punkte und brauchen genug Punkte', () => {
  const s = newGame('X', 'dieb');
  s.player.specialUses = 3; s.player.baseMaxHp = 500; s.player.hp = maxHp(s.player);
  assert.ok(canUseSkill(s.player, 3)); assert.ok(!canUseSkill(s.player, 5)); assert.ok(!canUseSkill(s.player, 4));
  arena(s);
  fightAction(s, 'skill:5');
  assert.equal(s.player.specialUses, 3, 'zu teuer: keine Punkte weg');
  fightAction(s, 'skill:2');
  assert.equal(s.player.specialUses, 1);
  assert.ok(s.player.buffs.some((b) => b.name === 'Giftklinge' && b.atkMult === 2));
});
t('Versteckter Angriff: Gegner trifft 5 Runden lang nicht', () => {
  const s = newGame('X', 'dieb');
  s.player.specialUses = 3; s.player.hp = 500; s.player.baseMaxHp = 500;
  arena(s, 80);
  fightAction(s, 'skill:3');
  for (let i = 0; i < 4; i++) fightAction(s, 'attack');
  assert.equal(s.player.hp, 500, 'keine Lebenspunkte verloren');
  fightAction(s, 'attack');
  assert.ok(s.fight!.log.some((l) => l.t.includes('wieder zu sehen')));
});
t('Seelenwelke: Gegner wehrt sich nicht und greift nicht an', () => {
  const s = newGame('X', 'dunkel');
  s.player.specialUses = 5; s.player.hp = 500; s.player.baseMaxHp = 500;
  arena(s, 80);
  fightAction(s, 'skill:5');
  assert.equal(s.player.hp, 500);
  assert.ok(s.fight!.log.some((l) => l.t.includes('Seelenwelke!')));
});
t('Skelettkrieger und Erdfaust schlagen zusätzlich zu', () => {
  const s = newGame('X', 'mystik');
  s.player.level = 10; s.player.specialUses = 2; s.player.baseMaxHp = 500; s.player.hp = maxHp(s.player);
  arena(s, 1);
  fightAction(s, 'skill:2');
  assert.ok(s.fight!.log.some((l) => l.t.includes('Faust aus Erde trifft')));
});
t('Regeneration heilt, Lebensentzug heilt durch Treffer', () => {
  const s = newGame('X', 'mystik');
  s.player.level = 8; s.player.specialUses = 4; s.player.hp = 10;
  arena(s, 1);
  fightAction(s, 'skill:1');
  assert.ok(s.player.hp > 10 - 1);
  assert.ok(s.fight!.log.some((l) => l.t.includes('heilst um')));
});
t('Blitzaura gibt dem Gegner doppelten Schaden zurück', () => {
  const s = newGame('X', 'mystik');
  s.player.specialUses = 5; s.player.baseMaxHp = 900; s.player.hp = maxHp(s.player);
  arena(s, 60);
  for (let i = 0; i < 5 && !s.fight!.log.some((l) => l.t.includes('Blitze')); i++) fightAction(s, i === 0 ? 'skill:5' : 'attack');
  assert.ok(s.fight!.log.some((l) => l.t.includes('Blitze aus deiner Haut')));
});
t('Meister besiegt: Fähigkeitsstufe steigt, jede dritte bringt einen Punkt', () => {
  const s = newGame('X', 'dunkel');
  const p = s.player;
  p.skill = 2; p.exp = 999999; p.specialUses = 0; p.bonusAtk = 999; p.baseMaxHp = 999; p.hp = maxHp(p);
  assert.ok(startMasterFight(s));
  while (s.fight && !s.fight.over) fightAction(s, 'attack');
  assert.equal(s.fight!.over, 'win');
  assert.equal(p.skill, 3); assert.equal(p.specialUses, 1);
  startNewDay(s);
  assert.equal(p.specialUses, 2);
});
t('Zwerge finden mehr Gold', () => {
  let dwarf = 0, human = 0;
  for (let i = 0; i < 300; i++) {
    for (const race of ['zwerg', 'mensch'] as const) {
      const s = newGame('X', 'dieb', 'm', race);
      const r = forestSearch(s, 'normal');
      if (r.type === 'fight') { if (race === 'zwerg') dwarf += s.fight!.goldReward; else human += s.fight!.goldReward; }
    }
  }
  assert.ok(dwarf > human * 1.1, `${dwarf} gegen ${human}`);
});
t('alte Spielstände: Klingenkunst wird Dunkle Künste, Rasse Mensch, Fähigkeitsstufe aus der Stufe', () => {
  const s = newGame('Alt', 'dunkel') as any;
  s.player.specialty = 'schleich'; delete s.player.race; delete s.player.skill; s.player.level = 7;
  const v = validate(JSON.parse(JSON.stringify(s)))!;
  assert.equal(v.player.specialty, 'dieb'); assert.equal(v.player.race, 'mensch'); assert.equal(v.player.skill, 6);
});
t('nach dem Drachen: Rasse und Fähigkeit neu, Fähigkeitsstufe wieder 0', () => {
  const s = newGame('X', 'dunkel', 'f', 'mensch');
  s.player.skill = 14; s.player.dragonKills = 1; s.pendingDragonBonus = true;
  chooseDragonBonus(s, 'atk', 'dieb', 'zwerg');
  assert.equal(s.player.race, 'zwerg'); assert.equal(s.player.specialty, 'dieb'); assert.equal(s.player.skill, 0); assert.equal(s.player.specialUses, 1);
  assert.ok(s.news.some((x) => x.includes('als Zwergin')));
});
console.log(`${n} Prüfungen bestanden`);
