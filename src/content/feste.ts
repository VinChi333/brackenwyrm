// Die versunkene Feste: ein Labyrinth tief im Brackenwald, angelehnt an das "Abandoned Castle" aus dem Original.
// Hier stehen die Texte und Gegner; die Regeln stehen in src/game/feste.ts.

import type { MonsterDef } from '../game/types';

export const FESTE_NAME = 'Die versunkene Feste';

/** Kleine Gegner in den Gängen. level = ab welcher Stufe man ihnen begegnet (sie wachsen mit dem Helden). */
export const FESTE_MONSTERS: MonsterDef[] = [
  { id: 'kellerratte', name: 'Kellerratte', level: 5, shape: 'rat', scale: 0.8, eyes: '#e05a4a',
    intro: 'Aus einem Loch in der Mauer schießt eine Kellerratte, fett wie ein Ferkel.',
    hits: 'beißt dich in die Wade', falls: 'Die Kellerratte flüchtet quiekend in die Dunkelheit. Hoffentlich allein.' },
  { id: 'fledermausschwarm', name: 'Fledermausschwarm', level: 5, shape: 'bat', scale: 0.85, eyes: '#e9dfc3',
    intro: 'Deine Fackel weckt einen Fledermausschwarm. Plötzlich ist die Luft voller Flügel.',
    hits: 'flattert dir ins Gesicht und kratzt', falls: 'Der Schwarm zieht kreischend in einen anderen Gang.' },
  { id: 'farnspinne', name: 'Farnspinne', level: 6, shape: 'spider', scale: 1.0, eyes: '#9be36a',
    intro: 'Von der Decke seilt sich eine Spinne ab, so groß wie ein Schild. Farn wächst auf ihrem Rücken.',
    hits: 'sticht dich mit giftigen Klauen', falls: 'Die Farnspinne rollt die Beine ein und rührt sich nicht mehr.' },
  { id: 'moderskelett', name: 'Moderskelett', level: 7, shape: 'humanoid', prop: 'sword', scale: 1.0, eyes: '#bfe3ff',
    intro: 'Ein Skelett in rostigem Kettenhemd klappert dir entgegen. Es hat seine Wache nie beendet.',
    hits: 'schlägt mit seinem rostigen Schwert zu', falls: 'Das Moderskelett fällt in einen Haufen Knochen. Der Schädel rollt noch ein Stück.' },
  { id: 'gewoelbegeist', name: 'Gewölbegeist', level: 8, shape: 'ghost', scale: 1.0, eyes: '#bfe3ff',
    intro: 'Kälte kriecht durch den Gang. Ein Gewölbegeist schwebt aus der Wand und flüstert deinen Namen.',
    hits: 'fährt dir eiskalt durch die Brust', falls: 'Der Gewölbegeist seufzt erleichtert und verweht.' },
  { id: 'wyrmjaeger', name: 'Moderritter', level: 10, shape: 'humanoid', prop: 'sword', scale: 1.1, eyes: '#9be36a',
    intro: 'Eine Gestalt in moosüberwachsener Rüstung stellt sich dir in den Weg. Ihre Augen glimmen grün. „Kein Lebender betritt die Schatzkammer.“',
    hits: 'trifft dich mit einem Jagdspeer', falls: 'Der Moderritter, einst ein Wyrmjäger, sinkt auf die Knie. „Endlich … Ruhe“, flüstert er.' },
];

/** Der Hüter der Feste: der letzte Wyrmjäger, verflucht, seit hundert Jahren auf Wache. */
export const HUETER: MonsterDef = {
  id: 'hueter', name: 'Hauptmann Gerwin', level: 15, shape: 'humanoid', prop: 'sword', scale: 1.3, eyes: '#8cff6a',
  intro: 'In der Mitte der Halle steht eine riesige Gestalt in moosbewachsener Rüstung, das Schwert in den Steinboden gerammt. Langsam hebt sie den Kopf. „Hundert Jahre“, grollt Hauptmann Gerwin. „Hundert Jahre bewache ich, was wir dem Wyrm nicht nehmen konnten. Und du willst es mir nehmen?“',
  hits: 'trifft dich mit seinem gewaltigen Schwert', falls: 'Hauptmann Gerwin lässt das Schwert sinken. „Gut gekämpft“, sagt er leise, und das grüne Licht in seinen Augen erlischt. „Nimm es. Und bring zu Ende, was wir nicht geschafft haben.“',
};

export const FESTE_FOES: MonsterDef[] = [...FESTE_MONSTERS, HUETER];

export function festeMonster(id: string): MonsterDef | undefined {
  return FESTE_FOES.find((m) => m.id === id);
}

/** Erbstücke der Wyrmjäger: je eines pro Held, mit kleinem, bleibendem Bonus (auch nach dem Drachen). */
export type HeirloomId = 'jagdhorn' | 'schild' | 'klinge' | 'amulett' | 'gluecksstein' | 'siegelring' | 'laterne' | 'tagebuch';

export interface Heirloom { id: HeirloomId; name: string; bonus: string; blurb: string }

