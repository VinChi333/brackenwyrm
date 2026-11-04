// Angeln am Steg des Nebelflusses: die Fische, die Kuriositäten und der Alte vom Nebelfluss.
// Die Regeln stehen in src/game/angeln.ts.
// Bilderregel: Die Fische bekommen kein Bild, ihr Fang wird erzählt. Nur der Alte vom Nebelfluss hat ein Trophäenbild.

import { t } from '../i18n';

/** a = beißt nur am Morgen-Spieltag (6 bis 18 Uhr), b = nur am Abend-Spieltag, '' = immer. */
export type FishTime = 'a' | 'b' | '';
/** s = klein (kein Drill), m = mittel (1 Drillrunde), l = groß (2 Runden), x = die Legende (4 Runden). */
export type FishSize = 's' | 'm' | 'l' | 'x';

export interface FishDef {
  id: string;
  name: string;
  time: FishTime;
  chance: number;       // Gewicht bei der Auswahl (je größer, desto häufiger)
  min: number;          // Gewicht in Pfund
  max: number;
  price: number;        // Gold je Pfund, wird noch mit der Stufe multipliziert
  size: FishSize;
  desc: string;         // fürs Fangbuch
  caught: string;       // ein Satz beim Fang
}

export const FISH: FishDef[] = [
  { id: 'brackenforelle', name: t('Brackenforelle'), time: '', chance: 26, min: 0.5, max: 2.5, price: 1, size: 's',
    desc: t('Die häufigste Forelle im Nebelfluss, gesprenkelt wie Farnlaub im Herbst.'),
    caught: t('Sie zappelt silbern im Mondlicht.') },
  { id: 'rotfeder', name: t('Rotfeder'), time: 'a', chance: 18, min: 0.3, max: 1.2, price: 1.2, size: 's',
    desc: t('Rote Flossen, neugieriges Maul. Beißt nur am Morgen, solange der Nebel noch tief liegt.'),
    caught: t('Ihre roten Flossen leuchten wie kleine Laternen.') },
  { id: 'barsch', name: t('Flussbarsch'), time: '', chance: 16, min: 0.4, max: 2, price: 1.1, size: 's',
    desc: t('Gestreift, stachelig und frech. Beißt auf alles, was sich bewegt.'),
    caught: t('Er stellt beleidigt die Stacheln auf.') },
  { id: 'schleie', name: t('Grüne Schleie'), time: 'b', chance: 14, min: 1, max: 4, price: 1, size: 'm',
    desc: t('Glatt und grün wie Entengrütze. Kommt erst am Abend aus dem Schlamm.'),
    caught: t('Sie ist glitschig wie ein nasses Stück Seife.') },
  { id: 'aesche', name: t('Silberäsche'), time: 'a', chance: 10, min: 0.8, max: 3, price: 1.5, size: 'm',
    desc: t('Mit einer Rückenflosse wie ein kleines Segel. Riecht, sagt man, nach Thymian.'),
    caught: t('Sie riecht tatsächlich ein bisschen nach Thymian.') },
  { id: 'mondaal', name: t('Mondaal'), time: 'b', chance: 9, min: 1, max: 5, price: 1.3, size: 'm',
    desc: t('Schlängelt sich nur nachts ans Ufer und windet sich um alles, was er erwischt.'),
    caught: t('Er windet sich zweimal um dein Handgelenk, bevor er aufgibt.') },
  { id: 'nebelkarpfen', name: t('Nebelkarpfen'), time: '', chance: 8, min: 3, max: 12, price: 0.7, size: 'l',
    desc: t('Ein dicker, grauer Karpfen, alt und gemütlich. Wer ihn fängt, braucht starke Arme.'),
    caught: t('Er schaut dich an, als hättest du ihn beim Mittagsschlaf gestört.') },
  { id: 'farnhecht', name: t('Farnhecht'), time: 'a', chance: 6, min: 4, max: 18, price: 0.8, size: 'l',
    desc: t('Der Räuber des Flusses, grün gefleckt wie der Farn am Ufer. Lauert im Morgennebel.'),
    caught: t('Er hat mehr Zähne als Alrik Nägel in der Schmiede.') },
  { id: 'goldsaibling', name: t('Goldsaibling'), time: 'a', chance: 2.5, min: 1, max: 4, price: 4, size: 'm',
    desc: t('Selten und schön, mit goldenen Flecken auf dem Bauch. Frieda zahlt für ihn ein kleines Vermögen.'),
    caught: t('Seine Flecken glänzen wie frisch geprägte Münzen.') },
  { id: 'sternforelle', name: t('Sternforelle'), time: 'b', chance: 2, min: 1, max: 5, price: 4, size: 'm',
    desc: t('Eine Forelle, auf deren Rücken winzige Lichter glimmen. Sie beißt nur, wenn die Sterne stehen.'),
    caught: t('Auf ihrem Rücken glimmen winzige Sterne, und sie verlöschen nicht.') },
  { id: 'flusswels', name: t('Flusswels'), time: 'b', chance: 3, min: 10, max: 40, price: 0.5, size: 'l',
    desc: t('Ein schwerer Wels mit langen Barteln. Kommt am Abend aus der Tiefe.'),
    caught: t('Du brauchst beide Arme und ein Knie, um ihn auf den Steg zu ziehen.') },
];

