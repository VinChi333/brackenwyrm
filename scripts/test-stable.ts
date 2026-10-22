// Prüft Mertens Pferdestall (Regeln wie im Original).
import assert from 'node:assert/strict';
import { chooseDragonBonus, newGame, startNewDay } from '../src/game/engine';
import { FOREST_FIGHTS_PER_DAY } from '../src/game/balance';
import { buyMount, feedMount, sellMount, tradeCost } from '../src/game/stable';
import { validate } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Pony kaufen: 6 Edelsteine, Angriffsbonus sofort, Waldkämpfe ab morgen', () => {
  const s = newGame('X', 'dieb', 'm', 'elf');
  s.player.gems = 7;
  buyMount(s, 'pony');
  assert.equal(s.player.mount, 'pony'); assert.equal(s.player.gems, 1);
  assert.ok(s.player.buffs.some((b) => b.id === 'mount' && b.atkMult === 1.2 && b.rounds === 30));
  startNewDay(s);
  assert.equal(s.player.forestFights, FOREST_FIGHTS_PER_DAY + 2);
  assert.ok(s.news.some((x) => x.includes('deinem Pony')));
});
t('zu wenig Edelsteine: kein Kauf', () => {
  const s = newGame('X', 'dieb');
  s.player.gems = 5;
  buyMount(s, 'pony');
  assert.equal(s.player.mount, ''); assert.equal(s.player.gems, 5);
});
t('Tausch rechnet zwei Drittel des alten Tiers an', () => {
  const s = newGame('X', 'dieb');
  s.player.gems = 6; buyMount(s, 'pony');
  assert.equal(tradeCost(s.player, 'hengst'), 16 - 4);
  s.player.gems = 12; buyMount(s, 'hengst');
  assert.equal(s.player.mount, 'hengst'); assert.equal(s.player.gems, 0);
  assert.equal(tradeCost(s.player, 'pony'), 6 - 11, 'zurück zum Pony bringt Edelsteine');
});
t('Verkaufen bringt zwei Drittel zurück und nimmt den Bonus weg', () => {
  const s = newGame('X', 'dieb');
  s.player.gems = 10; buyMount(s, 'wallach');
  sellMount(s);
  assert.equal(s.player.mount, ''); assert.equal(s.player.gems, 7);
  assert.ok(!s.player.buffs.some((b) => b.id === 'mount'));
});
t('Füttern: satt = nichts, halb satt = halber Preis, einmal pro Tag', () => {
  const s = newGame('X', 'dieb');
  s.player.gems = 6; s.player.gold = 1000; s.player.level = 3; buyMount(s, 'pony');
  assert.equal(feedMount(s).ok, false, 'voll: frisst nicht');
  s.player.buffs.find((b) => b.id === 'mount')!.rounds = 20;
  const r = feedMount(s);
  assert.ok(r.ok); assert.equal(s.player.gold, 1000 - 30, 'halber Preis: 3 × 20 / 2');
  s.player.buffs.find((b) => b.id === 'mount')!.rounds = 1;
  assert.equal(feedMount(s).ok, false, 'heute schon gefüttert');
});
t('Reittier bleibt nach dem Drachen', () => {
  const s = newGame('X', 'dieb');
  s.player.gems = 16; buyMount(s, 'hengst');
  s.player.dragonKills = 1; s.pendingDragonBonus = true;
  chooseDragonBonus(s, 'ff');
  assert.equal(s.player.mount, 'hengst');
  assert.equal(s.player.forestFights, FOREST_FIGHTS_PER_DAY + 1 + 1 + 6);
  assert.ok(s.player.buffs.some((b) => b.id === 'mount'));
});
t('alte Spielstände ohne Reittier', () => {
  const s = newGame('X', 'dieb') as any;
  delete s.player.mount; delete s.player.mountFed;
  const v = validate(JSON.parse(JSON.stringify(s)))!;
  assert.equal(v.player.mount, ''); assert.equal(v.player.mountFed, false);
});
console.log(`${n} Prüfungen bestanden`);
