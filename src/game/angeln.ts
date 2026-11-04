// Angeln am Steg des Nebelflusses (Texte in content/fische.ts).
// Regeln:
//   - Ab Stufe 1, 5 Würfe pro Spieltag, kostet keine Waldkämpfe.
//   - Beim Auswerfen steht schon fest, was beißt (neu laden hilft nicht, der Wurf ist verbraucht).
//   - Vor dem Biss zuckt der Schwimmer manchmal nur. Wer dann anschlägt, zieht ins Leere.
//   - Beim echten Biss bleiben zwei Sekunden zum Anschlagen (Elfen eine halbe länger). Leertaste oder A.
//   - Mittlere und große Fische wehren sich (Drill): Zieht der Fisch, nachgeben; ist er müde, einholen.
//     Trollen verzeiht die Schnur einen Fehler pro Drill.
//   - Manche Fische beißen nur am Morgen-Spieltag, andere nur am Abend. Zwerge ziehen öfter Kuriositäten heraus.
//   - Den Fang verkauft man an Friedas Küche oder brät ihn am Ufer (heilt). Das Fangbuch merkt sich alles.

import { maxHp } from './balance';
import { between, chance, pick, rand } from './rng';
import type { GameState } from './types';
import { BOTTLE_NOTES, CURIOS, DRILL_PULL, DRILL_TIRED, FISH, LEGEND, type FishDef } from '../content/fische';
import { t } from '../i18n';
import { news } from '../i18n/news';

export const CASTS_PER_DAY = 5;
export const BITE_WINDOW = 2000;      // ms zum Anschlagen (1,1 s war im Test mit der Maus kaum zu schaffen)
export const ELF_WINDOW = 500;        // so viel länger für Elfen
export const DRILL_ROUNDS: Record<string, number> = { s: 0, m: 1, l: 2, x: 4 };
export const LEGEND_GEMS = 3;
export const RING_GEMS = 2;

export type CastStage = 'wait' | 'drill' | 'caught' | 'lost';

export interface Cast {
  catchId: string;      // Fisch- oder Kuriositäten-ID
  weight: number;       // Pfund (0 bei Kuriositäten)
  twitches: number[];   // ms nach dem Auswerfen: der Schwimmer zuckt nur
  biteAt: number;       // ms nach dem Auswerfen: der echte Biss
  window: number;       // ms zum Anschlagen
  drill: ('pull' | 'tired')[];
  drillPos: number;
  slack: number;        // Fehler, die die Schnur noch verzeiht
  stage: CastStage;
  lines: string[];      // was bei diesem Wurf passiert ist
  done: boolean;        // Fang verwertet (verkauft, gebraten, Kuriosität eingesteckt)
}

export interface FishRecord { n: number; max: number }

export function castsLeft(s: GameState): number {
  return Math.max(0, CASTS_PER_DAY - (s.player.fishCasts ?? 0));
}

/** Morgen- oder Abend-Spieltag (aus dem Schlüssel des Spieltags, z. B. "2026-11-04b"). */
export function dayPart(s: GameState): 'a' | 'b' {
  return s.lastRealDate?.endsWith('b') ? 'b' : 'a';
}

export function fishDef(id: string): FishDef | undefined {
  return id === LEGEND.id ? LEGEND : FISH.find((f) => f.id === id);
}

export function isCurio(id: string): boolean {
  return CURIOS.some((c) => c.id === id);
}

/** Was heute beißen kann, mit Gewichten. */
export function catchTable(s: GameState): { id: string; w: number }[] {
  const part = dayPart(s);
  const curioMul = s.player.race === 'zwerg' ? 2 : 1;
  return [
    ...FISH.filter((f) => !f.time || f.time === part).map((f) => ({ id: f.id, w: f.chance })),
    { id: LEGEND.id, w: LEGEND.chance },
    ...CURIOS.map((c) => ({ id: c.id, w: c.chance * curioMul })),
  ];
}

function rollCatch(s: GameState): string {
  const table = catchTable(s);
  let r = rand() * table.reduce((a, x) => a + x.w, 0);
  for (const x of table) { r -= x.w; if (r < 0) return x.id; }
  return table[0].id;
}

function rollWeight(f: FishDef): number {
  // kleinere Fische sind häufiger, Prachtexemplare selten
  const x = Math.pow(rand(), 1.6);
  return Math.round((f.min + (f.max - f.min) * x) * 10) / 10;
}

