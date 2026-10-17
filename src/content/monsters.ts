import type { MonsterDef } from '../game/types';

// Drei Gegner pro Stufe. Eigene Welt: der Brackenwald rund um das Dorf Moosgrund.

export const MONSTERS: MonsterDef[] = [
  // Stufe 1
  { id: 'moosratte', name: 'Moosratte', level: 1, shape: 'rat', scale: 0.8, eyes: '#f3c06a',
    intro: 'Eine Moosratte stellt sich dir in den Weg. Sie ist erstaunlich überzeugt von sich.',
    hits: 'knabbert an deinem Stiefel', falls: 'Die Moosratte quiekt beleidigt und verschwindet unter einer Wurzel.' },
  { id: 'stechmuecken', name: 'Stechmückenschwarm', level: 1, shape: 'bat', scale: 0.7, eyes: '#e9dfc3',
    intro: 'Ein Schwarm Stechmücken summt dir ein unfreundliches Lied.',
    hits: 'sticht dich an siebzehn Stellen gleichzeitig', falls: 'Der Schwarm löst sich in beleidigtes Summen auf.' },
  { id: 'wurzelgnom', name: 'Wurzelgnom', level: 1, shape: 'goblin', prop: 'club', scale: 0.75, eyes: '#f3c06a',
    intro: 'Ein Wurzelgnom springt aus dem Laub und fordert Wegzoll.',
    hits: 'haut dir seine Knolle gegen das Schienbein', falls: 'Der Wurzelgnom gräbt sich murrend ein.' },

  // Stufe 2
  { id: 'borkenwolf', name: 'Borkenwolf', level: 2, shape: 'wolf', scale: 0.95, eyes: '#f3c06a',
    intro: 'Ein Borkenwolf bricht aus dem Unterholz. Moos hängt in seinem Fell.',
    hits: 'beißt zu', falls: 'Der Borkenwolf sackt ins Farnkraut.' },
  { id: 'dornenkaefer', name: 'Dornenkäfer', level: 2, shape: 'beetle', scale: 0.8, eyes: '#e9dfc3',
    intro: 'Ein Dornenkäfer so groß wie ein Brotlaib klappert mit den Zangen.',
    hits: 'zwickt dich mit seinen Zangen', falls: 'Der Dornenkäfer kippt auf den Rücken und strampelt nicht mehr.' },
  { id: 'pilzling', name: 'Giftpilzling', level: 2, shape: 'blob', scale: 0.8, eyes: '#c8e07a',
    intro: 'Ein Giftpilzling wackelt auf dich zu und hustet Sporen.',
    hits: 'pustet dir Sporen ins Gesicht', falls: 'Der Pilzling fällt in sich zusammen. Es riecht nach Herbst.' },

  // Stufe 3
  { id: 'sumpfkroete', name: 'Sumpfkröte', level: 3, shape: 'blob', scale: 1.0, eyes: '#f3c06a',
    intro: 'Eine Sumpfkröte, groß wie ein Fass, blinzelt dich hungrig an.',
    hits: 'schleudert dir ihre Zunge entgegen', falls: 'Die Sumpfkröte rollt sich mit einem letzten Quaken zur Seite.' },
  { id: 'kraehe', name: 'Galgenkrähe', level: 3, shape: 'bird', scale: 0.85, eyes: '#e9dfc3',
    intro: 'Eine Galgenkrähe kreist über dir und lacht heiser.',
    hits: 'hackt nach deinen Augen', falls: 'Die Galgenkrähe flattert taumelnd ins Dickicht.' },
  { id: 'wilderer', name: 'Wilderer', level: 3, shape: 'humanoid', prop: 'bow', scale: 0.95, eyes: '#f3c06a',
    intro: 'Ein Wilderer tritt hinter einem Baum hervor. „Das ist mein Wald.“',
    hits: 'trifft dich mit einem Pfeil', falls: 'Der Wilderer wirft seinen Bogen weg und rennt.' },

  // Stufe 4
  { id: 'keiler', name: 'Wildkeiler', level: 4, shape: 'boar', scale: 1.0, eyes: '#f3c06a',
    intro: 'Ein Wildkeiler scharrt mit den Hufen. Er hat schlechte Laune und Hauer.',
    hits: 'rammt dich mit den Hauern', falls: 'Der Wildkeiler bricht schnaubend zusammen.' },
  { id: 'nebelweberin', name: 'Nebelweberin', level: 4, shape: 'spider', scale: 0.95, eyes: '#c8e07a',
    intro: 'Zwischen zwei Fichten spannt eine Nebelweberin ihr Netz. Für dich.',
    hits: 'beißt dich mit ihren Klauen', falls: 'Die Nebelweberin zieht sich in ihren Faden zurück und bleibt hängen.' },
  { id: 'irrlicht', name: 'Irrlicht', level: 4, shape: 'ghost', scale: 0.75, eyes: '#bfe3ff',
    intro: 'Ein Irrlicht tanzt vor dir. Es möchte, dass du ihm folgst. Lieber nicht.',
    hits: 'versengt dich mit kaltem Feuer', falls: 'Das Irrlicht flackert und erlischt.' },

  // Stufe 5
  { id: 'huegelkobold', name: 'Hügelkobold', level: 5, shape: 'goblin', prop: 'spear', scale: 0.95, eyes: '#f3c06a',
    intro: 'Ein Hügelkobold fuchtelt mit einem rostigen Speer.',
    hits: 'sticht mit dem Speer zu', falls: 'Der Hügelkobold kollert den Hang hinunter.' },
  { id: 'moorschlange', name: 'Moorschlange', level: 5, shape: 'serpent', scale: 0.9, eyes: '#c8e07a',
    intro: 'Eine Moorschlange richtet sich aus dem Schilf auf.',
    hits: 'schlägt ihre Giftzähne in deinen Arm', falls: 'Die Moorschlange gleitet leblos ins Wasser zurück.' },
  { id: 'eulenbaer', name: 'Eulenbär', level: 5, shape: 'bear', scale: 0.95, eyes: '#f3c06a',
    intro: 'Ein Eulenbär. Halb Eule, halb Bär, ganz wütend.',
    hits: 'schlägt mit der Tatze zu', falls: 'Der Eulenbär plumpst um. „Huhu“, macht er noch.' },

  // Stufe 6
  { id: 'rudelfuehrer', name: 'Rudelführer', level: 6, shape: 'wolf', scale: 1.1, eyes: '#ffcf5a',
    intro: 'Der graue Rudelführer heult. Irgendwo antworten andere.',
    hits: 'reißt dich mit den Fängen', falls: 'Der Rudelführer fällt. Das Heulen ringsum verstummt.' },
  { id: 'rindenspinne', name: 'Rindenspinne', level: 6, shape: 'spider', scale: 1.1, eyes: '#ffcf5a',
    intro: 'Was du für einen Baumstumpf gehalten hast, hat acht Beine.',
    hits: 'spritzt dir Harzgift entgegen', falls: 'Die Rindenspinne erstarrt. Jetzt ist sie wirklich ein Baumstumpf.' },
  { id: 'raeuberhauptmann', name: 'Räuberhauptmann', level: 6, shape: 'humanoid', prop: 'axe', scale: 1.05, eyes: '#f3c06a',
    intro: '„Gold oder Leben!“ ruft der Räuberhauptmann. Du entscheidest dich für ein Drittes.',
    hits: 'schwingt seine Axt', falls: 'Der Räuberhauptmann flieht und lässt seinen Hut zurück.' },

  // Stufe 7
  { id: 'steintroll', name: 'Steintroll', level: 7, shape: 'troll', scale: 1.0, eyes: '#f3c06a',
    intro: 'Ein Steintroll erhebt sich aus dem Geröll und streckt sich.',
    hits: 'drischt mit seiner Faust auf dich ein', falls: 'Der Steintroll erstarrt mitten in der Bewegung zu einem Felsen.' },
  { id: 'geisterhirsch', name: 'Geisterhirsch', level: 7, shape: 'stag', scale: 1.05, eyes: '#bfe3ff',
    intro: 'Ein Geisterhirsch steht reglos auf der Lichtung. Sein Atem ist Nebel.',
    hits: 'stößt dich mit seinem Geweih', falls: 'Der Geisterhirsch verblasst im Mondlicht.' },
  { id: 'sumpfschleim', name: 'Sumpfschleim', level: 7, shape: 'blob', scale: 1.15, eyes: '#c8e07a',
    intro: 'Der Boden blubbert. Dann steht er auf.',
    hits: 'verschluckt deinen Arm und spuckt ihn wieder aus', falls: 'Der Sumpfschleim versickert zischend im Moos.' },

  // Stufe 8
  { id: 'schattenluchs', name: 'Schattenluchs', level: 8, shape: 'wolf', scale: 0.95, eyes: '#c8e07a',
    intro: 'Du siehst den Schattenluchs erst, als er schon springt.',
    hits: 'schlägt seine Krallen in deine Schulter', falls: 'Der Schattenluchs verschwindet zwischen den Stämmen. Diesmal für immer.' },
  { id: 'riesenfledermaus', name: 'Riesenfledermaus', level: 8, shape: 'bat', scale: 1.2, eyes: '#ff8a6a',
    intro: 'Eine Riesenfledermaus verdunkelt kurz den Mond.',
    hits: 'schlägt dich mit ledrigen Schwingen', falls: 'Die Riesenfledermaus trudelt zu Boden.' },
  { id: 'waldschrat', name: 'Waldschrat', level: 8, shape: 'treant', scale: 0.95, eyes: '#f3c06a',
    intro: 'Ein Waldschrat knarzt. Er findet, du stehst auf seinem Fuß.',
    hits: 'peitscht dich mit Ästen', falls: 'Der Waldschrat seufzt und schlägt Wurzeln.' },

  // Stufe 9
  { id: 'hoehlenbaer', name: 'Höhlenbär', level: 9, shape: 'bear', scale: 1.2, eyes: '#f3c06a',
    intro: 'Ein Höhlenbär wurde aus dem Winterschlaf geweckt. Von dir, meint er.',
    hits: 'zerkratzt dich mit seinen Pranken', falls: 'Der Höhlenbär legt sich hin und schläft weiter. Endgültig.' },
  { id: 'giftnatter', name: 'Aschenatter', level: 9, shape: 'serpent', scale: 1.05, eyes: '#ff8a6a',
    intro: 'Eine Aschenatter zischt. Wo sie kriecht, verdorrt das Gras.',
    hits: 'beißt dich mit glühenden Zähnen', falls: 'Die Aschenatter zerfällt zu grauem Staub.' },
  { id: 'klingenwilderer', name: 'Klingenwilderer', level: 9, shape: 'humanoid', prop: 'daggers', scale: 1.0, eyes: '#f3c06a',
    intro: 'Ein Klingenwilderer wirbelt zwei Messer. Er hat dich schon länger beobachtet.',
    hits: 'schneidet dich mit seinen Messern', falls: 'Der Klingenwilderer verliert seine Messer und dann die Nerven.' },

  // Stufe 10
  { id: 'grabwicht', name: 'Grabwicht', level: 10, shape: 'ghost', scale: 1.0, eyes: '#bfe3ff',
    intro: 'Aus einem alten Hügelgrab steigt ein Grabwicht und flüstert deinen Namen.',
    hits: 'berührt dich mit eisigen Fingern', falls: 'Der Grabwicht sinkt zurück in seinen Hügel.' },
  { id: 'moortroll', name: 'Moortroll', level: 10, shape: 'troll', scale: 1.15, eyes: '#c8e07a',
    intro: 'Ein Moortroll watet auf dich zu. Er riecht, wie er aussieht.',
    hits: 'wirft dich in den Schlamm', falls: 'Der Moortroll versinkt blubbernd im Sumpf.' },
  { id: 'eisenkaefer', name: 'Eisenkäfer', level: 10, shape: 'beetle', scale: 1.15, eyes: '#ff8a6a',
    intro: 'Ein Eisenkäfer rasselt heran. Sein Panzer klingt wie eine Rüstung.',
    hits: 'quetscht dich mit seinen Zangen', falls: 'Der Eisenkäfer bleibt mit einem rostigen Klonk liegen.' },

  // Stufe 11
  { id: 'nachtmahr', name: 'Nachtmahr', level: 11, shape: 'stag', scale: 1.1, eyes: '#ff8a6a',
    intro: 'Ein Nachtmahr stampft aus dem Nebel. Seine Hufe berühren den Boden nicht.',
    hits: 'tritt dich mit Hufen aus Rauch', falls: 'Der Nachtmahr zerfließt wie ein schlechter Traum.' },
  { id: 'wurzelriese', name: 'Wurzelriese', level: 11, shape: 'treant', scale: 1.2, eyes: '#f3c06a',
    intro: 'Der Boden bebt. Ein Wurzelriese zieht seine Füße aus der Erde.',
    hits: 'zermalmt dich mit Wurzelfäusten', falls: 'Der Wurzelriese kippt um wie eine alte Eiche.' },
  { id: 'felsenkeiler', name: 'Felsenkeiler', level: 11, shape: 'boar', scale: 1.25, eyes: '#ff8a6a',
    intro: 'Ein Felsenkeiler. Seine Borsten sind aus Stein, seine Laune auch.',
    hits: 'überrennt dich', falls: 'Der Felsenkeiler kracht gegen einen Baum und bleibt liegen.' },

  // Stufe 12
  { id: 'harpyie', name: 'Harpyie', level: 12, shape: 'bird', scale: 1.2, eyes: '#ff8a6a',
    intro: 'Eine Harpyie kreischt vom Felsen. Sie hat Hunger und schlechte Manieren.',
    hits: 'schlägt ihre Krallen in deinen Rücken', falls: 'Die Harpyie stürzt kreischend in die Tiefe.' },
  { id: 'knochenritter', name: 'Knochenritter', level: 12, shape: 'humanoid', prop: 'sword', scale: 1.1, eyes: '#bfe3ff',
    intro: 'Ein Knochenritter salutiert. Dann zieht er sein Schwert.',
    hits: 'trifft dich mit seiner rostigen Klinge', falls: 'Der Knochenritter fällt klappernd in sich zusammen.' },
  { id: 'dornengolem', name: 'Dornengolem', level: 12, shape: 'troll', scale: 1.2, eyes: '#c8e07a',
    intro: 'Ein Golem aus Brombeerranken und Zorn versperrt den Pfad.',
    hits: 'umschlingt dich mit Dornen', falls: 'Der Dornengolem zerfällt zu einem Haufen Gestrüpp.' },

  // Stufe 13
  { id: 'wyrmling', name: 'Wyrmling', level: 13, shape: 'serpent', scale: 1.2, eyes: '#ffcf5a',
    intro: 'Ein junger Wyrmling. Irgendwo muss seine Mutter sein.',
    hits: 'speit dir Funken ins Gesicht', falls: 'Der Wyrmling rollt sich zusammen und rührt sich nicht mehr.' },
  { id: 'sturmrabe', name: 'Sturmrabe', level: 13, shape: 'bird', scale: 1.3, eyes: '#bfe3ff',
    intro: 'Der Wind dreht. Ein Sturmrabe landet auf einem Ast, der unter ihm bricht.',
    hits: 'schleudert dich mit einem Flügelschlag zu Boden', falls: 'Der Sturmrabe verweht wie eine Gewitterwolke.' },
  { id: 'waldhexe', name: 'Waldhexe', level: 13, shape: 'humanoid', prop: 'staff', scale: 1.0, eyes: '#c8e07a',
    intro: 'Eine Waldhexe kichert. „Du kommst mir gerade recht.“',
    hits: 'verflucht dich', falls: 'Die Waldhexe verwandelt sich in eine Kröte und hüpft davon.' },

  // Stufe 14
  { id: 'eichenhueter', name: 'Eichenhüter', level: 14, shape: 'treant', scale: 1.35, eyes: '#ffcf5a',
    intro: 'Der Eichenhüter ist älter als das Dorf. Er erinnert sich an jeden gefällten Baum.',
    hits: 'schmettert dich mit seinem Stamm', falls: 'Der Eichenhüter neigt sich und wird still.' },
  { id: 'schattenwolf', name: 'Schattenwolf', level: 14, shape: 'wolf', scale: 1.3, eyes: '#ff6b5e',
    intro: 'Ein Schattenwolf wächst aus der Dunkelheit zwischen den Bäumen.',
    hits: 'zerfetzt dich mit Zähnen aus Nacht', falls: 'Der Schattenwolf zerfasert wie Rauch.' },
  { id: 'steinwurm', name: 'Steinwurm', level: 14, shape: 'serpent', scale: 1.35, eyes: '#ff8a6a',
    intro: 'Felsen bewegen sich. Ein Steinwurm windet sich aus der Klamm.',
    hits: 'zermalmt dich in seinen Windungen', falls: 'Der Steinwurm erstarrt zu einem neuen Bergrücken.' },

  // Stufe 15
  { id: 'farngeist', name: 'Farngeist', level: 15, shape: 'ghost', scale: 1.3, eyes: '#c8e07a',
    intro: 'Die Farne flüstern. Dann formen sie ein Gesicht.',
    hits: 'erstickt dich mit grünem Nebel', falls: 'Der Farngeist sinkt zurück ins Grün.' },
  { id: 'trollkoenig', name: 'Bergtrollkönig', level: 15, shape: 'troll', scale: 1.4, eyes: '#ffcf5a',
    intro: 'Der Bergtrollkönig trägt eine Krone aus Felsbrocken. Sie steht ihm nicht.',
    hits: 'zerschmettert dich mit seiner Keule', falls: 'Der Bergtrollkönig stürzt. Seine Krone rollt davon.' },
  { id: 'wyrmwaechter', name: 'Wyrmwächter', level: 15, shape: 'serpent', scale: 1.45, eyes: '#ff6b5e',
    intro: 'Ein Wyrmwächter bewacht den Pfad zur Farnschlucht. Er riecht deinen Mut.',
    hits: 'peitscht dich mit seinem Schwanz', falls: 'Der Wyrmwächter windet sich ein letztes Mal und liegt still.' },
];

