import type { Gender } from '../game/types';

// Titel nach Drachenkills, aufgebaut wie die Rangleiter im Original: vom Bauernkind über Ritter und Adel
// bis zu den himmlischen Rängen. Index = Zahl der Drachenkills (ab 31 bleibt es beim höchsten Titel).
const LADDER: [string, string][] = [
  ['Bauernjunge', 'Bauernmädchen'],
  ['Page', 'Pagin'],
  ['Knappe', 'Knappin'],
  ['Gladiator', 'Gladiatorin'],
  ['Legionär', 'Legionärin'],
  ['Zenturio', 'Zenturionin'],
  ['Ritter', 'Dame'],
  ['Vogt', 'Vögtin'],
  ['Truchsess', 'Truchsessin'],
  ['Bürgermeister', 'Bürgermeisterin'],
  ['Baron', 'Baronin'],
  ['Graf', 'Gräfin'],
  ['Vicomte', 'Vicomtesse'],
  ['Marquis', 'Marquise'],
  ['Kanzler', 'Kanzlerin'],
  ['Prinz', 'Prinzessin'],
  ['König', 'Königin'],
  ['Kaiser', 'Kaiserin'],
  ['Engel', 'Engel'],
  ['Erzengel', 'Erzengel'],
  ['Himmelsfürst', 'Himmelsfürstin'],
  ['Gewaltiger', 'Gewaltige'],
  ['Tugendhafter', 'Tugendhafte'],
  ['Herrscher', 'Herrscherin'],
  ['Thronwächter', 'Thronwächterin'],
  ['Cherub', 'Cherub'],
  ['Seraph', 'Seraph'],
  ['Halbgott', 'Halbgöttin'],
  ['Titan', 'Titanin'],
  ['Erztitan', 'Erztitanin'],
  ['Niederer Gott', 'Niedere Göttin'],
  ['Gott', 'Göttin'],
];

export function titleFor(dragonKills: number, gender: Gender = 'm'): string {
  const row = LADDER[Math.max(0, Math.min(LADDER.length - 1, dragonKills))];
  return row[gender === 'f' ? 1 : 0];
}

/** "Gräfin Hilda" */
export function titledName(name: string, dragonKills: number, gender: Gender): string {
  return `${titleFor(dragonKills, gender)} ${name}`;
}
