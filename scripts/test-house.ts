// Häuser im Wohnviertel und die Rabenklippe. Aufruf: npx tsx scripts/test-house.ts
import assert from 'node:assert/strict';
import { maxHp } from '../src/game/balance';
import { chooseDragonBonus, jumpCliff, newGame, rentRoom, resurrect, RESURRECT_FAVOR, startNewDay } from '../src/game/engine';
import { HOUSE_STAGES, PLOT_COST, buildStage, buyPlot, canBuild, houseDone, sleepAtHome } from '../src/game/house';
import { exportCode, importCode } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
const rich = () => { const s = newGame('Bauherrin', 'dunkel', 'f'); s.player.gold = 20000; s.player.gems = 20; s.player.level = 12; return s; };

t('Bauplatz: kostet Gold und braucht einen Namen', () => {
  const s = newGame('Arm', 'dunkel');
  s.player.gold = 100;
  assert.match(buyPlot(s, 'Hütte')!, /Bauplatz kostet/);
  s.player.gold = PLOT_COST;
  assert.match(buyPlot(s, ' ')!, /heißen/);
  assert.equal(buyPlot(s, '  Zum   Moosigel  '), null);
  assert.equal(s.player.house!.name, 'Zum Moosigel');
  assert.equal(s.player.gold, 0);
  assert.match(buyPlot(s, 'Noch eins')!, /schon einen Bauplatz/);
});

t('Bauen: eine Stufe pro Spieltag, fehlendes Gold kommt aus dem Kontor', () => {
  const s = rich();
  s.player.gold = 1000; s.player.bank = 20000;
  buyPlot(s, 'Rabenhorst');
  const r = buildStage(s, 'T1');
  assert.ok(r.ok);
  assert.equal(s.player.gold, 0, 'erst der Beutel');
  assert.equal(s.player.bank, 20000 - (HOUSE_STAGES[0].gold - (1000 - PLOT_COST)), 'dann das Kontor');
  assert.equal(canBuild(s, 'T1'), 'today');
  const again = buildStage(s, 'T1');
  assert.ok(!again.ok && /Mörtel/.test(again.why));
  assert.ok(buildStage(s, 'T2').ok);
  assert.ok(buildStage(s, 'T3').ok);
  assert.equal(houseDone(s.player.house), false);
  const last = buildStage(s, 'T4');
  assert.ok(last.ok && last.done);
  assert.equal(houseDone(s.player.house), true);
  const total = HOUSE_STAGES.reduce((a, x) => a + x.gold, 0) + PLOT_COST;
  assert.equal(s.player.gold + s.player.bank, 21000 - total);
  assert.equal(s.player.gems, 20 - HOUSE_STAGES.reduce((a, x) => a + x.gems, 0));
  assert.equal(canBuild(s, 'T5'), 'done');
});

t('Bauen: ohne Edelsteine geht es nicht weiter', () => {
  const s = rich();
  s.player.gems = 0;
  buyPlot(s, 'Leer');
  assert.equal(canBuild(s, 'T1'), 'gems');
  assert.ok(!buildStage(s, 'T1').ok);
  assert.equal(s.player.house!.stage, 0);
});

t('Daheim schlafen: sicher, kostenlos, morgens ausgeschlafen; Gasthaus hebt es auf', () => {
  const s = rich();
  buyPlot(s, 'Daheim');
  assert.match(sleepAtHome(s)!, /noch nicht fertig/);
  for (const d of ['a', 'b', 'c', 'd']) buildStage(s, d);
  rentRoom(s);
  assert.equal(s.player.innRoom, true);
  assert.match(sleepAtHome(s)!, /Friedas Zimmer/);
  assert.equal(s.player.innRoom, false);
  assert.equal(s.player.atHome, true);
  startNewDay(s);
  assert.equal(s.player.atHome, false);
  assert.ok(s.player.buffs.some((b) => b.id === 'home'), 'Ausgeschlafen');
  assert.ok(s.news.some((x) => x.includes('eigenen Bett')));
  startNewDay(s);
  assert.ok(!s.player.buffs.some((b) => b.id === 'home'), 'ohne Nacht daheim kein Bonus');
  sleepAtHome(s); rentRoom(s);
  assert.equal(s.player.atHome, false, 'wer ein Zimmer nimmt, schläft nicht daheim');
});

t('Haus übersteht den Drachen und den Export', () => {
  const s = rich();
  buyPlot(s, 'Wyrmfest');
  for (const d of ['a', 'b', 'c', 'd']) buildStage(s, d);
  s.player.dragonKills = 1; s.pendingDragonBonus = true;
  chooseDragonBonus(s, 'hp');
  assert.equal(s.player.gold, 100, 'Gold weg wie im Original');
  assert.equal(s.player.bank, 0);
  assert.equal(houseDone(s.player.house), true, 'das Haus bleibt');
  const back = importCode(exportCode(s));
  assert.ok(back && houseDone(back.player.house));
});

t('Rabenklippe: Beutelgold weg, Erfahrung bleibt, Rückkehr ohne neue Waldkämpfe', () => {
  const s = newGame('Springer', 'dunkel');
  const p = s.player;
  p.gold = 300; p.bank = 500; p.exp = 400; p.forestFights = 3;
  assert.equal(jumpCliff(s), null);
  assert.equal(p.alive, false);
  assert.equal(p.gold, 0);
  assert.equal(p.bank, 500);
  assert.equal(p.exp, 400);
  assert.ok(s.outbox.some((x) => x.startsWith('§cliffJump|Springer')));
  assert.match(jumpCliff(s)!, /schon tot/);
  p.favor = RESURRECT_FAVOR;
  const msg = resurrect(s);
  assert.match(msg, /keinen Rabatt/);
  assert.equal(p.alive, true);
  assert.equal(p.forestFights, 3, 'nur die alten Waldkämpfe');
  assert.equal(p.hp, maxHp(p));
  // Ein normaler Tod bringt dagegen 40 % zurück
  p.alive = false; p.favor = RESURRECT_FAVOR; p.forestFights = 0;
  resurrect(s);
  assert.ok(p.forestFights > 0);
});

t('Rabenklippe: über Nacht holt Morwen dich ganz normal zurück', () => {
  const s = newGame('Springer', 'dunkel');
  jumpCliff(s);
  startNewDay(s);
  assert.equal(s.player.alive, true);
  assert.equal(s.player.jumped, false);
  assert.ok(s.player.forestFights >= 10);
});

console.log(`${n} Prüfungen bestanden`);
