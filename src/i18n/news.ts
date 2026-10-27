// Neuigkeiten für alle: werden als kurzer Code gespeichert ("§master|Hilda|~Ilka Wolfsfang|5") und erst beim
// Lesen in der Sprache des Lesers ausgeschrieben. So sieht ein englischer Spieler die Taten deutscher Spieler
// auf Englisch und umgekehrt. Der Name des Helden steht im Klartext drin (der Server prüft das).
import { t } from './index';
import { addServerPatterns, serverText } from './server';

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
  stairsFrieda: '{0} und Wirtin Frieda wurden zusammen auf der Treppe zu den Gästezimmern gesehen.',
  weddingFrieda: '{0} und Wirtin Frieda haben heute geheiratet! Im Schlafenden Wurm gab es Freibier. Fast.',
  leftFrieda: 'Frieda hat {0} verlassen, um „anderen Interessen“ nachzugehen.',
  stairsFlorian: '{0} und Barde Florian wurden zusammen auf der Treppe zu den Gästezimmern gesehen.',
  weddingFlorian: '{0} und Barde Florian haben heute geheiratet! Florian hat seine eigene Hochzeit selbst besungen.',
  leftFlorian: 'Florian hat {0} verlassen, um „anderen Interessen“ nachzugehen.',
} as const;
export type NewsId = keyof typeof NEWS;
// Alte Neuigkeiten aus der Zeit vor dem Code stehen als deutscher Klartext in der Datenbank.
addServerPatterns(Object.values(NEWS));

/** Eine Neuigkeit verpacken. Werte mit "~" davor werden beim Lesen übersetzt (siehe tk), mit "@m:" sind Gegner. */
export function news(id: NewsId, ...vals: (string | number)[]): string {
  return ['§' + id, ...vals.map((v) => String(v).replace(/\|/g, '/'))].join('|');
}

type Resolver = (v: string) => string | null;
let resolver: Resolver = () => null;
/** Die Oberfläche meldet hier, wie z. B. "@m:borkenwolf" ausgeschrieben wird ("einem Borkenwolf"). */
export function setNewsResolver(r: Resolver): void { resolver = r; }

function value(v: string): string {
  if (v.startsWith('~')) return t(v.slice(1));
  return resolver(v) ?? v;
}

/** Eine gespeicherte Neuigkeit in der Sprache des Lesers. Alte Klartext-Neuigkeiten und Server-Texte gehen durch serverText. */
export function showNews(body: string): string {
  if (!body.startsWith('§')) return serverText(body);
  const [head, ...vals] = body.slice(1).split('|');
  const tpl = NEWS[head as NewsId];
  if (!tpl) return vals.join(' ');
  return t(tpl, ...vals.map(value));
}