/** Angel auswerfen. Gibt einen Text zurück, wenn es nicht geht. */
export function startCast(s: GameState): Cast | string {
  const p = s.player;
  if (!p.alive) return t('Tote angeln nicht.');
  if (castsLeft(s) <= 0) return t('Für heute hast du genug Würmer im Wasser versenkt. Am nächsten Spieltag beißen sie wieder.');
  p.fishCasts = (p.fishCasts ?? 0) + 1;
  const id = rollCatch(s);
  const f = fishDef(id);
  const biteAt = Math.round(between(2600, 7500));
  const twitches: number[] = [];
  const n = pick([0, 1, 1, 2, 2, 3]);
  for (let i = 0; i < n; i++) twitches.push(Math.round(between(900, biteAt - 700)));
  twitches.sort((a, b) => a - b);
  const rounds = f ? DRILL_ROUNDS[f.size] : 0;
  const drill: ('pull' | 'tired')[] = [];
  for (let i = 0; i < rounds; i++) drill.push(chance(0.5) ? 'pull' : 'tired');
  return {
    catchId: id,
    weight: f ? rollWeight(f) : 0,
    twitches: twitches.filter((x, i) => i === 0 || x - twitches[i - 1] > 500),
    biteAt,
    window: BITE_WINDOW + (p.race === 'elf' ? ELF_WINDOW : 0),
    drill,
    drillPos: 0,
    slack: p.race === 'troll' ? 1 : 0,
    stage: 'wait',
    lines: [],
    done: false,
  };
}

/** Anschlagen nach `ms` Millisekunden seit dem Auswerfen (oder automatisch, wenn das Zeitfenster vorbei ist). */
export function strike(s: GameState, c: Cast, ms: number): void {
  if (c.stage !== 'wait') return;
  if (ms < c.biteAt) {
    c.stage = 'lost';
    c.lines.push(c.twitches.some((x) => x <= ms)
      ? t('Du reißt die Rute hoch … und ziehst einen leeren Haken aus dem Wasser. Das war nur ein Knabbern.')
      : t('Du reißt die Rute hoch, aber da war noch gar nichts. Die Fische unten lachen bestimmt.'));
    return;
  }
  if (ms > c.biteAt + c.window) {
    c.stage = 'lost';
    c.lines.push(t('Zu spät! Als du anschlägst, ist der Köder schon weg. Irgendwo da unten frisst jemand zufrieden.'));
    return;
  }
  if (c.drill.length) {
    c.stage = 'drill';
    c.lines.push(t('Angeschlagen! Etwas Schweres hängt am Haken und wehrt sich!'));
    return;
  }
  land(s, c);
}

/** Text für die aktuelle Drillrunde. */
export function drillLine(c: Cast, seed = 0): string {
  const kind = c.drill[c.drillPos];
  const list = kind === 'pull' ? DRILL_PULL : DRILL_TIRED;
  return list[(c.drillPos + seed) % list.length];
}

/** Im Drill: nachgeben oder einholen. */
export function drillMove(s: GameState, c: Cast, move: 'nachgeben' | 'einholen'): void {
  if (c.stage !== 'drill') return;
  const kind = c.drill[c.drillPos];
  const right = (kind === 'pull' && move === 'nachgeben') || (kind === 'tired' && move === 'einholen');
  if (!right) {
    if (c.slack > 0) {
      c.slack -= 1;
      c.lines.push(t('Die Schnur ächzt und spannt sich bis zum Zerreißen … und hält. Trollkraft.'));
    } else {
      c.stage = 'lost';
      c.lines.push(kind === 'pull'
        ? t('Du hältst dagegen, doch der Fisch zieht stärker. Die Schnur reißt mit einem Knall.')
        : t('Du lässt Schnur, und der müde Fisch nutzt die Pause. Er verschwindet im Kraut, die Schnur ist leer.'));
      return;
    }
  } else {
    c.lines.push(kind === 'pull' ? t('Du gibst Schnur und lässt ihn laufen. Gut so.') : t('Du holst ein, Stück für Stück.'));
  }
  c.drillPos += 1;
  if (c.drillPos >= c.drill.length) land(s, c);
}

function record(s: GameState, id: string, weight: number): void {
  const book = (s.fishbook ??= {});
  const r = book[id] ?? { n: 0, max: 0 };
  r.n += 1;
  r.max = Math.max(r.max, weight);
  book[id] = r;
}