/** Der Alte vom Nebelfluss: die Legende. Lässt sich nicht verkaufen, man lässt ihn wieder schwimmen. */
export const LEGEND: FishDef = {
  id: 'alter', name: t('Der Alte vom Nebelfluss'), time: '', chance: 0.35, min: 180, max: 260, price: 0, size: 'x',
  desc: t('Ein uralter Riesenwels. In seinen Lippen hängen die Haken von hundert Anglern, die ihn fast gehabt hätten.'),
  caught: t('Aus dem Wasser hebt sich ein Kopf, so groß wie ein Fass. Alte Haken und Schwimmer hängen ihm wie Orden an den Lippen. Er sieht dich lange an. Dann nickt er, ganz langsam.'),
};

export interface CurioDef { id: string; name: string; chance: number; text: string }

/** Kuriositäten an der Angel. Zwerge ziehen sie doppelt so oft heraus. */
export const CURIOS: CurioDef[] = [
  { id: 'stiefel', name: t('Alter Stiefel'), chance: 5,
    text: t('Ein alter Stiefel. Der linke. Der rechte liegt bestimmt auch irgendwo da unten.') },
  { id: 'flaschenpost', name: t('Flaschenpost'), chance: 2.5,
    text: t('Eine grüne Flasche, mit Wachs verschlossen. Drinnen steckt ein Zettel.') },
  { id: 'helm', name: t('Rostiger Helm'), chance: 1.5,
    text: t('Ein rostiger Helm voller Schlamm. Alrik gibt dir ein paar Münzen für das Eisen.') },
  { id: 'krug', name: t('Tonkrug mit Münzen'), chance: 1,
    text: t('Ein Tonkrug, zugestöpselt. Als du ihn öffnest, klimpert es.') },
  { id: 'ring', name: t('Ring einer Wyrmjägerin'), chance: 0.25,
    text: t('Am Haken hängt ein schmaler Silberring mit einem eingravierten Drachen. Er muss einer Wyrmjägerin gehört haben.') },
];

/** Was in den Flaschenposten steht, eine nach der anderen. */
export const BOTTLE_NOTES: string[] = [
  t('„Wer das liest: Der Wyrm schläft nicht so tief, wie alle glauben.“'),
  t('„Liebe Frieda, das Bier war schlecht, die Gesellschaft gut. Ich komme wieder. Dein Wandersmann.“'),
  t('„Rettet mich! Ich bin auf einer Insel gestrandet. Sie ist sehr klein. Eigentlich ist es ein Stein.“'),
  t('„Morwen nimmt kein Gold. Sie nimmt Gunst. Merk dir das, bevor du stirbst.“'),
  t('„Mein Schatz liegt unter der dritten Eiche hinter der Mühle. Oder unter der vierten.“'),
  t('„Wer von der Rabenklippe springt, landet bei Morwen. Ich hab’s ausprobiert. Zweimal.“'),
  t('„Die Wyrmjäger zogen in die Feste und kamen nicht zurück. Nur ihr Hauptmann hält dort noch Wache.“'),
  t('„An alle Angler: Den Alten vom Nebelfluss fängt man nicht. Er lässt sich fangen, wenn er dich mag.“'),
];

/** Sätze, während man wartet (einer pro Wurf). */
export const WAIT_LINES: string[] = [
  t('Ein Frosch quakt am Ufer.'),
  t('Der Nebel zieht in langen Fahnen über das Wasser.'),
  t('Irgendwo platscht etwas. Nicht bei dir.'),
  t('Eine Libelle setzt sich auf deine Angelrute.'),
  t('Das Wasser gluckst leise unter den Planken.'),
  t('Am anderen Ufer ruft eine Eule.'),
  t('Die Laterne am Steg flackert.'),
  t('Ein Glühwürmchen tanzt über dem Schwimmer.'),
];

/** Der Schwimmer zuckt nur: ein Knabbern, der Wind, ein neugieriger Fisch. Nicht anschlagen! */
export const TWITCH_LINES: string[] = [
  t('Der Schwimmer zittert kurz. Nur ein Knabbern?'),
  t('Der Schwimmer wippt. Vielleicht der Wind.'),
  t('Ein kleines Zupfen an der Schnur … und wieder Ruhe.'),
  t('Der Schwimmer dreht sich einmal im Kreis.'),
];

/** Der echte Biss. */
export const BITE_LINES: string[] = [
  t('Der Schwimmer taucht ab! Jetzt!'),
  t('Zack! Der Schwimmer ist weg!'),
  t('Die Schnur zischt durchs Wasser! Anschlagen!'),
];

/** Drill: Der Fisch zieht (richtig: nachgeben) oder er ermüdet (richtig: einholen). */
export const DRILL_PULL: string[] = [
  t('Die Schnur spannt sich wie eine Bogensehne, die Rute biegt sich bis zum Wasser!'),
  t('Der Fisch schießt los und reißt dir fast die Rute aus der Hand!'),
  t('Es zieht nach unten, stark und schwer. Die Schnur singt.'),
];
export const DRILL_TIRED: string[] = [
  t('Der Zug lässt nach. Der Fisch treibt ruhiger an der Schnur.'),
  t('Er schlägt noch einmal müde mit dem Schwanz, dann wird es still.'),
  t('Die Schnur hängt fast locker. Der Fisch ruht sich aus.'),
];
