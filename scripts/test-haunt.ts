// Prüft Spuken auf der Spielseite.
import assert from 'node:assert/strict';
import { applyHaunt, HAUNT_FAVOR, newGame, startNewDay } from '../src/game/engine';
import { FOREST_FIGHTS_PER_DAY } from '../src/game/balance';
import { applyPvpEvents } from '../src/game/pvp';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('Geist: Gunst wird abgezogen, egal ob es klappt', () => {
  const s = newGame('Geist', 'dunkel');
  s.player.favor = 60;
  const ok1 = applyHaunt(s, { success: true, name: 'Bruno' });
  assert.equal(s.player.favor, 60 - HAUNT_FAVOR); assert.ok(ok1.t.includes('erfolgreich'));
  const no = applyHaunt(s, { success: false, name: 'Bruno' });
  assert.equal(s.player.favor, 60 - 2 * HAUNT_FAVOR); assert.ok(no.t.includes('Bruno'));
});
t('Opfer: verliert am nächsten Morgen 2 Waldkämpfe, danach nicht mehr', () => {
  const s = newGame('Bruno', 'mystik', 'm', 'elf');
  applyPvpEvents(s, [{ id: 1, kind: 'haunted', other_name: 'Geist', place: 'schattenreich', gold: 0, exp: 0, created_at: '' }]);
  assert.equal(s.player.hauntedBy, 'Geist');
  assert.ok(s.news.some((x) => x.includes('heimgesucht')));
  startNewDay(s);
  assert.equal(s.player.forestFights, FOREST_FIGHTS_PER_DAY - 2);
  assert.equal(s.player.hauntedBy, undefined);
  startNewDay(s);
  assert.equal(s.player.forestFights, FOREST_FIGHTS_PER_DAY);
});
console.log(`${n} Prüfungen bestanden`);