export function fmtWeight(w: number): string {
  return w.toLocaleString(t('de-AT'), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Der Fang ist auf dem Steg. Kuriositäten und die Legende werden sofort verbucht. */
function land(s: GameState, c: Cast): void {
  const p = s.player;
  c.stage = 'caught';
  record(s, c.catchId, c.weight);
  const curio = CURIOS.find((x) => x.id === c.catchId);
  if (curio) {
    c.lines.push(curio.text);
    c.done = true;
    if (curio.id === 'flaschenpost') {
      const n = s.fishbook!.flaschenpost.n;
      c.lines.push(BOTTLE_NOTES[(n - 1) % BOTTLE_NOTES.length]);
    } else if (curio.id === 'helm') {
      const g = 5 * p.level + 5;
      p.gold += g;
      c.lines.push(t`Du bekommst ${g} Gold.`);
    } else if (curio.id === 'krug') {
      const g = 15 * p.level + 10;
      p.gold += g;
      c.lines.push(t`Darin sind ${g} Gold.`);
    } else if (curio.id === 'ring') {
      p.gems += RING_GEMS;
      p.charm += 1;
      c.lines.push(t`Ein Juwelier würde dafür ${RING_GEMS} Edelsteine geben. Du steckst ihn an, und irgendwie stehst du gleich aufrechter (+1 Charme).`);
    }
    return;
  }
  const f = fishDef(c.catchId)!;
  if (f.size === 'x') {
    c.lines.push(f.caught);
    c.lines.push(t`Du bekommst ihn nicht einmal halb auf den Steg, gut ${fmtWeight(c.weight)} Pfund. Als du den Haken löst, spuckt er ${LEGEND_GEMS} Edelsteine vor deine Füße und gleitet zurück in die Tiefe.`);
    p.gems += LEGEND_GEMS;
    c.done = true;
    s.outbox = [...(s.outbox ?? []), news('legendFish', p.name)].slice(-20);
    return;
  }
  c.lines.push(t`${f.name}, ${fmtWeight(c.weight)} Pfund! ${f.caught}`);
}

/** So viel zahlt Friedas Küche. */
export function fishPrice(s: GameState, c: Cast): number {
  const f = fishDef(c.catchId);
  if (!f || f.size === 'x') return 0;
  return Math.max(1, Math.round(c.weight * f.price * (3 + 3 * s.player.level)));
}

/** So viel heilt der gebratene Fisch. */
export function fishHeal(s: GameState, c: Cast): number {
  const f = fishDef(c.catchId);
  if (!f || f.size === 'x') return 0;
  const p = s.player;
  const share = f.size === 's' ? 0.15 : f.size === 'm' ? 0.25 : 0.4;
  return Math.min(maxHp(p) - p.hp, Math.max(1, Math.round(maxHp(p) * share)));
}

export function sellFish(s: GameState, c: Cast): void {
  if (c.stage !== 'caught' || c.done) return;
  const g = fishPrice(s, c);
  s.player.gold += g;
  c.done = true;
  c.lines.push(t`Friedas Küchenjunge holt den Fisch ab und zählt dir ${g} Gold in die Hand. „Heute Abend gibt’s Fisch!“`);
}

export function fryFish(s: GameState, c: Cast): void {
  if (c.stage !== 'caught' || c.done) return;
  const h = fishHeal(s, c);
  s.player.hp += h;
  c.done = true;
  c.lines.push(h > 0
    ? t`Du brätst ihn über einem kleinen Feuer am Ufer. Er schmeckt nach Rauch und Fluss (+${h} Lebenspunkte).`
    : t('Du brätst ihn über einem kleinen Feuer am Ufer. Satt warst du eigentlich schon, aber er schmeckt trotzdem.'));
}

/** Fürs Fangbuch: alle Einträge in fester Reihenfolge. */
export function fishbookEntries(): { id: string; name: string; kind: 'fish' | 'legend' | 'curio' }[] {
  return [
    ...FISH.map((f) => ({ id: f.id, name: f.name, kind: 'fish' as const })),
    { id: LEGEND.id, name: LEGEND.name, kind: 'legend' as const },
    ...CURIOS.map((c) => ({ id: c.id, name: c.name, kind: 'curio' as const })),
  ];
}
