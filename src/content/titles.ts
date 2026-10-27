import type { Gender } from '../game/types';

import { t } from '../i18n';

// Titel nach Drachenkills, aufgebaut wie die Rangleiter im Original: vom Bauernkind über Ritter und Adel
// bis zu den himmlischen Rängen. Index = Zahl der Drachenkills (ab 31 bleibt es beim höchsten Titel).
const LADDER: [string, string][] = [
  [t('Bauernjunge'), t('Bauernmädchen')],
  [t('Page'), t('Pagin')],
  [t('Knappe'), t('Knappin')],
  [t('Gladiator'), t('Gladiatorin')],
  [t('Legionär'), t('Legionärin')],
  [t('Zenturio'), t('Zenturionin')],
  [t('Ritter'), t('Dame')],
  [t('Vogt'), t('Vögtin')],
  [t('Truchsess'), t('Truchsessin')],
  [t('Bürgermeister'), t('Bürgermeisterin')],
  [t('Baron'), t('Baronin')],
  [t('Graf'), t('Gräfin')],
  [t('Vicomte'), t('Vicomtesse')],
  [t('Marquis'), t('Marquise')],
  [t('Kanzler'), t('Kanzlerin')],
  [t('Prinz'), t('Prinzessin')],
  [t('König'), t('Königin')],
  [t('Kaiser'), t('Kaiserin')],
  [t('Engel'), t('Engel')],
  [t('Erzengel'), t('Erzengel')],
  [t('Himmelsfürst'), t('Himmelsfürstin')],
  [t('Gewaltiger'), t('Gewaltige')],
  [t('Tugendhafter'), t('Tugendhafte')],
  [t('Herrscher'), t('Herrscherin')],
  [t('Thronwächter'), t('Thronwächterin')],
  [t('Cherub'), t('Cherub')],
  [t('Seraph'), t('Seraph')],
  [t('Halbgott'), t('Halbgöttin')],
  [t('Titan'), t('Titanin')],
  [t('Erztitan'), t('Erztitanin')],
  [t('Niederer Gott'), t('Niedere Göttin')],
  [t('Gott'), t('Göttin')],
];

export function titleFor(dragonKills: number, gender: Gender = 'm'): string {
  const row = LADDER[Math.max(0, Math.min(LADDER.length - 1, dragonKills))];
  return row[gender === 'f' ? 1 : 0];
}

/** "Gräfin Hilda" */
export function titledName(name: string, dragonKills: number, gender: Gender): string {
  return `${titleFor(dragonKills, gender)} ${name}`;
}
