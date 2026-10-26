// Prüft alle Waldereignisse: laufen ohne Fehler, halten Werte im gültigen Bereich, Tod wird richtig verbucht.
import assert from 'node:assert/strict';
import { FOREST_EVENTS } from '../src/content/events';
import { announce, newGame, resolveEvent } from '../src/game/engine';
import { maxHp } from '../src/game/balance';
import { seedRng } from '../src/game/rng';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
seedRng(5);

t(`alle ${FOREST_EVENTS.length} Ereignisse laufen mit jeder Wahl ohne Fehler`, () => {
  for (const ev of FOREST_EVENTS) {
    for (let i = 0; i < 60; i++) {
      const s = newGame('X', 'dieb', i % 2 ? 'f' : 'm', i % 3 ? 'zwerg' : 'mensch');
      const p = s.player;
      p.level = 1 + (i % 15); p.gold = i * 37; p.gems = i % 4; p.hp = maxHp(p); p.charm = i % 5;
      const ctx = { s, announce: (x: string) => announce(s, x) as void, data: undefined as number | undefined };
      if (ev.run) ev.run(p, ctx);
      if (ev.prompt && ev.choices) {
        const lines = ev.prompt(p, ctx);
        assert.ok(lines.length > 0);
        for (const c of ev.choices) {
          const s2 = structuredClone(s);
          if (c.available && !c.available(s2.player)) continue;
          const out = c.run(s2.player, { s: s2, announce: (x) => announce(s2, x), data: ctx.data });
          assert.ok(out.length > 0 || !!s2.pendingEvent, `${ev.id}/${c.id} ohne Text`);
          const q = s2.player;
          assert.ok(q.gold >= 0 && q.gems >= 0 && q.forestFights >= 0 && q.charm >= 0, `${ev.id}/${c.id}: negative Werte`);
          assert.ok(!q.alive || q.hp >= 1, `${ev.id}/${c.id}: lebt mit 0 LP`);
        }
      }
    }
  }
});
t('tödliches Ereignis: Tod wird verbucht, Text landet in den Neuigkeiten', () => {
  let died = false;
  for (let i = 0; i < 400 && !died; i++) {
    const s = newGame('X', 'dieb');
    s.player.forestFights = 5;
    s.pendingEvent = { id: 'leuchtbach', lines: [] };
    resolveEvent(s, 'trinken');
    if (!s.player.alive) {
      died = true;
      assert.equal(s.stats.deaths, 1); assert.equal(s.player.hp, 0); assert.equal(s.pendingEvent, null);
      assert.ok(s.news.some((x) => x.includes('Schädel')));
    }
  }
  assert.ok(died, 'in 400 Schlucken nie gestorben?');
});
t('Rätsel merkt sich die Frage bis zur Antwort', () => {
  const ev = FOREST_EVENTS.find((e) => e.id === 'raetsel')!;
  let right = 0;
  for (let i = 0; i < 60; i++) {
    const s = newGame('X', 'dieb');
    const ctx = { s, announce: () => {}, data: undefined as number | undefined };
    const lines = ev.prompt!(s.player, ctx);
    s.pendingEvent = { id: 'raetsel', lines, data: ctx.data };
    assert.equal(typeof ctx.data, 'number');
    const out = resolveEvent(s, 'a').map((l) => l.t).join(' ');
    assert.ok(/Richtig|Falsch/.test(out));
    if (out.includes('Richtig')) right++;
  }
  assert.ok(right > 0 && right < 60, `Antwort A mal richtig, mal falsch (${right}/60)`);
});
console.log(`${n} Prüfungen bestanden`);
