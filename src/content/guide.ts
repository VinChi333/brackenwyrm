import { t } from '../i18n';
// Einstieg für Neulinge: sechs erste Schritte mit kleiner Belohnung, Orte, die sich mit der Stufe öffnen,
// und ein kurzer Hinweis beim ersten Besuch jedes Ortes. Gilt nur für neu angelegte Helden.

export interface GuideStep {
  id: 'wald' | 'heilen' | 'schmiede' | 'kontor' | 'meister' | 'frieda';
  title: string;
  text: string;
  go: string;          // Aktion für den Knopf "Hinbringen"
  goLabel: string;
  reward: { gold?: number; gems?: number; bank?: number; fights?: number };
  done: string;        // Text, wenn geschafft (mit Belohnung)
}

export const GUIDE_STEPS: GuideStep[] = [
  { id: 'wald', title: t('Dein erster Kampf'),
    text: t('Geh durchs Stadttor in den Wald und such dir einen Gegner. Jeder Kampf kostet einen Waldkampf. Davon bekommst du jeden Tag neue.'),
    go: 'go:forest', goLabel: t('In den Wald'), reward: { gold: 25 },
    done: t('Frieda hat von deinem ersten Sieg gehört und schickt dir 25 Gold. „Für eine anständige Waffe.“') },
  { id: 'heilen', title: t('Wunden versorgen'),
    text: t('Lebenspunkte kommen im Wald nicht von allein zurück. Lass dich in Mirlas Kräuterhütte heilen, bevor du weiterkämpfst.'),
    go: 'go:healer', goLabel: t('Zu Mirla'), reward: { gold: 15 },
    done: t('Mirla drückt dir ein Säckchen in die Hand: „15 Gold. Für die nächste Salbe, die brauchst du bestimmt.“') },
  { id: 'schmiede', title: t('Eine bessere Waffe'),
    text: t('Mit dem Haselstecken kommst du nicht weit. Kauf bei Alrik eine Waffe oder eine Rüstung. Das Schnitzmesser kostet nur 30 Gold.'),
    go: 'go:smith', goLabel: t('Zur Schmiede'), reward: { gems: 1 },
    done: t('Alrik wirft dir einen Edelstein zu. „Lag noch in der Esse. Edelsteine brauchst du später für Tränke und Reittiere.“') },
  { id: 'kontor', title: t('Gold in Sicherheit'),
    text: t('Wer im Wald fällt, verliert alles Gold, das er dabeihat. Was im Kontor liegt, ist sicher und bringt über Nacht sogar Zinsen.'),
    go: 'go:bank', goLabel: t('Zum Kontor'), reward: { bank: 20 },
    done: t('Ansgar legt dir 20 Gold Begrüßungsgeld aufs Konto. „Willkommen bei uns.“') },
  { id: 'meister', title: t('Die nächste Stufe'),
    text: t('Kämpfe im Wald, bis dein Erfahrungsbalken voll ist. Dann fordere auf dem Trainingsplatz deinen Meister heraus. Wer ihn besiegt, steigt eine Stufe auf.'),
    go: 'go:forest', goLabel: t('In den Wald'), reward: { gems: 1 },
    done: t('Stufe 2! Dein Meister gibt dir zum Abschied einen Edelstein mit.') },
  { id: 'frieda', title: t('Ein Abend im Gasthaus'),
    text: t('Im Gasthaus hört man den neuesten Klatsch, trinkt sich Mut an und trifft andere Helden. Sprich einmal mit Frieda.'),
    go: 'go:inn', goLabel: t('Ins Gasthaus'), reward: { fights: 1 },
    done: t('Frieda schiebt dir einen Kanten Brot hin. „Iss was, dann hältst du länger durch.“ (+1 Waldkampf)') },
];

export const GUIDE_END = {
  title: t('Du bist bereit'),
  text: t('Das war das Wichtigste. Jeden Tag bekommst du neue Waldkämpfe, um Mitternacht gibt es frische. Steig Stufe um Stufe auf, besiege alle Meister bis Stufe 15, und dann wartet in der Farnschlucht der Wyrm. Mit Stufe 2 und 3 öffnen sich weitere Orte in Moosgrund.'),
};

