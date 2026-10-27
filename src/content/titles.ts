import type { Gender } from '../game/types';

import { tkey, tr } from '../i18n';

// Titel nach Drachenkills: vom Grünschnabel aus dem Wald bis zur unsterblichen Legende.
// Index = Zahl der Drachenkills (ab 31 bleibt es beim höchsten Titel). Der Server kennt dieselbe Liste (Teil 6, f_title).
const LADDER_DE: [string, string][] = [
  [tkey('Grünschnabel'), tkey('Grünschnabel')],
  [tkey('Reisigsammler'), tkey('Reisigsammlerin')],
  [tkey('Fährtenleser'), tkey('Fährtenleserin')],
  [tkey('Farnläufer'), tkey('Farnläuferin')],
  [tkey('Wegwächter'), tkey('Wegwächterin')],
  [tkey('Moosritter'), tkey('Moosritterin')],
  [tkey('Wurzelhüter'), tkey('Wurzelhüterin')],
  [tkey('Bannerträger'), tkey('Bannerträgerin')],
  [tkey('Wyrmspäher'), tkey('Wyrmspäherin')],
  [tkey('Schuppenbrecher'), tkey('Schuppenbrecherin')],
  [tkey('Klingenmeister'), tkey('Klingenmeisterin')],
  [tkey('Eichenherr'), tkey('Eichenherrin')],
  [tkey('Hainhüter'), tkey('Hainhüterin')],
  [tkey('Wyrmjäger'), tkey('Wyrmjägerin')],
  [tkey('Wyrmbezwinger'), tkey('Wyrmbezwingerin')],
  [tkey('Recke'), tkey('Reckin')],
  [tkey('Schutzherr'), tkey('Schutzherrin')],
  [tkey('Waldfürst'), tkey('Waldfürstin')],
  [tkey('Sturmreiter'), tkey('Sturmreiterin')],
  [tkey('Nebelwandler'), tkey('Nebelwandlerin')],
  [tkey('Sternenwächter'), tkey('Sternenwächterin')],
  [tkey('Glutherz'), tkey('Glutherz')],
  [tkey('Flammenbändiger'), tkey('Flammenbändigerin')],
  [tkey('Wyrmschreck'), tkey('Wyrmschreck')],
  [tkey('Legende'), tkey('Legende')],
  [tkey('Sagengestalt'), tkey('Sagengestalt')],
  [tkey('Mythos'), tkey('Mythos')],
  [tkey('Waldgeist'), tkey('Waldgeist')],
  [tkey('Weltenhüter'), tkey('Weltenhüterin')],
  [tkey('Wyrmkönig'), tkey('Wyrmkönigin')],
  [tkey('Ewiger'), tkey('Ewige')],
  [tkey('Unsterblicher'), tkey('Unsterbliche')],
];
const LADDER: [string, string][] = LADDER_DE.map(([m, f]) => [tr(m), tr(f)]);

export function titleFor(dragonKills: number, gender: Gender = 'm'): string {
  const row = LADDER[Math.max(0, Math.min(LADDER.length - 1, dragonKills))];
  return row[gender === 'f' ? 1 : 0];
}

/** "Gräfin Hilda" */
export function titledName(name: string, dragonKills: number, gender: Gender): string {
  return `${titleFor(dragonKills, gender)} ${name}`;
}

/** Alle Titel (deutsch), längste zuerst. Damit lassen sich Namen wie "Moosritterin Hilda" vom Server übersetzen. */
export const TITLE_KEYS: string[] = [...new Set(LADDER_DE.flat())].sort((x, y) => y.length - x.length);
