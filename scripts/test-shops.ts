// Prüft Quirins Tränke und die Seherin.
import assert from 'node:assert/strict';
import { maxHp } from '../src/game/balance';
import { chooseDragonBonus, newGame, startNewDay } from '../src/game/engine';
import { chooseNewRace, chooseNewSpecialty, drinkPotion, HEAL_BONUS, paySeer, seerCost } from '../src/game/shops';
import { exportCode, importCode } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Tränke kosten 2 Edelsteine, ohne geht nichts', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gems = 1;
  const r = drinkPotion(s, 'charme');
  assert.equal(r.ok, false); assert.equal(s.player.gems, 1);
  s.player.gems = 4;
  const c = s.player.charm;
  assert.equal(drinkPotion(s, 'charme').ok, true);
  assert.equal(s.player.charm, c + 1); assert.equal(s.player.gems, 2);
});
t('Lebenstrank: +1 Lebenspunkt für immer, auch nach dem Drachen', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gems = 4;
  const before = maxHp(s.player);
  drinkPotion(s, 'leben'); drinkPotion(s, 'leben');
  assert.equal(maxHp(s.player), before + 2);
  s.pendingDragonBonus = true;
  chooseDragonBonus(s, 'atk');
  assert.equal(s.player.potionHp, 2);
  assert.equal(maxHp(s.player), 20 + 2);
  const back = importCode(exportCode(s))!;
  assert.equal(back.player.potionHp, 2);
});
t('Heiltrank: voll plus 20', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gems = 2; s.player.hp = 3;
  drinkPotion(s, 'heil');
  assert.equal(s.player.hp, maxHp(s.player) + HEAL_BONUS);
});
t('Vergessen: neue Fähigkeit, Punkte bleiben; erst wählen, dann wieder trinken', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gems = 6; s.player.skill = 4;
  drinkPotion(s, 'vergessen');
  assert.equal(s.player.pendingChoice, 'spec');
  assert.equal(drinkPotion(s, 'verwandlung').ok, false, 'erst entscheiden');
  assert.equal(s.player.gems, 4);
  assert.ok(chooseNewSpecialty(s, 'dieb').includes('Diebeskünste') || s.player.specialty === 'dieb');
  assert.equal(s.player.specialty, 'dieb'); assert.equal(s.player.skill, 4); assert.equal(s.player.pendingChoice, '');
});
t('Verwandlung: neue Rasse und Übelkeit für 10 Runden', () => {
  const s = newGame('Spieler', 'dunkel', 'f', 'mensch');
  s.player.gems = 2;
  drinkPotion(s, 'verwandlung');
  const msg = chooseNewRace(s, 'troll');
  assert.equal(s.player.race, 'troll'); assert.ok(msg.includes('eine Trollin'), msg);
  const b = s.player.buffs.find((x) => x.id === 'transmute');
  assert.ok(b && b.rounds === 10 && b.atkMult === 0.75 && b.defMult === 0.75);
  assert.equal(chooseNewRace(s, 'elf'), '', 'ohne Trank keine neue Wahl');
});
t('Seherin: Stufe × 20 Gold, gilt den ganzen Tag', () => {
  const s = newGame('Spieler', 'mystik');
  s.player.level = 3; s.player.gold = 50;
  assert.ok(paySeer(s)?.includes('60 Gold'));
  s.player.gold = 100;
  assert.equal(paySeer(s), null); assert.equal(s.player.gold, 100 - seerCost(3)); assert.ok(s.player.seerPaid);
  assert.equal(paySeer(s), null); assert.equal(s.player.gold, 40, 'zweimal zahlen nicht nötig');
  startNewDay(s);
  assert.equal(s.player.seerPaid, false);
});
console.log(`${n} Prüfungen bestanden`);
