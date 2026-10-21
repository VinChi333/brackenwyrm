import type { GameState, Gender } from '../game/types';

// Die Ruhmeshalle von Moosgrund. Solange es kein Spielerkonto gibt, stehen hier die
// Helden aus den Dorfgeschichten; später kommen echte Spieler dazu.

export interface FameEntry {
  name: string;
  dragonKills: number;
  level: number;
  title: string;
  isPlayer?: boolean;
}

import { titleFor } from './titles';
export { titleFor };

const LEGENDS: (Omit<FameEntry, 'title'> & { gender: Gender })[] = [
  { name: 'Brunhild Eisenhand', gender: 'f', dragonKills: 12, level: 9 },
  { name: 'Jorek der Stille', gender: 'm', dragonKills: 9, level: 14 },
  { name: 'Tilda Farnfuß', gender: 'f', dragonKills: 7, level: 4 },
  { name: 'Hagen vom Moor', gender: 'm', dragonKills: 5, level: 11 },
  { name: 'Elsbeth Rabenhaar', gender: 'f', dragonKills: 4, level: 7 },
  { name: 'Wenzel Dachs', gender: 'm', dragonKills: 3, level: 15 },
  { name: 'Kuno Breitaxt', gender: 'm', dragonKills: 2, level: 6 },
  { name: 'Ida die Flinke', gender: 'f', dragonKills: 1, level: 12 },
  { name: 'Fritz Krummbein', gender: 'm', dragonKills: 0, level: 13 },
  { name: 'Lene Distel', gender: 'f', dragonKills: 0, level: 5 },
];

export function fameTable(s: GameState): FameEntry[] {
  const p = s.player;
  const all: FameEntry[] = LEGENDS.map((l) => ({ name: l.name, dragonKills: l.dragonKills, level: l.level, title: titleFor(l.dragonKills, l.gender) }));
  all.push({ name: p.name, dragonKills: p.dragonKills, level: p.level, title: titleFor(p.dragonKills, p.gender), isPlayer: true });
  // Bei Gleichstand steht der Spieler vorne: Wer zuletzt kam, ist im Dorfgespräch.
  return all.sort((a, b) => b.dragonKills - a.dragonKills || b.level - a.level || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0));
}
