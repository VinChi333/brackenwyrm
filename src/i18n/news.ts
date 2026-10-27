// Neuigkeiten für alle: werden als kurzer Code gespeichert ("§master|Hilda|~Ilka Wolfsfang|5") und erst beim
// Lesen in der Sprache des Lesers ausgeschrieben. So sieht ein englischer Spieler die Taten deutscher Spieler
// auf Englisch und umgekehrt. Der Name des Helden steht im Klartext drin (der Server prüft das).
import { t } from './index';
import { addServerPatterns, serverText } from './server';
import { datIndef, monsterById } from '../content/monsters';
import { masterForLevel } from '../content/masters';
import { titleFor } from '../content/titles';

export const NEWS = {
  earlyReturn: 'Morwen hat {0} vorzeitig aus dem Schattenreich zurückgebracht.',
  master: '{0} hat {1} auf dem Trainingsplatz besiegt und ist jetzt Stufe {2}.',
  dragonFirst: '{0} hat den Brackenwyrm besiegt! Ganz Moosgrund feiert.',
  dragonAgain: '{0} hat den Brackenwyrm zum {1}. Mal besiegt!',
  dragonDeath: '{0} ist in der Farnschlucht vom Brackenwyrm verschlungen worden.',
  festeGuardian: '{0} ist in der versunkenen Feste am Hüter gescheitert.',
  festeDeath: '{0} wurde in der versunkenen Feste von {1} besiegt.',
  forestDeath: '{0} wurde im Brackenwald von {1} besiegt.',
  newTitle: '{0} trägt jetzt den Titel {1}.',
  mineRich: '{0} hat im alten Stollen eine reiche Ader gefunden.',
  mineBuried: '{0} wurde im alten Stollen verschüttet.',
  stoneCircle: '{0} ist im Steinkreis verschwunden. Morwen weiß mehr.',
  towerRescue: '{0} hat jemanden aus dem alten Turm im Brackenwald befreit.',
  festeTreasureFirstM: '{0} hat heute als Erster den Hüter der versunkenen Feste besiegt und ihren Schatz gehoben!',
  festeTreasureFirstF: '{0} hat heute als Erste den Hüter der versunkenen Feste besiegt und ihren Schatz gehoben!',
  festeTreasure: '{0} hat den Hüter der versunkenen Feste besiegt und ihren Schatz gehoben!',
  stairsFrieda: '{0} und Wirtin Frieda kamen erst im Morgengrauen Hand in Hand aus dem Wald zurück.',
  weddingFrieda: '{0} und Wirtin Frieda haben heute geheiratet! Im Schlafenden Wurm gab es Freibier. Fast.',
  leftFrieda: 'Frieda hat sich von {0} getrennt. Am Stammtisch wird schon gewettet, wer der Nächste ist.',
  stairsFlorian: '{0} und Barde Florian kamen erst im Morgengrauen von einem Mondscheinspaziergang zurück.',
  weddingFlorian: '{0} und Barde Florian haben heute geheiratet! Florian hat seine eigene Hochzeit selbst besungen.',
  leftFlorian: 'Florian hat sich von {0} getrennt und ist mit seiner Laute weitergezogen.',
} as const;
export type NewsId = keyof typeof NEWS;
// Alte Neuigkeiten aus der Zeit vor dem Code stehen als deutscher Klartext in der Datenbank.
addServerPatterns(Object.values(NEWS));

/** Eine Neuigkeit verpacken. Werte mit "~" davor werden beim Lesen übersetzt (siehe tk), mit "@m:" sind Gegner. */
export function news(id: NewsId, ...vals: (string | number)[]): string {
  return ['§' + id, ...vals.map((v) => String(v).replace(/\|/g, '/'))].join('|');
}

/** Platzhalter: "~Text" übersetzen, "@m:id:Name" Gegner, "@M:Stufe" Meister, "@t:Drachen:Geschlecht" Titel. */
function value(v: string): string {
  if (v.startsWith('~')) return t(v.slice(1));
  const [kind, a, b] = v.split(':');
  if (kind === '@m') return datIndef(a, monsterById(a)?.name ?? v.split(':').slice(2).join(':'));
  if (kind === '@M') return masterForLevel(Number(a))?.name ?? v;
  if (kind === '@t') return titleFor(Number(a), b === 'f' ? 'f' : 'm');
  return v;
}

/** Eine gespeicherte Neuigkeit in der Sprache des Lesers. Alte Klartext-Neuigkeiten und Server-Texte gehen durch serverText. */
export function showNews(body: string): string {
  if (!body.startsWith('§')) return serverText(body);
  const [head, ...vals] = body.slice(1).split('|');
  const tpl = NEWS[head as NewsId];
  if (!tpl) return vals.join(' ');
  return t(tpl, ...vals.map(value));
}
