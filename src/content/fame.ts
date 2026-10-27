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
import { t } from '../i18n';

export { titleFor };

const LEGENDS: (Omit<FameEntry, 'title'> & { gender: Gender })[] = [
  { name: t('Brunhild Eisenhand'), gender: 'f', dragonKills: 12, level: 9 },
  { name: t('Jorek der Stille'), gender: 'm', dragonKills: 9, level: 14 },
  { name: t('Tilda Farnfuß'), gender: 'f', dragonKills: 7, level: 4 },
  { name: t('Hagen vom Moor'), gender: 'm', dragonKills: 5, level: 11 },
  { name: t('Elsbeth Rabenhaar'), gender: 'f', dragonKills: 4, level: 7 },
  { name: t('Wenzel Dachs'), gender: 'm', dragonKills: 3, level: 15 },
  { name: t('Kuno Breitaxt'), gender: 'm', dragonKills: 2, level: 6 },
  { name: t('Ida die Flinke'), gender: 'f', dragonKills: 1, level: 12 },
  { name: t('Fritz Krummbein'), gender: 'm', dragonKills: 0, level: 13 },
  { name: t('Lene Distel'), gender: 'f', dragonKills: 0, level: 5 },
];

export function fameTable(s: GameState): FameEntry[] {
  const p = s.player;
  const all: FameEntry[] = LEGENDS.map((l) => ({ name: l.name, dragonKills: l.dragonKills, level: l.level, title: titleFor(l.dragonKills, l.gender) }));
  all.push({ name: p.name, dragonKills: p.dragonKills, level: p.level, title: titleFor(p.dragonKills, p.gender), isPlayer: true });
  // Bei Gleichstand steht der Spieler vorne: Wer zuletzt kam, ist im Dorfgespräch.
  return all.sort((a, b) => b.dragonKills - a.dragonKills || b.level - a.level || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0));
}
