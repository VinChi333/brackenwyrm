import type { Gender } from '../game/types';

import { t } from '../i18n';

// Titel nach Drachenkills: vom Grünschnabel aus dem Wald bis zur unsterblichen Legende.
// Index = Zahl der Drachenkills (ab 31 bleibt es beim höchsten Titel). Der Server kennt dieselbe Liste (Teil 6, f_title).
const LADDER: [string, string][] = [
  [t('Grünschnabel'), t('Grünschnabel')],
  [t('Reisigsammler'), t('Reisigsammlerin')],
  [t('Fährtenleser'), t('Fährtenleserin')],
  [t('Farnläufer'), t('Farnläuferin')],
  [t('Wegwächter'), t('Wegwächterin')],
  [t('Moosritter'), t('Moosritterin')],
  [t('Wurzelhüter'), t('Wurzelhüterin')],
  [t('Bannerträger'), t('Bannerträgerin')],
  [t('Wyrmspäher'), t('Wyrmspäherin')],
  [t('Schuppenbrecher'), t('Schuppenbrecherin')],
  [t('Klingenmeister'), t('Klingenmeisterin')],
  [t('Eichenherr'), t('Eichenherrin')],
  [t('Hainhüter'), t('Hainhüterin')],
  [t('Wyrmjäger'), t('Wyrmjägerin')],
  [t('Wyrmbezwinger'), t('Wyrmbezwingerin')],
  [t('Recke'), t('Reckin')],
  [t('Schutzherr'), t('Schutzherrin')],
  [t('Waldfürst'), t('Waldfürstin')],
  [t('Sturmreiter'), t('Sturmreiterin')],
  [t('Nebelwandler'), t('Nebelwandlerin')],
  [t('Sternenwächter'), t('Sternenwächterin')],
  [t('Glutherz'), t('Glutherz')],
  [t('Flammenbändiger'), t('Flammenbändigerin')],
  [t('Wyrmschreck'), t('Wyrmschreck')],
  [t('Legende'), t('Legende')],
  [t('Sagengestalt'), t('Sagengestalt')],
  [t('Mythos'), t('Mythos')],
  [t('Waldgeist'), t('Waldgeist')],
  [t('Weltenhüter'), t('Weltenhüterin')],
  [t('Wyrmkönig'), t('Wyrmkönigin')],
  [t('Ewiger'), t('Ewige')],
  [t('Unsterblicher'), t('Unsterbliche')],
];

export function titleFor(dragonKills: number, gender: Gender = 'm'): string {
  const row = LADDER[Math.max(0, Math.min(LADDER.length - 1, dragonKills))];
  return row[gender === 'f' ? 1 : 0];
}

/** "Gräfin Hilda" */
export function titledName(name: string, dragonKills: number, gender: Gender): string {
  return `${titleFor(dragonKills, gender)} ${name}`;
}

/** Alle Titel (deutsch), längste zuerst. Damit lassen sich Namen wie "Moosritterin Hilda" vom Server übersetzen. */
export const TITLE_KEYS: string[] = [...new Set(LADDER.flat())].sort((x, y) => y.length - x.length);
