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
  { id: 'wald', title: 'Dein erster Kampf',
    text: 'Geh durchs Stadttor in den Wald und such dir einen Gegner. Jeder Kampf kostet einen Waldkampf. Davon bekommst du jeden Tag neue.',
    go: 'go:forest', goLabel: 'In den Wald', reward: { gold: 25 },
    done: 'Frieda hat von deinem ersten Sieg gehört und schickt dir 25 Gold. „Für eine anständige Waffe.“' },
  { id: 'heilen', title: 'Wunden versorgen',
    text: 'Lebenspunkte kommen im Wald nicht von allein zurück. Lass dich in Mirlas Kräuterhütte heilen, bevor du weiterkämpfst.',
    go: 'go:healer', goLabel: 'Zu Mirla', reward: { gold: 15 },
    done: 'Mirla drückt dir ein Säckchen in die Hand: „15 Gold. Für die nächste Salbe, die brauchst du bestimmt.“' },
  { id: 'schmiede', title: 'Eine bessere Waffe',
    text: 'Mit dem Haselstecken kommst du nicht weit. Kauf bei Alrik eine Waffe oder eine Rüstung. Das Schnitzmesser kostet nur 30 Gold.',
    go: 'go:smith', goLabel: 'Zur Schmiede', reward: { gems: 1 },
    done: 'Alrik wirft dir einen Edelstein zu. „Lag noch in der Esse. Edelsteine brauchst du später für Tränke und Reittiere.“' },
  { id: 'kontor', title: 'Gold in Sicherheit',
    text: 'Wer im Wald fällt, verliert alles Gold, das er dabeihat. Was im Kontor liegt, ist sicher und bringt über Nacht sogar Zinsen.',
    go: 'go:bank', goLabel: 'Zum Kontor', reward: { bank: 20 },
    done: 'Ansgar legt dir 20 Gold Begrüßungsgeld aufs Konto. „Willkommen bei uns.“' },
  { id: 'meister', title: 'Die nächste Stufe',
    text: 'Kämpfe im Wald, bis dein Erfahrungsbalken voll ist. Dann fordere auf dem Trainingsplatz deinen Meister heraus. Wer ihn besiegt, steigt eine Stufe auf.',
    go: 'go:forest', goLabel: 'In den Wald', reward: { gems: 1 },
    done: 'Stufe 2! Dein Meister gibt dir zum Abschied einen Edelstein mit.' },
  { id: 'frieda', title: 'Ein Abend im Gasthaus',
    text: 'Im Gasthaus hört man den neuesten Klatsch, trinkt sich Mut an und trifft andere Helden. Sprich einmal mit Frieda.',
    go: 'go:inn', goLabel: 'Ins Gasthaus', reward: { fights: 1 },
    done: 'Frieda schiebt dir einen Kanten Brot hin. „Iss was, dann hältst du länger durch.“ (+1 Waldkampf)' },
];

export const GUIDE_END = {
  title: 'Du bist bereit',
  text: 'Das war das Wichtigste. Jeden Tag bekommst du neue Waldkämpfe, um Mitternacht gibt es frische. Steig Stufe um Stufe auf, besiege alle Meister bis Stufe 15, und dann wartet in der Farnschlucht der Wyrm. Mit Stufe 2 und 3 öffnen sich weitere Orte in Moosgrund.',
};

/** Ab welcher Stufe ein Ort im Menü auftaucht (nur für Neulinge, nur bis Stufe 3). Nicht genannte Orte sind sofort da. */
export const PLACE_UNLOCK: Record<string, number> = {
  'go:stable': 2, 'go:quirin': 2, 'go:ambros': 2, 'go:news': 2, 'go:aushang': 2, 'go:warriors': 2, 'go:mail': 2, 'go:chronicle': 2,
  'go:fields': 3, 'go:lager': 3, 'go:seer': 3, 'go:garten': 3, 'go:felsen': 3, 'go:dag': 3, 'go:fivesix': 3,
};
export const GUIDE_OPEN_LEVEL = 3;

