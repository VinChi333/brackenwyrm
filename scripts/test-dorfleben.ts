// Prüft Tresen, Kredit und Söldnerlager (0.40).
import assert from 'node:assert/strict';
import { maxHp } from '../src/game/balance';
import {
  bankBorrow, bankDeposit, bankWithdraw, closeFight, companionCost, companionMaxHp, dismissCompanion, fightAction, forestSearch,
  healCompanion, hireCompanion, LOAN_PER_LEVEL, newGame, startMasterFight, startNewDay,
} from '../src/game/engine';
import { seedRng } from '../src/game/rng';
import { exportCode, importCode } from '../src/game/storage';
import { MAX_DRUNK, orderDrink, slur } from '../src/game/tavern';
import type { GameState } from '../src/game/types';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Tresen: Rausch steigt, ab 66 gibt es nichts mehr, Wasser macht nüchtern', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gold = 10000;
  assert.equal(orderDrink(s, 'harzbier').ok, true);
  assert.equal(s.player.drunk, 25);
  assert.ok(s.player.buffs.some((b) => b.id === 'drink'));
  orderDrink(s, 'moosmet'); orderDrink(s, 'kraeuterschnaps');
  assert.ok((s.player.drunk ?? 0) >= MAX_DRUNK);
  const gold = s.player.gold;
  assert.equal(orderDrink(s, 'harzbier').ok, false);
  assert.equal(s.player.gold, gold);
  assert.equal(orderDrink(s, 'quellwasser').ok, true);
  assert.equal(s.player.drunk, 75 - 35);
  assert.equal(s.player.buffs.filter((b) => b.id === 'drink').length, 1, 'nur ein Getränke-Effekt');
});
t('Tresen: höchstens zwei harte Getränke, Kater am nächsten Morgen', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gold = 10000;
  assert.equal(orderDrink(s, 'drachenfeuer').ok, true);
  orderDrink(s, 'quellwasser'); orderDrink(s, 'quellwasser');
  assert.equal(orderDrink(s, 'drachenfeuer').ok, true);
  orderDrink(s, 'quellwasser'); orderDrink(s, 'quellwasser');
  assert.equal(orderDrink(s, 'drachenfeuer').ok, false);
  s.player.drunk = 80;
  startNewDay(s);
  assert.equal(s.player.drunk, 0);
  assert.equal(s.player.hardDrinks, 0);
  assert.ok(s.news.some((x) => x.includes('Kater')));
});
t('Lallen verändert den Text, nüchtern bleibt er gleich', () => {
  seedRng(5);
  assert.equal(slur('Hallo zusammen', 0), 'Hallo zusammen');
  const x = slur('Hallo zusammen, wie geht es euch allen heute?', 60);
  assert.notEqual(x, 'Hallo zusammen, wie geht es euch allen heute?');
  assert.ok(x.length <= 200);
});
t('Kredit: bis 20 Gold je Stufe, Zinsen über Nacht, Einzahlen tilgt', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.level = 3; s.player.gold = 0;
  bankBorrow(s, 1000);
  assert.equal(s.player.bank, -3 * LOAN_PER_LEVEL);
  assert.equal(s.player.gold, 60);
  bankBorrow(s, 10);
  assert.equal(s.player.bank, -60, 'nicht mehr als die Grenze');
  assert.equal(bankWithdraw(s, 10), 'Dein Konto ist leer.');
  startNewDay(s);
  assert.ok(s.player.bank < -60, 'Zinsen auf Schulden');
  s.player.gold = 1000;
  bankDeposit(s, 1000);
  assert.ok(s.player.bank > 0);
  assert.equal(bankBorrow(s, 5).startsWith('Du hast noch Gold'), true);
});
t('Söldner: anheuern kostet Gold, nur einer, heilen, entlassen', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.level = 4; s.player.gold = companionCost('schild', 4) - 1;
  assert.equal(hireCompanion(s, 'schild').ok, false);
  s.player.gold += 1000;
  assert.equal(hireCompanion(s, 'schild').ok, true);
  assert.equal(s.player.companion?.maxHp, companionMaxHp('schild', 4));
  assert.equal(hireCompanion(s, 'kaempfer').ok, false);
  s.player.companion!.hp = 1;
  const g = s.player.gold;
  assert.equal(healCompanion(s).ok, true);
  assert.equal(s.player.gold, g - (companionMaxHp('schild', 4) - 1));
  dismissCompanion(s);
  assert.equal(s.player.companion, null);
  const back = importCode(exportCode(s));
  assert.equal(back?.player.companion, null);
});

function fightUntilEnd(s: GameState): void {
  for (let i = 0; i < 400 && s.fight && !s.fight.over; i++) fightAction(s, 'attack');
}
function forestWins(withComp: 'kaempfer' | 'heilerin' | 'schild' | null, seed: number): number {
  seedRng(seed);
  let wins = 0;
  for (let k = 0; k < 300; k++) {
    const s = newGame('Spieler', 'dunkel');
    s.player.level = 6; s.player.weaponTier = 3; s.player.armorTier = 3;
    s.player.hp = maxHp(s.player); s.player.forestFights = 5;
    if (withComp) { s.player.gold = 10000; hireCompanion(s, withComp); }
    for (let tries = 0; tries < 10 && !s.fight; tries++) { forestSearch(s, 'hard'); if (s.pendingEvent) s.pendingEvent = null; }
    if (!s.fight) continue;
    fightUntilEnd(s);
    if (s.fight.over === 'win') wins++;
  }
  return wins;
}
t('Söldner helfen im Wald spürbar, aber nicht übermächtig', () => {
  const alone = forestWins(null, 11);
  const res = { kaempfer: forestWins('kaempfer', 11), heilerin: forestWins('heilerin', 11), schild: forestWins('schild', 11) };
  console.log('   Siege von 300 (Stufe 6, schwer):', { alone, ...res });
  for (const v of Object.values(res)) assert.ok(v >= alone, 'Begleiter macht es nicht schlechter');
});
t('Söldner: kein Mitkämpfen beim Meister, k. o. erholt sich über Nacht, nach dem Drachen weg', () => {
  const s = newGame('Spieler', 'dunkel');
  s.player.gold = 10000;
  hireCompanion(s, 'kaempfer');
  s.player.exp = 100000;
  assert.equal(startMasterFight(s), true);
  const hp = s.player.companion!.hp;
  fightUntilEnd(s);
  assert.ok(!s.fight!.log.some((l) => l.t.includes('Rauf')), 'Rauf schweigt beim Meister');
  assert.equal(s.player.companion!.hp, hp);
  closeFight(s);
  s.player.companion!.hp = 0;
  startNewDay(s);
  assert.equal(s.player.companion!.hp, Math.ceil(s.player.companion!.maxHp / 2));
});

console.log(`${n} Prüfungen bestanden`);
