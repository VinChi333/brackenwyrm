// Prüft Flirten und Heiraten im Gasthaus (Regeln wie im Original).
import assert from 'node:assert/strict';
import { showNews } from '../src/i18n/news';
import { announce, newGame, startNewDay } from '../src/game/engine';
import { flirt, partnerOf, visitSpouse, askLooks, MARRY_CHARM } from '../src/game/lovers';
import { seedRng } from '../src/game/rng';
import { validate } from '../src/game/storage';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
seedRng(7);

t('Helden umwerben Frieda, Heldinnen Florian, umstellbar', () => {
  assert.equal(partnerOf(newGame('Hagen', 'dunkel', 'm').player), 'frieda');
  const s = newGame('Hilda', 'dunkel', 'f');
  assert.equal(partnerOf(s.player), 'florian');
  s.player.loverPref = 'frieda';
  assert.equal(partnerOf(s.player), 'frieda');
});
t('mit genug Charme klappt jeder Versuch sicher und gibt Charme bis zur Obergrenze', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.charm = 3;
  const r = flirt(s, 0, announce);           // Zwinkern: Schwelle 2, Obergrenze 4
  assert.equal(r.kind, 'good'); assert.equal(s.player.charm, 4);
  s.player.seenLover = false;
  flirt(s, 0, announce);
  assert.equal(s.player.charm, 4, 'über der Obergrenze kein Zuwachs mehr');
});
t('nur ein Flirt pro Tag, neuer Tag setzt zurück', () => {
  const s = newGame('Hagen', 'dunkel');
  flirt(s, 0, announce);
  const before = s.player.charm;
  const r = flirt(s, 0, announce);
  assert.equal(r.kind, 'info'); assert.equal(s.player.charm, before);
  startNewDay(s);
  assert.equal(s.player.seenLover, false);
});
t('Treppe hinauf: kostet 2 Waldkämpfe und landet in den Neuigkeiten', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.charm = 20; s.player.forestFights = 10;
  flirt(s, 5, announce);
  assert.equal(s.player.forestFights, 8); assert.equal(s.player.charm, 21);
  assert.ok(s.outbox.some((x) => showNews(x).includes('Treppe')));
});
t('grober Fehlversuch kostet Charme', () => {
  let lost = false;
  for (let i = 0; i < 30 && !lost; i++) {
    const s = newGame('Hagen', 'dunkel');
    s.player.charm = 5;
    flirt(s, 3, announce);                   // Schoß: Schwelle 11, Verlust unter 10
    if (s.player.charm === 4) lost = true;
  }
  assert.ok(lost);
});
t('Antrag ohne genug Charme: Nein und keine Waldkämpfe mehr', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.charm = MARRY_CHARM - 1; s.player.forestFights = 12;
  const r = flirt(s, 6, announce);
  assert.equal(r.kind, 'bad'); assert.equal(s.player.forestFights, 0); assert.equal(s.player.marriedTo, '');
});
t('Antrag mit 22 Charme: Hochzeit, Schutz im Kampf, Neuigkeit', () => {
  const s = newGame('Hilda', 'dunkel', 'f');
  s.player.charm = MARRY_CHARM;
  flirt(s, 6, announce);
  assert.equal(s.player.marriedTo, 'florian');
  assert.ok(s.player.buffs.some((b) => b.defMult === 1.2 && b.rounds === 60));
  assert.ok(s.outbox.some((x) => showNews(x).includes('geheiratet')));
  const other = { ...s }; other.player.loverPref = 'frieda'; other.player.seenLover = false;
  assert.equal(flirt(other, 0, announce).kind, 'info', 'verheiratet flirtet man nicht mit anderen');
});
t('Verheiratete verlieren täglich Charme und werden bei 0 verlassen', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.marriedTo = 'frieda'; s.player.charm = 1;
  startNewDay(s);
  assert.equal(s.player.marriedTo, ''); assert.equal(s.player.charm, 0);
  assert.ok(s.news.some((x) => x.includes('Zettel')));
  assert.ok(s.outbox.some((x) => showNews(x).includes('anderen Interessen')));
});
t('Zeit mit dem Ehepartner: meist Schutz und Charme, einmal pro Tag', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.marriedTo = 'frieda'; s.player.charm = 30;
  const r = visitSpouse(s);
  assert.ok(r.kind === 'good' || r.kind === 'bad');
  assert.equal(visitSpouse(s).kind, 'info');
});
t('Aussehen erfragen nennt den Freund und eine Einschätzung', () => {
  const s = newGame('Hagen', 'dunkel');
  s.player.charm = 20;
  assert.match(askLooks(s.player), /^Florian mustert dich/);
});
t('Ehe und Charme bleiben nach dem Drachen, alte Stände bekommen die Felder', () => {
  const s = newGame('Alt', 'dunkel') as any;
  delete s.player.marriedTo; delete s.player.seenLover; s.player.loverPref = 'quatsch';
  const v = validate(JSON.parse(JSON.stringify(s)))!;
  assert.equal(v.player.marriedTo, ''); assert.equal(v.player.seenLover, false); assert.equal(v.player.loverPref, undefined);
});
console.log(`${n} Prüfungen bestanden`);