export function monstersOfLevel(level: number): MonsterDef[] {
  return MONSTERS.filter((m) => m.level === level);
}

export function monsterById(id: string): MonsterDef | undefined {
  return MONSTERS.find((m) => m.id === id);
}

export const DRAGON: MonsterDef = {
  id: 'dragon',
  name: 'Brackenwyrm',
  level: 18,
  shape: 'dragon',
  scale: 1,
  eyes: '#ffcf5a',
  intro: 'Die Farne der Schlucht heben sich wie ein Atemzug. Dann öffnet der Brackenwyrm die Augen.',
  hits: 'speit grünes Feuer',
  falls: 'Der Brackenwyrm bäumt sich ein letztes Mal auf. Dann sinkt er in die Farne, und der ganze Wald atmet aus.',
};

// Grammatisches Geschlecht für Artikel im Kampftext.
const GENDER: Record<string, 'm' | 'f' | 'n'> = {
  moosratte: 'f', stechmuecken: 'm', wurzelgnom: 'm', borkenwolf: 'm', dornenkaefer: 'm', pilzling: 'm',
  sumpfkroete: 'f', kraehe: 'f', wilderer: 'm', keiler: 'm', nebelweberin: 'f', irrlicht: 'n',
  huegelkobold: 'm', moorschlange: 'f', eulenbaer: 'm', rudelfuehrer: 'm', rindenspinne: 'f',
  raeuberhauptmann: 'm', steintroll: 'm', geisterhirsch: 'm', sumpfschleim: 'm', schattenluchs: 'm',
  riesenfledermaus: 'f', waldschrat: 'm', hoehlenbaer: 'm', giftnatter: 'f', klingenwilderer: 'm',
  grabwicht: 'm', moortroll: 'm', eisenkaefer: 'm', nachtmahr: 'm', wurzelriese: 'm', felsenkeiler: 'm',
  harpyie: 'f', knochenritter: 'm', dornengolem: 'm', wyrmling: 'm', sturmrabe: 'm', waldhexe: 'f',
  eichenhueter: 'm', schattenwolf: 'm', steinwurm: 'm', farngeist: 'm', trollkoenig: 'm', wyrmwaechter: 'm',
  dragon: 'm',
};

/** "der Borkenwolf", "die Moosratte", "das Irrlicht" (Nominativ). */
export function nom(id: string, name: string): string {
  const g = GENDER[id];
  if (!g) return name;
  return (g === 'm' ? 'der ' : g === 'f' ? 'die ' : 'das ') + name;
}

/** "den Borkenwolf", "die Moosratte", "das Irrlicht" (Akkusativ). */
export function acc(id: string, name: string): string {
  const g = GENDER[id];
  if (!g) return name;
  return (g === 'm' ? 'den ' : g === 'f' ? 'die ' : 'das ') + name;
}
