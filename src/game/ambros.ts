// Der alte Ambros auf der Bank am Dorfplatz: Zahlenraten um Gold, angelehnt an das Ratespiel des alten Mannes im Original.
// Er denkt sich eine Zahl von 1 bis 100, man hat 6 Versuche und hört "höher" oder "niedriger".
// Der Einsatz wird sofort abgezogen; wer errät, bekommt ihn doppelt zurück. Höchstens 3 Spiele pro Tag.

import { roll } from './rng';
import type { GameState } from './types';

export const AMBROS_GAMES_PER_DAY = 3;
export const AMBROS_TRIES = 6;

export interface AmbrosGame { bet: number; target: number; tries: number; over: '' | 'win' | 'lose'; hints: string[] }

export function ambrosBets(level: number): number[] {
  return [5, 10, 20].map((f) => f * level);
}

export function startAmbros(s: GameState, bet: number): AmbrosGame | string {
  const p = s.player;
  if ((p.ambrosGames ?? 0) >= AMBROS_GAMES_PER_DAY) return 'Ambros gähnt. „Für heute hab ich genug gerechnet. Komm morgen wieder.“';
  if (!ambrosBets(p.level).includes(bet)) return 'So einen Einsatz nimmt Ambros nicht.';
  if (p.gold < bet) return `„${bet} Gold? So viel hast du nicht dabei, Kindchen.“`;
  p.gold -= bet;
  p.ambrosGames = (p.ambrosGames ?? 0) + 1;
  return { bet, target: roll(1, 100), tries: 0, over: '', hints: [] };
}

export function guessAmbros(s: GameState, g: AmbrosGame, n: number): void {
  if (g.over || !Number.isInteger(n) || n < 1 || n > 100) return;
  g.tries += 1;
  if (n === g.target) {
    s.player.gold += g.bet * 2;
    g.over = 'win';
    g.hints.push(`${n}? Ambros starrt dich an. „Hast du mir über die Schulter geschaut?“ Er zählt dir ${g.bet * 2} Gold in die Hand.`);
    return;
  }
  const left = AMBROS_TRIES - g.tries;
  if (left <= 0) {
    g.over = 'lose';
    g.hints.push(`${n}? Nein. „Es war die ${g.target}“, kichert Ambros und steckt deinen Einsatz ein.`);
    return;
  }
  g.hints.push(`${n}? „${n < g.target ? 'Höher' : 'Niedriger'}!“ (noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'})`);
}
