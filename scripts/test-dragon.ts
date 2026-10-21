// Prüft den Neustart nach dem Drachenkill (wie im Original).
import assert from 'node:assert/strict';
import { chooseDragonBonus, newGame } from '../src/game/engine';
import { FOREST_FIGHTS_PER_DAY, maxHp } from '../src/game/balance';
import { titleFor } from '../src/content/titles';
import { validate } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

function killedDragon(dk: number, flawless = false) {
  const s = newGame('Hilda', 'klinge', 'f');
  const p = s.player;
  p.level = 15; p.exp = 99999; p.gold = 4000; p.bank = 12000; p.gems = 3; p.weaponTier = 14; p.armorTier = 14;
  p.dragonKills = dk; s.pendingDragonBonus = true; s.flawlessDragon = flawless;
  return s;
}

t('Titelleiter mit weiblichen Formen', () => {
  assert.equal(titleFor(0, 'm'), 'Bauernjunge');
  assert.equal(titleFor(0, 'f'), 'Bauernmädchen');
  assert.equal(titleFor(6, 'f'), 'Dame');
  assert.equal(titleFor(31, 'm'), 'Gott');
  assert.equal(titleFor(50, 'f'), 'Göttin');
});
t('erster Drachenkill: alles auf Anfang, Edelsteine bleiben, Kontor ist leer', () => {
  const s = killedDragon(1);
  const day = s.day;
  const r = chooseDragonBonus(s, 'ff', 'wurzel')!;
  const p = s.player;
  assert.equal(p.level, 1); assert.equal(p.exp, 0); assert.equal(p.weaponTier, 0); assert.equal(p.armorTier, 0);
  assert.equal(p.bank, 0); assert.equal(p.gold, 100); assert.equal(p.gems, 3);
  assert.equal(p.specialty, 'wurzel');
  assert.equal(p.bonusFights, 1);
  assert.equal(p.forestFights, FOREST_FIGHTS_PER_DAY + 1);
  assert.equal(p.hp, maxHp(p));
  assert.equal(p.charm, 5);
  assert.deepEqual(p.dragonPoints, ['ff']);
  assert.equal(s.day, day + 1);
  assert.equal(s.pendingDragonBonus, false);
  assert.equal(r.title, 'Pagin');
  assert.ok(s.news.some((x) => x.includes('Pagin Hilda')));
  assert.ok(s.outbox.some((x) => x.includes('Pagin')));
});
t('Startgold wächst bis 300, Edelsteine ab dem 8. Drachen', () => {
  const a = killedDragon(9); chooseDragonBonus(a, 'atk');
  assert.equal(a.player.gold, 300); assert.equal(a.player.gems, 3 + 2); assert.equal(a.player.bonusAtk, 1);
  const b = killedDragon(30); chooseDragonBonus(b, 'def');
  assert.equal(b.player.gems, 3 + 10); assert.equal(b.player.bonusDef, 1);
});
t('makelloser Sieg gibt 150 Gold und einen Edelstein extra', () => {
  const s = killedDragon(1, true); chooseDragonBonus(s, 'hp');
  assert.equal(s.player.gold, 250); assert.equal(s.player.gems, 4); assert.equal(s.player.baseMaxHp, 5);
});
t('ohne Drachenkill passiert nichts', () => {
  const s = newGame('Hagen', 'klinge');
  assert.equal(chooseDragonBonus(s, 'atk'), null);
  assert.equal(s.player.bonusAtk, 0);
});
t('alte Spielstände bekommen die neuen Felder', () => {
  const s = newGame('Alt', 'klinge') as any;
  delete s.player.bonusFights; delete s.player.charm; delete s.player.dragonPoints;
  const v = validate(JSON.parse(JSON.stringify(s)))!;
  assert.equal(v.player.bonusFights, 0); assert.equal(v.player.charm, 0); assert.deepEqual(v.player.dragonPoints, []);
});
console.log(`${n} Prüfungen bestanden`);
