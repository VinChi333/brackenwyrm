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
      assert.ok(s.news.some((x) => x.includes('Spiegelbild')));
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
// ---------- Neue Ereignisse (0.58) ----------
const ev = (id: string) => FOREST_EVENTS.find((e) => e.id === id)!;
const ctxOf = (s: ReturnType<typeof newGame>) => ({ s, announce: (x: string) => announce(s, x) as void, data: undefined as number | undefined });
const choose = (s: ReturnType<typeof newGame>, id: string, choice: string) => {
  const e = ev(id);
  const ctx = ctxOf(s);
  s.pendingEvent = { id, lines: e.prompt!(s.player, ctx), data: ctx.data };
  return resolveEvent(s, choice).map((l) => l.t).join(' ');
};
t('IDs und Tasten: eindeutig, jede Wahl hat eine eigene Taste', () => {
  const ids = FOREST_EVENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte Ereignis-ID');
  for (const e of FOREST_EVENTS) {
    if (!e.choices) continue;
    const keys = e.choices.map((c) => c.key);
    assert.equal(new Set(keys).size, keys.length, `${e.id}: doppelte Taste`);
    assert.equal(new Set(e.choices.map((c) => c.id)).size, e.choices.length, `${e.id}: doppelte Wahl`);
  }
});
t('Zwerg im Wald: zahlt für Edelsteine, Zwerge bekommen mehr', () => {
  const s = newGame('X', 'dieb', 'm', 'mensch'); s.player.level = 5; s.player.gems = 2; s.player.gold = 0;
  choose(s, 'zwergenhaendler', 'verkaufen');
  const human = s.player.gold;
  assert.equal(s.player.gems, 1); assert.ok(human > 0);
  const z = newGame('X', 'dieb', 'm', 'zwerg'); z.player.level = 5; z.player.gems = 1; z.player.gold = 0;
  choose(z, 'zwergenhaendler', 'verkaufen');
  assert.ok(z.player.gold > human, 'Zwerg bekommt mehr');
  const none = newGame('X', 'dieb'); none.player.gems = 0;
  assert.match(choose(none, 'zwergenhaendler', 'verkaufen'), /geht gerade nicht/);
});
t('Nymphe: nur die ehrliche Antwort bringt einen Edelstein', () => {
  for (const [c, gem] of [['ehrlich', 1], ['gold', 0], ['silber', 0]] as const) {
    const s = newGame('X', 'dieb'); s.player.gems = 0; s.player.gold = 100;
    choose(s, 'nymphe', c);
    assert.equal(s.player.gems, gem, c);
    if (!gem) assert.equal(s.player.gold, 90, `${c}: 10 % Gold weg`);
  }
});
t('Nussschalen: Einsatz verloren oder dreifach zurück, im Schnitt kein Gewinn für Nicht-Diebe', () => {
  let total = 0;
  for (let i = 0; i < 3000; i++) {
    const s = newGame('X', 'mystik'); s.player.level = 1; s.player.gold = 10;
    choose(s, 'nussschalen', ['links', 'mitte', 'rechts'][i % 3]);
    assert.ok(s.player.gold === 0 || s.player.gold === 30);
    total += s.player.gold - 10;
  }
  assert.ok(Math.abs(total / 3000) < 1.5, `Erwartung nahe 0 (${(total / 3000).toFixed(2)})`);
});
t('Rasse und Fähigkeit zählen: Elf, Troll, Dieb, Reittier', () => {
  const elf = newGame('X', 'mystik', 'f', 'elf'); elf.player.forestFights = 5;
  ev('wegweiser').run!(elf.player, ctxOf(elf)); assert.equal(elf.player.forestFights, 5);
  const men = newGame('X', 'mystik', 'f', 'mensch'); men.player.forestFights = 5;
  ev('wegweiser').run!(men.player, ctxOf(men)); assert.equal(men.player.forestFights, 4);
  const troll = newGame('X', 'mystik', 'm', 'troll'); troll.player.forestFights = 5;
  choose(troll, 'holzfaeller', 'helfen'); assert.equal(troll.player.forestFights, 5);
  const zw = newGame('X', 'mystik', 'm', 'zwerg'); zw.player.forestFights = 5;
  choose(zw, 'holzfaeller', 'helfen'); assert.equal(zw.player.forestFights, 4);
  const dieb = newGame('X', 'dieb'); dieb.player.forestFights = 5; dieb.player.gold = 0;
  ev('fallgrube').run!(dieb.player, ctxOf(dieb)); assert.equal(dieb.player.forestFights, 5); assert.ok(dieb.player.gold > 0);
  const rider = newGame('X', 'dieb'); rider.player.mount = 'pony'; const hp = rider.player.hp;
  ev('wildschweine').run!(rider.player, ctxOf(rider)); assert.equal(rider.player.hp, hp);
});
t('Verirrtes Kind: kostet 2 Waldkämpfe, bringt Charme und eine Neuigkeit', () => {
  const s = newGame('Hilde', 'dieb'); s.player.forestFights = 5; const c = s.player.charm;
  choose(s, 'verirrtes_kind', 'heim');
  assert.equal(s.player.forestFights, 3); assert.equal(s.player.charm, c + 1);
  assert.ok(s.outbox.some((x) => x.includes('lostChild')), 'Neuigkeit fürs Dorf');
});
t('Bettlerin und Ritter: Gunst bei Morwen', () => {
  const s = newGame('X', 'dieb'); s.player.gold = 100; s.player.favor = 0;
  choose(s, 'bettlerin', 'geben'); assert.equal(s.player.favor, 10);
  choose(s, 'ruestung', 'begraben'); assert.equal(s.player.favor, 15);
});
console.log(`${n} Prüfungen bestanden`);
