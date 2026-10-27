// Die Dorfuhr: Wie im Original schlägt sie für alle gleichzeitig. Ein neuer Spieltag beginnt
// zweimal am Tag, um 6 und um 18 Uhr Wiener Zeit (Sommer- und Winterzeit eingerechnet).
// Der Server rechnet genauso (server/supabase-6-spieltage.sql, bw_gameday).

export const CLOCK_ZONE = 'Europe/Vienna'; // i18n-ignore
export const DAY_STARTS = [6, 18] as const;
const HOUR = 3_600_000;

let fmt: Intl.DateTimeFormat | null = null;
function wienParts(d: Date): { y: number; m: number; day: number; h: number; min: number; s: number } {
  try {
    fmt ??= new Intl.DateTimeFormat('en-GB', { // i18n-ignore
      timeZone: CLOCK_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, day: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second };
  } catch {
    // ohne Zeitzonen-Daten: Mitteleuropäische Zeit ohne Sommerzeit
    const w = new Date(d.getTime() + HOUR);
    return { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, day: w.getUTCDate(), h: w.getUTCHours(), min: w.getUTCMinutes(), s: w.getUTCSeconds() };
  }
}

/** Schlüssel des Spieltags, z. B. "2026-10-27a" (6 bis 18 Uhr) oder "2026-10-27b" (18 bis 6 Uhr). */
export function gameDayKey(d: Date = new Date()): string {
  // Wiener Uhrzeit ablesen und auf der Uhr 6 Stunden zurückdrehen (wie der Server)
  const p = wienParts(d);
  const w = new Date(Date.UTC(p.y, p.m - 1, p.day, p.h - 6, p.min));
  return `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, '0')}-${String(w.getUTCDate()).padStart(2, '0')}${w.getUTCHours() < 12 ? 'a' : 'b'}`;
}

/** Zeitpunkt, an dem der nächste Spieltag beginnt. */
export function nextGameDayAt(d: Date = new Date()): Date {
  const key = gameDayKey(d);
  const p = wienParts(d);
  const target = p.h < DAY_STARTS[0] ? DAY_STARTS[0] : p.h < DAY_STARTS[1] ? DAY_STARTS[1] : DAY_STARTS[0] + 24;
  let at = d.getTime() + ((target - p.h) * 3600 - p.min * 60 - p.s) * 1000 - d.getMilliseconds();
  // Zeitumstellung in der Nacht dazwischen: um eine Stunde nachbessern
  if (gameDayKey(new Date(at)) === key) at += HOUR;
  else if (gameDayKey(new Date(at - HOUR)) !== key) at -= HOUR;
  return new Date(at);
}

/** Wann beginnen die Spieltage in der Uhrzeit des Geräts? (für Texte wie "um 06:00 und 18:00") */
export function dayStartsLocal(d: Date = new Date(), locale?: string): [string, string] {
  const a = nextGameDayAt(d);
  const b = nextGameDayAt(new Date(a.getTime() + 60_000));
  const f = (x: Date) => x.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const [first, second] = a.getHours() * 60 + a.getMinutes() <= b.getHours() * 60 + b.getMinutes() ? [a, b] : [b, a];
  return [f(first), f(second)];
}

/** Restzeit bis zum nächsten Spieltag in Stunden und Minuten. */
export function untilNextDay(d: Date = new Date()): { h: number; m: number } {
  const ms = Math.max(0, nextGameDayAt(d).getTime() - d.getTime());
  const mins = Math.ceil(ms / 60_000);
  return { h: Math.floor(mins / 60), m: mins % 60 };
}
