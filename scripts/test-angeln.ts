// Prüft das Angeln am Steg: Würfe pro Tag, Anschlagen (zu früh, zu spät, richtig), Drill, Rasse-Vorteile,
// Morgen- und Abendfische, Fangbuch, Verkaufen und Braten, und dass sich Angeln lohnt, aber den Wald nicht ersetzt.
import assert from 'node:assert/strict';
import { CASTS_PER_DAY, catchTable, castsLeft, drillMove, fishPrice, fishHeal, fryFish, sellFish, startCast, strike, type Cast } from '../src/game/angeln';
import { CURIOS, FISH, LEGEND } from '../src/content/fische';
import { newGame, startNewDay } from '../src/game/engine';
import { goldPerKill, maxHp } from '../src/game/balance';
import { seedRng } from '../src/game/rng';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };
seedRng(11);

const game = (race: 'mensch' | 'elf' | 'troll' | 'zwerg' = 'mensch', part: 'a' | 'b' = 'a') => {
  const s = newGame('X', 'dieb', 'm', race);
  s.lastRealDate = `2026-11-04${part}`;
  return s;
};
const cast = (s: ReturnType<typeof game>) => { const c = startCast(s); assert.ok(typeof c !== 'string'); return c as Cast; };

t(`${CASTS_PER_DAY} Würfe pro Spieltag, am neuen Spieltag wieder voll`, () => {
  const s = game();
  for (let i = 0; i < CASTS_PER_DAY; i++) cast(s);
  assert.equal(castsLeft(s), 0);
  assert.equal(typeof startCast(s), 'string');
  startNewDay(s);
  assert.equal(castsLeft(s), CASTS_PER_DAY);
});
t('zu früh anschlagen: leerer Haken (auch wenn der Schwimmer nur gezuckt hat)', () => {
  const s = game();
  const c = cast(s);
  strike(s, c, c.biteAt - 1);
  assert.equal(c.stage, 'lost');
});
t('zu spät anschlagen: Köder weg', () => {
  const s = game();
  const c = cast(s);
  strike(s, c, c.biteAt + c.window + 1);
  assert.equal(c.stage, 'lost');
});
t('Elfen haben mehr Zeit zum Anschlagen', () => {
  assert.ok(cast(game('elf')).window > cast(game('mensch')).window);
});
t('Zuckungen kommen immer vor dem Biss', () => {
  for (let i = 0; i < 300; i++) {
    const s = game(); const c = cast(s);
    assert.ok(c.twitches.every((x) => x < c.biteAt - 300), 'Zucken zu knapp vor dem Biss');
  }
});
const hook = (race: 'mensch' | 'troll' = 'mensch', want?: (c: Cast) => boolean) => {
  for (let i = 0; i < 3000; i++) {
    const s = game(race); const c = cast(s);
    if (want && !want(c)) continue;
    strike(s, c, c.biteAt + 100);
    return { s, c };
  }
  throw new Error('kein passender Wurf');
};
t('richtig anschlagen: kleiner Fisch sofort gefangen und im Fangbuch', () => {
  const { s, c } = hook('mensch', (x) => FISH.some((f) => f.id === x.catchId && f.size === 's'));
  assert.equal(c.stage, 'caught');
  assert.equal(s.fishbook![c.catchId].n, 1);
  assert.equal(s.fishbook![c.catchId].max, c.weight);
});
t('Drill: richtig reagieren fängt den Fisch, falsch reagieren reißt die Schnur', () => {
  const big = (x: Cast) => x.drill.length >= 2 && x.catchId !== LEGEND.id;
  const a = hook('mensch', big);
  assert.equal(a.c.stage, 'drill');
  while (a.c.stage === 'drill') drillMove(a.s, a.c, a.c.drill[a.c.drillPos] === 'pull' ? 'nachgeben' : 'einholen');
  assert.equal(a.c.stage, 'caught');
  const b = hook('mensch', big);
  drillMove(b.s, b.c, b.c.drill[0] === 'pull' ? 'einholen' : 'nachgeben');
  assert.equal(b.c.stage, 'lost');
});
t('Trollen verzeiht die Schnur einen Fehler', () => {
  const { s, c } = hook('troll', (x) => x.drill.length >= 2 && x.catchId !== LEGEND.id);
  drillMove(s, c, c.drill[0] === 'pull' ? 'einholen' : 'nachgeben');
  assert.equal(c.stage, 'drill');
  drillMove(s, c, c.drill[1] === 'pull' ? 'einholen' : 'nachgeben');
  assert.equal(c.stage, 'lost');
});
t('Morgen- und Abendfische beißen nur zu ihrer Zeit', () => {
  const morning = catchTable(game('mensch', 'a')).map((x) => x.id);
  const evening = catchTable(game('mensch', 'b')).map((x) => x.id);
  assert.ok(morning.includes('rotfeder') && !evening.includes('rotfeder'));
  assert.ok(evening.includes('mondaal') && !morning.includes('mondaal'));
  assert.ok(morning.includes('brackenforelle') && evening.includes('brackenforelle'));
});
t('Zwerge ziehen doppelt so oft Kuriositäten heraus', () => {
  const w = (race: 'mensch' | 'zwerg') => catchTable(game(race)).filter((x) => CURIOS.some((c) => c.id === x.id)).reduce((a, x) => a + x.w, 0);
  assert.equal(w('zwerg'), 2 * w('mensch'));
});
t('Verkaufen bringt Gold, Braten heilt, beides nur einmal', () => {
  const a = hook('mensch', (x) => FISH.some((f) => f.id === x.catchId && f.size === 's'));
  const g0 = a.s.player.gold; const price = fishPrice(a.s, a.c);
  sellFish(a.s, a.c); sellFish(a.s, a.c); fryFish(a.s, a.c);
  assert.equal(a.s.player.gold, g0 + price);
  const b = hook('mensch', (x) => FISH.some((f) => f.id === x.catchId && f.size === 's'));
  b.s.player.hp = 1; const heal = fishHeal(b.s, b.c);
  fryFish(b.s, b.c);
  assert.equal(b.s.player.hp, 1 + heal);
  assert.ok(b.s.player.hp <= maxHp(b.s.player));
});
t('Kuriositäten: Flaschenposten der Reihe nach, Ring bringt Edelsteine', () => {
  const s = game();
  const notes = new Set<string>();
  for (let i = 0; i < 4; i++) {
    const c = cast(s); c.catchId = 'flaschenpost'; c.drill = []; s.player.fishCasts = 0;
    strike(s, c, c.biteAt + 50);
    notes.add(c.lines[c.lines.length - 1]);
  }
  assert.equal(notes.size, 4);
  const c = cast(s); c.catchId = 'ring'; c.drill = [];
  const gems = s.player.gems;
  strike(s, c, c.biteAt + 50);
  assert.equal(s.player.gems, gems + 2);
});
t('Die Legende: Edelsteine, Neuigkeit fürs Dorf, nicht verkäuflich', () => {
  const s = game(); s.player.name = 'Hilde';
  const c = cast(s); c.catchId = LEGEND.id; c.weight = 200; c.drill = ['pull', 'tired', 'pull', 'tired'];
  const gems = s.player.gems;
  strike(s, c, c.biteAt + 50);
  for (const m of ['nachgeben', 'einholen', 'nachgeben', 'einholen'] as const) drillMove(s, c, m);
  assert.equal(c.stage, 'caught');
  assert.equal(s.player.gems, gems + 3);
  assert.ok(s.outbox.some((x) => x.includes('legendFish|Hilde')));
  assert.equal(fishPrice(s, c), 0);
  assert.equal(s.fishbook!.alter.n, 1);
});
t('Lohnt sich, ersetzt aber den Wald nicht (Gold pro Tag bei gutem Angeln < 6 Waldsiege)', () => {
  for (const level of [1, 5, 10, 15]) {
    let gold = 0; const days = 400;
    for (let d = 0; d < days; d++) {
      const s = game('mensch', d % 2 ? 'a' : 'b'); s.player.level = level;
      for (let i = 0; i < CASTS_PER_DAY; i++) {
        const c = cast(s);
        if (Math.random() < 0.2) continue;              // ein Fünftel verpatzt
        strike(s, c, c.biteAt + 100);
        while (c.stage === 'drill') drillMove(s, c, c.drill[c.drillPos] === 'pull' ? 'nachgeben' : 'einholen');
        const before = s.player.gold;
        if (c.stage === 'caught' && !c.done) sellFish(s, c);
        gold += s.player.gold - before;
      }
    }
    const perDay = gold / days;
    console.log(`     Stufe ${level}: ${perDay.toFixed(0)} Gold pro Spieltag aus Fischen = ${(perDay / goldPerKill(level)).toFixed(1)} Waldsiege`);
    assert.ok(perDay < 6 * goldPerKill(level) && perDay > 1 * goldPerKill(level));
  }
});
console.log(`${n} Prüfungen bestanden`);
