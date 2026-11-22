// Prüft Ambros' Zahlenraten, den Steckbrief im Spielstand und das Wachsen der Gegner mit den Drachenpunkten.
import assert from 'node:assert/strict';
import { AMBROS_GAMES_PER_DAY, AMBROS_TRIES, ambrosBets, guessAmbros, startAmbros } from '../src/game/ambros';
import { fightAction as act, canChallengeMaster, newGame, rentRoom, startMasterFight, startNewDay, wakeUp } from '../src/game/engine';
import { sleepAtHome } from '../src/game/house';
import { dragonToughness, expNeeded, forestToughness, masterToughness, toughen } from '../src/game/balance';
import { exportCode, importCode } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Ambros: Einsatz wird abgezogen, Treffer zahlt doppelt', () => {
  const s = newGame('Spieler', 'dieb');
  s.player.gold = 100;
  const g = startAmbros(s, ambrosBets(1)[1]);
  assert.ok(typeof g !== 'string');
  assert.equal(s.player.gold, 90);
  guessAmbros(s, g, g.target);
  assert.equal(g.over, 'win'); assert.equal(s.player.gold, 110);
  guessAmbros(s, g, 1); assert.equal(g.tries, 1, 'nach dem Ende zählt nichts mehr');
});
t('Ambros: Hinweise stimmen, nach 6 Fehlversuchen verloren', () => {
  const s = newGame('Spieler', 'dieb');
  s.player.gold = 100;
  const g = startAmbros(s, 5) as Exclude<ReturnType<typeof startAmbros>, string>;
  const wrong = g.target === 1 ? 2 : 1;
  guessAmbros(s, g, wrong);
  assert.ok(g.hints[0].includes(wrong < g.target ? 'Höher' : 'Niedriger'));
  for (let i = 1; i < AMBROS_TRIES; i++) guessAmbros(s, g, wrong);
  assert.equal(g.over, 'lose'); assert.equal(s.player.gold, 95);
  assert.ok(g.hints.at(-1)!.includes(String(g.target)));
});
t('Ambros: mit Halbieren gewinnt man oft, aber nicht immer', () => {
  const s = newGame('Spieler', 'dieb');
  let wins = 0;
  for (let k = 0; k < 600; k++) {
    s.player.ambrosGames = 0; s.player.gold = 1000;
    const g = startAmbros(s, 5) as Exclude<ReturnType<typeof startAmbros>, string>;
    let lo = 1, hi = 100;
    while (!g.over) { const m = Math.floor((lo + hi) / 2); guessAmbros(s, g, m); if (m < g.target) lo = m + 1; else hi = m - 1; }
    if (g.over === 'win') wins++;
  }
  assert.ok(wins > 300 && wins < 480, `Gewinne ${wins}/600`);
});
t('Ambros: höchstens 3 Spiele pro Tag, kein Spiel ohne Gold, neuer Tag setzt zurück', () => {
  const s = newGame('Spieler', 'dieb');
  s.player.gold = 1;
  assert.equal(typeof startAmbros(s, 5), 'string');
  assert.equal(typeof startAmbros(s, 7), 'string');
  s.player.gold = 100;
  for (let i = 0; i < AMBROS_GAMES_PER_DAY; i++) assert.notEqual(typeof startAmbros(s, 5), 'string');
  assert.equal(typeof startAmbros(s, 5), 'string');
  startNewDay(s);
  assert.equal(s.player.ambrosGames, 0);
});
t('Steckbrief bleibt beim Export erhalten und wird auf 400 Zeichen gekürzt', () => {
  const s = newGame('Spieler', 'mystik');
  s.player.bio = 'Ich bin die Schrecken der Wälder.';
  const back = importCode(exportCode(s));
  assert.ok(back); assert.equal(back!.player.bio, s.player.bio);
  s.player.bio = 'x'.repeat(900);
  assert.equal(importCode(exportCode(s))!.player.bio!.length, 400);
});
t('Drachenpunkte: Gegner wachsen mit, Erfahrung pro Stufe steigt mit den Drachenkills', () => {
  const s = newGame('Spieler', 'dunkel');
  const p = s.player;
  assert.equal(forestToughness(p), 0); assert.equal(dragonToughness(p), 0);
  p.dragonKills = 8; p.bonusAtk = 4; p.bonusDef = 4; p.baseMaxHp += 0;
  assert.ok(forestToughness(p) >= 2 && masterToughness(p) >= forestToughness(p) && dragonToughness(p) > masterToughness(p));
  assert.ok(expNeeded(5, 8) > expNeeded(5, 0));
  assert.equal(expNeeded(5, 0), expNeeded(5));
  const r = toughen(10, (_a, b) => b);
  assert.equal(r.atk + r.def + r.hp / 5, 10);
});
t('Meister: nach einem Sieg mit voller Erfahrung gleich den nächsten fordern, nach einer Niederlage erst morgen', () => {
  const s = newGame('Held', 'dieb');
  const p = s.player;
  p.exp = 100000; p.hp = 100000; p.baseMaxHp = 100000;
  assert.ok(startMasterFight(s));
  for (let i = 0; i < 200 && !s.fight!.over; i++) { s.fight!.foe.hp = 1; act(s, 'attack'); }
  assert.equal(s.fight!.over, 'win');
  s.fight = null;
  assert.equal(p.level, 2);
  assert.equal(canChallengeMaster(p), 'ok', 'gleich den nächsten Meister');
  assert.ok(startMasterFight(s));
  act(s, 'flee');
  s.fight = null;
  assert.equal(canChallengeMaster(p), 'seen', 'nach Aufgeben erst morgen');
  startNewDay(s);
  assert.equal(canChallengeMaster(p), 'ok');
});
t('Schlafen: Zimmer bezahlt bis zum nächsten Spieltag, aufstehen hebt den Schutz auf', () => {
  const s = newGame('Held', 'dieb');
  const p = s.player;
  s.lastRealDate = '2026-11-22a'; p.gold = 1000; p.level = 3;
  rentRoom(s);
  assert.equal(p.innRoom, true); assert.equal(p.gold, 1000 - 40);
  assert.match(wakeUp(s) ?? '', /stehst auf/);
  assert.equal(p.innRoom, false);
  rentRoom(s);
  assert.equal(p.innRoom, true); assert.equal(p.gold, 960, 'wieder hinlegen kostet nichts');
  wakeUp(s);
  s.lastRealDate = '2026-11-22b';
  rentRoom(s);
  assert.equal(p.gold, 920, 'neuer Spieltag: neues Zimmer');
  assert.equal(wakeUp(s) !== null, true);
  assert.equal(wakeUp(s), null, 'wer wach ist, wacht nicht nochmal auf');
  p.house = { name: 'Haus', stage: 99, stageDay: '' };
  sleepAtHome(s);
  assert.equal(p.atHome, true);
  wakeUp(s);
  assert.equal(p.atHome, false);
});
console.log(`${n} Prüfungen bestanden`);