export const PLACE_NAMES: Record<string, string> = {
  'go:stable': 'Mertens Pferdestall', 'go:quirin': 'Quirins Tränke', 'go:ambros': 'der alte Ambros', 'go:news': 'die Tagesneuigkeiten',
  'go:aushang': 'der Aushang am Rathaus', 'go:warriors': 'die Kriegerliste', 'go:mail': 'die Briefe', 'go:chronicle': 'die Kampfchronik',
  'go:fields': 'die Felder vor dem Tor', 'go:lager': 'das Söldnerlager', 'go:seer': 'das Zelt der Seherin', 'go:garten': 'der Rosengarten',
  'go:felsen': 'der Wyrmstein', 'go:dag': 'Dag Durnick im Gasthaus', 'go:fivesix': 'die Würfelecke im Gasthaus',
};

/** Kurzer Hinweis beim ersten Besuch eines Ortes. */
export const SCREEN_HINTS: Record<string, string> = {
  forest: '„Herumstreifen“ findet Gegner deiner Stufe, „Leichte Beute“ schwächere, „Nervenkitzel“ stärkere mit mehr Lohn. Manchmal passiert im Wald auch etwas ganz anderes.',
  fight: '„Angreifen“ ist ein Schlag. „Kämpfen bis zum Ende“ kämpft für dich weiter und hält an, wenn es knapp wird. Fliehen klappt nicht immer.',
  healer: 'Mirla heilt gegen Gold. Je höher deine Stufe, desto teurer wird es.',
  smith: 'Waffen bringen Angriff, Rüstungen Verteidigung. Dein altes Stück rechnet Alrik zur Hälfte an.',
  bank: 'Gold im Kontor ist sicher, auch wenn du im Wald fällst, und bringt über Nacht Zinsen.',
  training: 'Dein Meister nimmt die Herausforderung erst an, wenn dein Erfahrungsbalken voll ist. Verlierst du, passiert nichts Schlimmes, du kannst es morgen wieder versuchen.',
  inn: 'Frieda kennt jeden Klatsch, am Tresen gibt es Getränke mit Wirkung, und mit einem Zimmer bist du nachts vor Überfällen sicher.',
  shadows: 'Du bist gestorben. Halb so schlimm: Am nächsten Morgen bist du wieder im Dorf. Weg sind nur das Gold, das du dabeihattest, und ein Teil der Erfahrung. Wer nicht warten will, sammelt hier Gunst bei Morwen.',
  stable: 'Ein Reittier bringt dir jeden Tag mehr Waldkämpfe. Bezahlt wird mit Edelsteinen.',
  quirin: 'Quirin braut aus Edelsteinen Tränke: für Charme, für mehr Lebenspunkte oder um Rasse und Fähigkeit zu wechseln.',
  fields: 'Hier schlafen Helden, die sich kein Zimmer leisten. Du kannst sie im Schlaf überfallen und Gold erbeuten. Dasselbe kann dir passieren.',
  lager: 'Ein Söldner kämpft im Wald und in der Feste an deiner Seite.',
  ambros: 'Ein kleines Ratespiel um Gold. Ambros schläft schnell ein, also nur ein paar Runden am Tag.',
  tresen: 'Getränke geben dir Kraft für ein paar Kampfrunden. Wer zu viel trinkt, hat morgen einen Kater.',
  dag: 'Gegen Gold setzt Dag ein Kopfgeld auf andere Helden aus. Wer sie besiegt, kassiert.',
  fivesix: 'Jeder Wurf füllt den gemeinsamen Topf. Fünf Sechser knacken ihn.',
  feste: 'Die versunkene Feste ist jeden Tag ein anderes Labyrinth. Pass auf dein Licht auf, und ganz hinten wartet der Hüter.',
  warriors: 'Alle Helden aus Moosgrund. Du kannst ihre Steckbriefe lesen und ihnen Briefe schreiben.',
  seer: 'Die Seherin lässt dich gegen Gold mit den Toten im Schattenreich reden.',
};
