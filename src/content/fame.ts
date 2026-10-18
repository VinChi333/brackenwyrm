import type { GameState } from '../game/types';

// Die Ruhmeshalle von Moosgrund. Solange es kein Spielerkonto gibt, stehen hier die
// Helden aus den Dorfgeschichten; später kommen echte Spieler dazu.

export interface FameEntry {
  name: string;
  dragonKills: number;
  level: number;
  title: string;
  isPlayer?: boolean;
}

/** Titel nach Drachenkills, wie die alten Rangabzeichen. */
const TITLES = ['Neuling', 'Wyrmjäger', 'Farnritter', 'Moosgraf', 'Schluchtenwächter', 'Wyrmbezwinger', 'Held von Moosgrund', 'Legende des Brackenwalds'];

export function titleFor(dragonKills: number): string {
  if (dragonKills >= 12) return TITLES[7];
  if (dragonKills >= 9) return TITLES[6];
  return TITLES[Math.min(dragonKills, 5)];
}

const LEGENDS: Omit<FameEntry, 'title'>[] = [
  { name: 'Brunhild Eisenhand', dragonKills: 12, level: 9 },
  { name: 'Jorek der Stille', dragonKills: 9, level: 14 },
  { name: 'Tilda Farnfuß', dragonKills: 7, level: 4 },
  { name: 'Hagen vom Moor', dragonKills: 5, level: 11 },
  { name: 'Elsbeth Rabenhaar', dragonKills: 4, level: 7 },
  { name: 'Wenzel Dachs', dragonKills: 3, level: 15 },
  { name: 'Kuno Breitaxt', dragonKills: 2, level: 6 },
  { name: 'Ida die Flinke', dragonKills: 1, level: 12 },
  { name: 'Fritz Krummbein', dragonKills: 0, level: 13 },
  { name: 'Lene Distel', dragonKills: 0, level: 5 },
];

export function fameTable(s: GameState): FameEntry[] {
  const p = s.player;
  const all: FameEntry[] = LEGENDS.map((l) => ({ ...l, title: titleFor(l.dragonKills) }));
  all.push({ name: p.name, dragonKills: p.dragonKills, level: p.level, title: titleFor(p.dragonKills), isPlayer: true });
  // Bei Gleichstand steht der Spieler vorne: Wer zuletzt kam, ist im Dorfgespräch.
  return all.sort((a, b) => b.dragonKills - a.dragonKills || b.level - a.level || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0));
}
