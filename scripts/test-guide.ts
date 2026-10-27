// Prüft den Einstieg für Neulinge.
import assert from 'node:assert/strict';
import { GUIDE_STEPS, PLACE_UNLOCK } from '../src/content/guide';
import { maxHp } from '../src/game/balance';
import { bankDeposit, buyItem, heal, newGame, talkToFrieda } from '../src/game/engine';
import { guideFinished, guideUpdate, guideVisit, placeOpen, skipGuide } from '../src/game/guide';
import { exportCode, importCode } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Neuer Held hat die Einführung, Orte sind nach Stufe versteckt', () => {
  const s = newGame('Neu', 'dunkel');
  assert.ok(s.guide && s.guide.step === 0 && !s.guide.open);
  assert.equal(placeOpen(s, 'go:forest'), true);
  assert.equal(placeOpen(s, 'go:stable'), false);
  assert.equal(placeOpen(s, 'go:fields'), false);
  assert.deepEqual(guideUpdate(s), []);
});
t('Alte Spielstände ohne Einführung sehen alles', () => {
  const s = newGame('Alt', 'dunkel');
  delete s.guide;
  const back = importCode(exportCode(s))!;
  assert.equal(back.guide, null);
  for (const a of Object.keys(PLACE_UNLOCK)) assert.equal(placeOpen(back, a), true);
});
t('Schritte der Reihe nach, mit Belohnung', () => {
  const s = newGame('Neu', 'dunkel');
  const p = s.player;
  s.stats.kills = 1; p.hp = 5;
  const g0 = p.gold;
  let m = guideUpdate(s);
  assert.equal(m.length, 1); assert.equal(s.guide!.step, 1); assert.equal(p.gold, g0 + 25);
  p.gold = 500;
  heal(s, 'full');
  assert.equal(p.hp, maxHp(p));
  m = guideUpdate(s); assert.equal(s.guide!.step, 2); assert.ok(m[0].includes('Wunden'));
  buyItem(s, 'weapon', 1);
  guideUpdate(s); assert.equal(s.guide!.step, 3); assert.equal(p.gems, 1);
  bankDeposit(s, 100);
  guideUpdate(s); assert.equal(s.guide!.step, 4); assert.equal(p.bank, 120);
  talkToFrieda(s);           // Frieda vor dem Meister zählt erst, wenn der Schritt dran ist
  guideUpdate(s); assert.equal(s.guide!.step, 4);
  p.level = 2;
  m = guideUpdate(s);
  assert.equal(s.guide!.step, 6, 'Meister und (schon erledigt) Frieda in einem Rutsch');
  assert.ok(m.some((x) => x.startsWith('Neu in Moosgrund')), 'neue Orte gemeldet');
  assert.ok(s.guide!.fresh.includes('go:stable'));
  assert.equal(placeOpen(s, 'go:stable'), true);
  assert.equal(placeOpen(s, 'go:fields'), false);
  guideVisit(s, 'go:stable');
  assert.ok(!s.guide!.fresh.includes('go:stable'));
  assert.equal(s.guide!.step, GUIDE_STEPS.length);
  assert.equal(guideFinished(s.guide), false, 'Abschlusstext noch nicht gelesen');
});
t('Heilen zählt auch, wenn man schon gesund zu Mirla geht', () => {
  const s = newGame('Neu', 'dunkel');
  s.stats.kills = 1; guideUpdate(s);
  s.guide!.seen.push('healer');
  guideUpdate(s);
  assert.equal(s.guide!.step, 2);
});
t('Ab Stufe 3 ist alles offen', () => {
  const s = newGame('Neu', 'dunkel');
  s.player.level = 3;
  guideUpdate(s);
  assert.equal(s.guide!.open, true);
  for (const a of Object.keys(PLACE_UNLOCK)) assert.equal(placeOpen(s, a), true);
});
t('Überspringen zeigt alles und beendet die Aufgaben', () => {
  const s = newGame('Neu', 'dunkel');
  skipGuide(s);
  assert.equal(guideFinished(s.guide), true);
  assert.equal(placeOpen(s, 'go:dag'), true);
  s.stats.kills = 3;
  assert.deepEqual(guideUpdate(s), []);
});
t('Einführung übersteht Speichern und Laden', () => {
  const s = newGame('Neu', 'dunkel');
  s.guide!.seen.push('forest'); s.guide!.flags.push('heal');
  const back = importCode(exportCode(s))!;
  assert.deepEqual(back.guide, s.guide);
});

console.log(`${n} Prüfungen bestanden`);