export const HEIRLOOMS: Heirloom[] = [
  { id: 'jagdhorn', name: 'Jagdhorn der Wyrmjäger', bonus: '+1 Waldkampf pro Tag', blurb: 'Wer hineinbläst, ist morgens schneller wach. Die Nachbarn weniger.' },
  { id: 'schild', name: 'Moosbesetzter Schild', bonus: '+1 Verteidigung', blurb: 'Das Moos wächst nach, egal wie oft man es abkratzt.' },
  { id: 'klinge', name: 'Rostige Klinge des Hauptmanns', bonus: '+1 Angriff', blurb: 'Rostig, aber sie weiß noch, wofür sie geschmiedet wurde.' },
  { id: 'amulett', name: 'Amulett aus Drachenschuppe', bonus: '+5 Lebenspunkte', blurb: 'Eine einzelne grüne Schuppe, noch warm. Von wem wohl?' },
  { id: 'gluecksstein', name: 'Abgegriffener Glücksstein', bonus: '10 % mehr Gold im Wald', blurb: 'Generationen von Daumen haben ihn glatt gerieben.' },
  { id: 'siegelring', name: 'Siegelring der Feste', bonus: '+1 Charme', blurb: 'Mit dem Wappen der Wyrmjäger. Frieda wird beeindruckt sein.' },
  { id: 'laterne', name: 'Laterne des Kundschafters', bonus: '15 Schritte mehr Licht in der Feste', blurb: 'Brennt mit einer Flamme, die nie ganz ausgeht.' },
  { id: 'tagebuch', name: 'Tagebuch des letzten Wyrmjägers', bonus: '5 % mehr Erfahrung im Wald', blurb: 'Voller Notizen über den Wald, die Feste und den Wyrm.' },
];

export function heirloom(id: string): Heirloom | undefined {
  return HEIRLOOMS.find((h) => h.id === id);
}

export function hasHeirloom(p: { heirlooms?: string[] }, id: HeirloomId): boolean {
  return !!p.heirlooms?.includes(id);
}

/** Schriftrollen der Wyrmjäger: Stück für Stück ihre Geschichte. */
export const SCROLLS: string[] = [
  'Tag 1. Wir sind zwölf. Hauptmann Gerwin sagt, der Wyrm schläft tief in der Farnschlucht, und wer ihn im Schlaf erwischt, wird ein Held. Wir haben Speere, Fackeln und Mut. Was soll schon schiefgehen?',
  'Tag 9. Die Feste ist fertig. Mauern so dick wie drei Männer. Von hier aus beobachten wir die Schlucht. Der Wyrm schnarcht. Man hört es bis hierher.',
  'Tag 30. Brandt sagt, der Wyrm hat ein Auge geöffnet, als er zu nahe kam. Brandt redet viel. Trotzdem schläft heute keiner gut.',
  'Tag 47. Wir haben ihm eine Schuppe abgeschlagen, während er schlief. Sie glüht noch immer grün. Gerwin trägt sie jetzt um den Hals.',
  'Tag 48. Er ist aufgewacht.',
  'Tag 49. Der Boden bebt. Die Schlucht dampft. Die Hälfte der Feste ist im Moor versunken. Wir sind nur noch fünf.',
  'Tag 50. Gerwin hat alles in die Halle bringen lassen: unser Gold, unsere Waffen, die Schuppe. „Wenn wir fallen, soll es jemand finden, der stärker ist als wir.“',
  'Tag 51. Der Wyrm hat sich wieder schlafen gelegt. Er hat uns nicht einmal richtig angesehen. Gerwin hat geschworen, die Halle zu bewachen, bis jemand kommt, der den Wyrm wirklich besiegen kann. Ich glaube, er meint es ernst.',
];

export const FESTE_TEXT = {
  found: 'Hinter einer Wand aus Farn entdeckst du alte Steinstufen, die in eine Senke führen. Unten ragen die Zinnen einer halb versunkenen Festung aus dem Moor, überwuchert von Moos und Wurzeln. Über dem Tor hängt ein verwittertes Schild: „Nur die Mutigsten treten ein. Die anderen gehen besser gleich wieder.“',
  entrance: 'Die Zinnen der alten Festung ragen schief aus dem Moor. Moos kriecht über die Mauern, Wurzeln haben das Tor gesprengt. Dahinter führen Stufen hinab in die Gewölbe der Wyrmjäger. Irgendwo dort unten liegt ihr Schatz, und irgendwer bewacht ihn noch.',
  enter: 'Du entzündest deine Fackel und steigst die glitschigen Stufen hinab. Die Luft riecht nach nassem Stein und altem Eisen.',
  dark: 'Deine Fackel flackert ein letztes Mal und erlischt. In völliger Dunkelheit tastest du dich an der Wand entlang zurück zum Ausgang. Für heute ist die Feste zu.',
  left: 'Du steigst die Stufen wieder hinauf ins Tageslicht. Die Feste wartet. Morgen ist sie wieder anders.',
  closedToday: 'Du warst heute schon in der Feste. Die Gänge verschieben sich über Nacht, morgen ist sie wieder offen.',
  treasure: 'Hinter Gerwins Thron liegt die Schatzkammer der Wyrmjäger: Truhen voller Gold, Speere an den Wänden und Staub, so dick wie Schnee.',
  well: 'Ein alter Brunnen, das Wasser darin ist klar und kalt. Du trinkst, und deine Wunden schließen sich.',
  torch: 'In einer Wandhalterung steckt eine unbenutzte Fackel. Du zündest sie an deiner alten an.',
  chestEmpty: 'Eine Truhe. Leer, bis auf eine tote Maus. Jemand war schneller.',
  traps: [
    'Der Boden unter dir gibt nach! Du stürzt in eine Fallgrube und kletterst fluchend wieder heraus.',
    'Ein Klicken unter deinem Fuß, dann zischen Pfeile aus der Wand.',
    'Über dir knirscht es. Steine prasseln aus der Decke.',
    'Eine Klinge schwingt aus der Wand. Du duckst dich, aber nicht ganz schnell genug.',
  ],
};
