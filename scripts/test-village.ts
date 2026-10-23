// Prüft Ambros' Zahlenraten, den Steckbrief im Spielstand und das Wachsen der Gegner mit den Drachenpunkten.
import assert from 'node:assert/strict';
import { AMBROS_GAMES_PER_DAY, AMBROS_TRIES, ambrosBets, guessAmbros, startAmbros } from '../src/game/ambros';
import { newGame, startNewDay } from '../src/game/engine';
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
console.log(`${n} Prüfungen bestanden`);
