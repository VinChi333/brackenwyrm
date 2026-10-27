// Dorfuhr: zwei Spieltage pro Tag, um 6 und 18 Uhr Wiener Zeit, auch bei Zeitumstellung.
import assert from 'node:assert';
import { gameDayKey, nextGameDayAt, untilNextDay } from '../src/game/clock';

let n = 0;
const ok = (c: boolean, msg: string) => { assert.ok(c, msg); console.log('ok  ', msg); n++; };
const at = (iso: string) => new Date(iso);

ok(gameDayKey(at('2026-10-27T04:59:00Z')) === '2026-10-26b', 'Winter 5:59 Uhr gehört zum Abend davor');
ok(gameDayKey(at('2026-10-27T05:00:00Z')) === '2026-10-27a', 'Winter 6:00 Uhr: Tagesspieltag');
ok(gameDayKey(at('2026-10-27T17:00:00Z')) === '2026-10-27b', 'Winter 18:00 Uhr: Abendspieltag');
ok(gameDayKey(at('2026-07-01T04:00:00Z')) === '2026-07-01a', 'Sommer 6:00 Uhr (MESZ)');
ok(gameDayKey(at('2026-07-01T03:59:00Z')) === '2026-06-30b', 'Sommer 5:59 Uhr (MESZ)');

ok(nextGameDayAt(at('2026-10-27T10:00:00Z')).toISOString() === '2026-10-27T17:00:00.000Z', 'nächster Tag um 18 Uhr Wiener Zeit');
ok(nextGameDayAt(at('2026-10-27T20:00:00Z')).toISOString() === '2026-10-28T05:00:00.000Z', 'nächster Tag um 6 Uhr früh');
ok(nextGameDayAt(at('2026-10-27T02:00:00Z')).toISOString() === '2026-10-27T05:00:00.000Z', 'nach Mitternacht: um 6 Uhr');
// Zeitumstellung: Nacht vom 24. auf 25. Oktober 2026 (3 → 2 Uhr) und 28. auf 29. März 2026 (2 → 3 Uhr)
ok(nextGameDayAt(at('2026-10-24T18:00:00Z')).toISOString() === '2026-10-25T05:00:00.000Z', 'Herbst-Zeitumstellung: 6 Uhr Winterzeit');
ok(nextGameDayAt(at('2026-03-28T18:00:00Z')).toISOString() === '2026-03-29T04:00:00.000Z', 'Frühlings-Zeitumstellung: 6 Uhr Sommerzeit');
const u = untilNextDay(at('2026-10-27T15:30:00Z'));
ok(u.h === 1 && u.m === 30, 'Restzeit 1 Std. 30 Min.');
// über eine ganze Woche: genau zwei Wechsel pro Tag
let changes = 0;
let prev = gameDayKey(at('2026-03-25T00:00:00Z'));
for (let i = 1; i <= 7 * 24 * 4; i++) { const k = gameDayKey(new Date(Date.parse('2026-03-25T00:00:00Z') + i * 15 * 60_000)); if (k !== prev) changes++; prev = k; }
ok(changes === 14, 'eine Woche über die Zeitumstellung: 14 neue Spieltage');
console.log(`${n} Prüfungen bestanden`);