/** Ab welcher Stufe ein Ort im Menü auftaucht (nur für Neulinge, nur bis Stufe 3). Nicht genannte Orte sind sofort da. */
export const PLACE_UNLOCK: Record<string, number> = {
  'go:stable': 2, 'go:quirin': 2, 'go:ambros': 2, 'go:news': 2, 'go:aushang': 2, 'go:warriors': 2, 'go:mail': 2, 'go:chronicle': 2,
  'go:fields': 3, 'go:lager': 3, 'go:seer': 3, 'go:garten': 3, 'go:felsen': 3, 'go:dag': 3, 'go:fivesix': 3,
};
export const GUIDE_OPEN_LEVEL = 3;

export const PLACE_NAMES: Record<string, string> = {
  'go:stable': t('Mertens Pferdestall'), 'go:quirin': t('Quirins Tränke'), 'go:ambros': t('der alte Ambros'), 'go:news': t('die Tagesneuigkeiten'),
  'go:aushang': t('der Aushang am Rathaus'), 'go:warriors': t('die Kriegerliste'), 'go:mail': t('die Briefe'), 'go:chronicle': t('die Kampfchronik'),
  'go:fields': t('die Felder vor dem Tor'), 'go:lager': t('das Söldnerlager'), 'go:seer': t('das Zelt der Seherin'), 'go:garten': t('der Rosengarten'),
  'go:felsen': t('der Wyrmstein'), 'go:dag': t('Veit Galgenstrick im Gasthaus'), 'go:fivesix': t('die Würfelecke im Gasthaus'),
};

/** Kurzer Hinweis beim ersten Besuch eines Ortes. */
export const SCREEN_HINTS: Record<string, string> = {
  forest: t('„Herumstreifen“ findet Gegner deiner Stufe, „Leichte Beute“ schwächere, „Nervenkitzel“ stärkere mit mehr Lohn. Manchmal passiert im Wald auch etwas ganz anderes.'),
  fight: t('„Angreifen“ ist ein Schlag. „Kämpfen bis zum Ende“ kämpft für dich weiter und hält an, wenn es knapp wird. Fliehen klappt nicht immer.'),
  healer: t('Mirla heilt gegen Gold. Je höher deine Stufe, desto teurer wird es.'),
  smith: t('Waffen bringen Angriff, Rüstungen Verteidigung. Dein altes Stück rechnet Alrik zur Hälfte an.'),
  bank: t('Gold im Kontor ist sicher, auch wenn du im Wald fällst, und bringt über Nacht Zinsen.'),
  training: t('Dein Meister nimmt die Herausforderung erst an, wenn dein Erfahrungsbalken voll ist. Verlierst du, passiert nichts Schlimmes, du kannst es morgen wieder versuchen.'),
  inn: t('Frieda kennt jeden Klatsch, am Tresen gibt es Getränke mit Wirkung, und mit einem Zimmer bist du nachts vor Überfällen sicher.'),
  shadows: t('Du bist gestorben. Halb so schlimm: Am nächsten Morgen bist du wieder im Dorf. Weg sind nur das Gold, das du dabeihattest, und ein Teil der Erfahrung. Wer nicht warten will, sammelt hier Gunst bei Morwen.'),
  stable: t('Ein Reittier bringt dir jeden Tag mehr Waldkämpfe. Bezahlt wird mit Edelsteinen.'),
  quirin: t('Quirin braut aus Edelsteinen Tränke: für Charme, für mehr Lebenspunkte oder um Rasse und Fähigkeit zu wechseln.'),
  fields: t('Hier schlafen Helden, die sich kein Zimmer leisten. Du kannst sie im Schlaf überfallen und Gold erbeuten. Dasselbe kann dir passieren.'),
  lager: t('Ein Söldner kämpft im Wald und in der Feste an deiner Seite.'),
  ambros: t('Ein kleines Ratespiel um Gold. Ambros schläft schnell ein, also nur ein paar Runden am Tag.'),
  tresen: t('Getränke geben dir Kraft für ein paar Kampfrunden. Wer zu viel trinkt, hat morgen einen Kater.'),
  dag: t('Gegen Gold setzt Veit ein Kopfgeld auf andere Helden aus. Wer sie besiegt, kassiert.'),
  fivesix: t('Jeder Wurf füllt den gemeinsamen Topf. Fünf Sechser knacken ihn.'),
  feste: t('Die versunkene Feste ist jeden Tag ein anderes Labyrinth. Pass auf dein Licht auf, und ganz hinten wartet der Hüter.'),
  warriors: t('Alle Helden aus Moosgrund. Du kannst ihre Steckbriefe lesen und ihnen Briefe schreiben.'),
  seer: t('Die Seherin lässt dich gegen Gold mit den Toten im Schattenreich reden.'),
};
