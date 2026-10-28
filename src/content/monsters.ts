import type { MonsterDef } from '../game/types';
import { FESTE_FOES } from './feste';

import { lang, t } from '../i18n';

// Fünf Gegner pro Stufe. Eigene Welt: der Brackenwald rund um das Dorf Moosgrund.

export const MONSTERS: MonsterDef[] = [
  // Stufe 1
  { id: 'moosratte', name: t('Moosratte'), level: 1, shape: 'rat', scale: 0.8, eyes: '#f3c06a',
    intro: t('Eine Moosratte stellt sich dir in den Weg. Sie ist erstaunlich überzeugt von sich.'),
    hits: t('knabbert an deinem Stiefel'), falls: t('Die Moosratte quiekt beleidigt und verschwindet unter einer Wurzel.') },
  { id: 'stechmuecken', name: t('Stechmückenschwarm'), level: 1, shape: 'bat', scale: 0.7, eyes: '#e9dfc3',
    intro: t('Ein Schwarm Stechmücken summt dir ein unfreundliches Lied.'),
    hits: t('sticht dich an siebzehn Stellen gleichzeitig'), falls: t('Der Schwarm löst sich in beleidigtes Summen auf.') },
  { id: 'wurzelgnom', name: t('Wurzelgnom'), level: 1, shape: 'goblin', prop: 'club', scale: 0.75, eyes: '#f3c06a',
    intro: t('Ein Wurzelgnom springt aus dem Laub und fordert Wegzoll.'),
    hits: t('haut dir seine Knolle gegen das Schienbein'), falls: t('Der Wurzelgnom gräbt sich murrend ein.') },
  { id: 'laubwurm', name: t('Laubwurm'), level: 1, shape: 'serpent', scale: 0.6, eyes: '#c8e07a',
    intro: t('Ein fetter Laubwurm windet sich aus dem Laub und faucht dich an. Ja, er faucht.'),
    hits: t('spuckt dir modrigen Schleim auf die Hose'), falls: t('Der Laubwurm zieht sich beleidigt unter die Blätter zurück.') },
  { id: 'eichelbold', name: t('Eichelbold'), level: 1, shape: 'goblin', prop: 'spear', scale: 0.6, eyes: '#f3c06a',
    intro: t('Ein Eichelbold mit einer Eichelkappe als Helm droht dir mit einem Zahnstocher.'),
    hits: t('piekst dich mit seinem Zahnstocherspeer'), falls: t('Der Eichelbold kullert davon und versteckt sich unter seiner Kappe.') },

  // Stufe 2
  { id: 'borkenwolf', name: t('Borkenwolf'), level: 2, shape: 'wolf', scale: 0.95, eyes: '#f3c06a',
    intro: t('Ein Borkenwolf bricht aus dem Unterholz. Moos hängt in seinem Fell.'),
    hits: t('beißt zu'), falls: t('Der Borkenwolf sackt ins Farnkraut.') },
  { id: 'dornenkaefer', name: t('Dornenkäfer'), level: 2, shape: 'beetle', scale: 0.8, eyes: '#e9dfc3',
    intro: t('Ein Dornenkäfer so groß wie ein Brotlaib klappert mit den Zangen.'),
    hits: t('zwickt dich mit seinen Zangen'), falls: t('Der Dornenkäfer kippt auf den Rücken und strampelt nicht mehr.') },
  { id: 'pilzling', name: t('Giftpilzling'), level: 2, shape: 'blob', scale: 0.8, eyes: '#c8e07a',
    intro: t('Ein Giftpilzling wackelt auf dich zu und hustet Sporen.'),
    hits: t('pustet dir Sporen ins Gesicht'), falls: t('Der Pilzling fällt in sich zusammen. Es riecht nach Herbst.') },
  { id: 'krallenmarder', name: t('Krallenmarder'), level: 2, shape: 'wolf', scale: 0.75, eyes: '#f3c06a',
    intro: t('Ein Krallenmarder huscht über einen Ast und faucht dich an.'),
    hits: t('kratzt dich mit seinen Krallen'), falls: t('Der Krallenmarder flitzt humpelnd einen Baum hinauf.') },
  { id: 'riesenzecke', name: t('Riesenzecke'), level: 2, shape: 'beetle', scale: 0.75, eyes: '#ff8a6a',
    intro: t('Eine Zecke, so groß wie eine Katze, krabbelt zielstrebig auf dich zu.'),
    hits: t('beißt sich in deinem Bein fest'), falls: t('Die Riesenzecke platzt. Lieber nicht hinsehen.') },

  // Stufe 3
  { id: 'sumpfkroete', name: t('Sumpfkröte'), level: 3, shape: 'blob', scale: 1.0, eyes: '#f3c06a',
    intro: t('Eine Sumpfkröte, groß wie ein Fass, blinzelt dich hungrig an.'),
    hits: t('schleudert dir ihre Zunge entgegen'), falls: t('Die Sumpfkröte rollt sich mit einem letzten Quaken zur Seite.') },
  { id: 'kraehe', name: t('Galgenkrähe'), level: 3, shape: 'bird', scale: 0.85, eyes: '#e9dfc3',
    intro: t('Eine Galgenkrähe kreist über dir und lacht heiser.'),
    hits: t('hackt nach deinen Augen'), falls: t('Die Galgenkrähe flattert taumelnd ins Dickicht.') },
  { id: 'wilderer', name: t('Wilderer'), level: 3, shape: 'humanoid', prop: 'bow', scale: 0.95, eyes: '#f3c06a',
    intro: t('Ein Wilderer tritt hinter einem Baum hervor. „Das ist mein Wald.“'),
    hits: t('trifft dich mit einem Pfeil'), falls: t('Der Wilderer wirft seinen Bogen weg und rennt.') },
  { id: 'moorhund', name: t('Moorhund'), level: 3, shape: 'wolf', scale: 0.9, eyes: '#c8e07a',
    intro: t('Ein Moorhund mit triefendem Fell knurrt dich an. Er riecht nach Torf und schlechten Absichten.'),
    hits: t('schnappt nach deiner Wade'), falls: t('Der Moorhund jault und verschwindet im Schilf.') },
  { id: 'raubwels', name: t('Raubwels'), level: 3, shape: 'blob', scale: 1.0, eyes: '#f3c06a',
    intro: t('Aus einem Tümpel schnellt ein Raubwels mit Schnurrbart und schlechter Laune.'),
    hits: t('schlägt dir mit der Schwanzflosse ins Gesicht'), falls: t('Der Raubwels plumpst zurück in seinen Tümpel.') },

  // Stufe 4
  { id: 'keiler', name: t('Wildkeiler'), level: 4, shape: 'boar', scale: 1.0, eyes: '#f3c06a',
    intro: t('Ein Wildkeiler scharrt mit den Hufen. Er hat schlechte Laune und Hauer.'),
    hits: t('rammt dich mit den Hauern'), falls: t('Der Wildkeiler bricht schnaubend zusammen.') },
  { id: 'nebelweberin', name: t('Nebelweberin'), level: 4, shape: 'spider', scale: 0.95, eyes: '#c8e07a',
    intro: t('Zwischen zwei Fichten spannt eine Nebelweberin ihr Netz. Für dich.'),
    hits: t('beißt dich mit ihren Klauen'), falls: t('Die Nebelweberin zieht sich in ihren Faden zurück und bleibt hängen.') },
  { id: 'irrlicht', name: t('Irrlicht'), level: 4, shape: 'ghost', scale: 0.75, eyes: '#bfe3ff',
    intro: t('Ein Irrlicht tanzt vor dir. Es möchte, dass du ihm folgst. Lieber nicht.'),
    hits: t('versengt dich mit kaltem Feuer'), falls: t('Das Irrlicht flackert und erlischt.') },
  { id: 'dornenfuchs', name: t('Dornenfuchs'), level: 4, shape: 'wolf', scale: 0.9, eyes: '#ff8a6a',
    intro: t('Ein Fuchs mit Dornen statt Fell schleicht um dich herum.'),
    hits: t('beißt zu und lässt ein paar Dornen in dir stecken'), falls: t('Der Dornenfuchs rollt sich zusammen und rührt sich nicht mehr.') },
  { id: 'vogelscheuche', name: t('Vogelscheuche'), level: 4, shape: 'humanoid', prop: 'staff', scale: 1.0, eyes: '#ffcf5a',
    intro: t('Eine Vogelscheuche steigt von ihrem Pfahl und dreht den Kürbiskopf zu dir.'),
    hits: t('schlägt mit ihren Strohhänden zu'), falls: t('Die Vogelscheuche fällt in sich zusammen. Übrig bleibt ein Haufen Stroh.') },

  // Stufe 5
  { id: 'huegelkobold', name: t('Hügelkobold'), level: 5, shape: 'goblin', prop: 'spear', scale: 0.95, eyes: '#f3c06a',
    intro: t('Ein Hügelkobold fuchtelt mit einem rostigen Speer.'),
    hits: t('sticht mit dem Speer zu'), falls: t('Der Hügelkobold kollert den Hang hinunter.') },
  { id: 'moorschlange', name: t('Moorschlange'), level: 5, shape: 'serpent', scale: 0.9, eyes: '#c8e07a',
    intro: t('Eine Moorschlange richtet sich aus dem Schilf auf.'),
    hits: t('schlägt ihre Giftzähne in deinen Arm'), falls: t('Die Moorschlange gleitet leblos ins Wasser zurück.') },
  { id: 'eulenbaer', name: t('Eulenbär'), level: 5, shape: 'bear', scale: 0.95, eyes: '#f3c06a',
    intro: t('Ein Eulenbär. Halb Eule, halb Bär, ganz wütend.'),
    hits: t('schlägt mit der Tatze zu'), falls: t('Der Eulenbär plumpst um. „Huhu“, macht er noch.') },
  { id: 'schreckreiher', name: t('Schreckreiher'), level: 5, shape: 'bird', scale: 1.0, eyes: '#f3c06a',
    intro: t('Ein grauer Riesenreiher stakst aus dem Schilf und mustert dich wie einen Frosch.'),
    hits: t('hackt mit dem langen Schnabel zu'), falls: t('Der Schreckreiher flattert krächzend davon.') },
  { id: 'pilzschamane', name: t('Pilzschamane'), level: 5, shape: 'goblin', prop: 'staff', scale: 0.9, eyes: '#c8e07a',
    intro: t('Ein Kobold mit Pilzhut murmelt Beschwörungen und wirft mit glühenden Sporen.'),
    hits: t('bläst dir glühende Sporen ins Gesicht'), falls: t('Der Pilzschamane verpufft in einer Sporenwolke.') },

  // Stufe 6
  { id: 'rudelfuehrer', name: t('Rudelführer'), level: 6, shape: 'wolf', scale: 1.1, eyes: '#ffcf5a',
    intro: t('Der graue Rudelführer heult. Irgendwo antworten andere.'),
    hits: t('reißt dich mit den Fängen'), falls: t('Der Rudelführer fällt. Das Heulen ringsum verstummt.') },
  { id: 'rindenspinne', name: t('Rindenspinne'), level: 6, shape: 'spider', scale: 1.1, eyes: '#ffcf5a',
    intro: t('Was du für einen Baumstumpf gehalten hast, hat acht Beine.'),
    hits: t('spritzt dir Harzgift entgegen'), falls: t('Die Rindenspinne erstarrt. Jetzt ist sie wirklich ein Baumstumpf.') },
  { id: 'raeuberhauptmann', name: t('Räuberhauptmann'), level: 6, shape: 'humanoid', prop: 'axe', scale: 1.05, eyes: '#f3c06a',
    intro: t('„Gold oder Leben!“ ruft der Räuberhauptmann. Du entscheidest dich für ein Drittes.'),
    hits: t('schwingt seine Axt'), falls: t('Der Räuberhauptmann flieht und lässt seinen Hut zurück.') },
  { id: 'ertrunkener', name: t('Ertrunkener'), level: 6, shape: 'ghost', scale: 1.0, eyes: '#bfe3ff',
    intro: t('Ein Ertrunkener steigt aus dem Moorloch, Algen im Haar.'),
    hits: t('packt dich mit eiskalten, nassen Händen'), falls: t('Der Ertrunkene sinkt zurück ins Moor, diesmal für immer.') },
  { id: 'elchbulle', name: t('Elchbulle'), level: 6, shape: 'stag', scale: 1.15, eyes: '#f3c06a',
    intro: t('Ein riesiger Elchbulle senkt das Geweih. Du stehst in seinem Revier.'),
    hits: t('rammt dich mit seinem Schaufelgeweih'), falls: t('Der Elchbulle knickt in die Knie und bleibt liegen.') },

  // Stufe 7
  { id: 'steintroll', name: t('Steintroll'), level: 7, shape: 'troll', scale: 1.0, eyes: '#f3c06a',
    intro: t('Ein Steintroll erhebt sich aus dem Geröll und streckt sich.'),
    hits: t('drischt mit seiner Faust auf dich ein'), falls: t('Der Steintroll erstarrt mitten in der Bewegung zu einem Felsen.') },
  { id: 'geisterhirsch', name: t('Geisterhirsch'), level: 7, shape: 'stag', scale: 1.05, eyes: '#bfe3ff',
    intro: t('Ein Geisterhirsch steht reglos auf der Lichtung. Sein Atem ist Nebel.'),
    hits: t('stößt dich mit seinem Geweih'), falls: t('Der Geisterhirsch verblasst im Mondlicht.') },
  { id: 'sumpfschleim', name: t('Sumpfschleim'), level: 7, shape: 'blob', scale: 1.15, eyes: '#c8e07a',
    intro: t('Der Boden blubbert. Dann steht er auf.'),
    hits: t('verschluckt deinen Arm und spuckt ihn wieder aus'), falls: t('Der Sumpfschleim versickert zischend im Moos.') },
  { id: 'moorschmuggler', name: t('Moorschmuggler'), level: 7, shape: 'humanoid', prop: 'daggers', scale: 1.0, eyes: '#f3c06a',
    intro: t('Ein Schmuggler mit schwerem Rucksack zieht zwei Dolche. „Du hast nichts gesehen.“'),
    hits: t('sticht mit beiden Dolchen zu'), falls: t('Der Schmuggler wirft seinen Rucksack weg und verschwindet im Nebel.') },
  { id: 'hornissenschwarm', name: t('Hornissenschwarm'), level: 7, shape: 'bat', scale: 1.0, eyes: '#ffcf5a',
    intro: t('Ein Hornissennest fällt vom Baum, und sein Inhalt ist sehr wütend.'),
    hits: t('sticht dich, und sticht, und sticht'), falls: t('Die Hornissen geben auf und summen beleidigt davon.') },

  // Stufe 8
  { id: 'schattenluchs', name: t('Schattenluchs'), level: 8, shape: 'wolf', scale: 0.95, eyes: '#c8e07a',
    intro: t('Du siehst den Schattenluchs erst, als er schon springt.'),
    hits: t('schlägt seine Krallen in deine Schulter'), falls: t('Der Schattenluchs verschwindet zwischen den Stämmen. Diesmal für immer.') },
  { id: 'riesenfledermaus', name: t('Riesenfledermaus'), level: 8, shape: 'bat', scale: 1.2, eyes: '#ff8a6a',
    intro: t('Eine Riesenfledermaus verdunkelt kurz den Mond.'),
    hits: t('schlägt dich mit ledrigen Schwingen'), falls: t('Die Riesenfledermaus trudelt zu Boden.') },
  { id: 'waldschrat', name: t('Waldschrat'), level: 8, shape: 'treant', scale: 0.95, eyes: '#f3c06a',
    intro: t('Ein Waldschrat knarzt. Er findet, du stehst auf seinem Fuß.'),
    hits: t('peitscht dich mit Ästen'), falls: t('Der Waldschrat seufzt und schlägt Wurzeln.') },
  { id: 'hoehlenmolch', name: t('Höhlenmolch'), level: 8, shape: 'serpent', scale: 1.1, eyes: '#ffffff',
    intro: t('Ein blasser Riesenmolch kriecht aus einer Felsspalte. Er hat keine Augen, aber er riecht dich.'),
    hits: t('schnappt mit seinem breiten Maul zu'), falls: t('Der Höhlenmolch gleitet zurück in die Dunkelheit.') },
  { id: 'schwarzschuetzin', name: t('Schwarzschützin'), level: 8, shape: 'humanoid', prop: 'bow', scale: 1.0, eyes: '#ff8a6a',
    intro: t('Eine Schützin in schwarzem Leder lässt ihren Bogen sinken. „Zu langsam“, sagt sie, und spannt ihn wieder.'),
    hits: t('trifft dich mit einem schwarz gefiederten Pfeil'), falls: t('Die Schwarzschützin verschwindet zwischen den Bäumen, so lautlos, wie sie kam.') },

  // Stufe 9
  { id: 'hoehlenbaer', name: t('Höhlenbär'), level: 9, shape: 'bear', scale: 1.2, eyes: '#f3c06a',
    intro: t('Ein Höhlenbär wurde aus dem Winterschlaf geweckt. Von dir, meint er.'),
    hits: t('zerkratzt dich mit seinen Pranken'), falls: t('Der Höhlenbär legt sich hin und schläft weiter. Endgültig.') },
  { id: 'giftnatter', name: t('Aschenatter'), level: 9, shape: 'serpent', scale: 1.05, eyes: '#ff8a6a',
    intro: t('Eine Aschenatter zischt. Wo sie kriecht, verdorrt das Gras.'),
    hits: t('beißt dich mit glühenden Zähnen'), falls: t('Die Aschenatter zerfällt zu grauem Staub.') },
  { id: 'klingenwilderer', name: t('Klingenwilderin'), level: 9, shape: 'humanoid', prop: 'daggers', scale: 1.0, eyes: '#f3c06a',
    intro: t('Eine Klingenwilderin wirbelt zwei Messer. Sie hat dich schon länger beobachtet.'),
    hits: t('schneidet dich mit ihren Messern'), falls: t('Die Klingenwilderin verliert ihre Messer und dann die Nerven.') },
  { id: 'schlickhydra', name: t('Schlickhydra'), level: 9, shape: 'serpent', scale: 1.15, eyes: '#c8e07a',
    intro: t('Drei Köpfe auf drei Hälsen erheben sich aus dem Schlick. Alle drei sehen hungrig aus.'),
    hits: t('beißt dich mit gleich zwei Köpfen'), falls: t('Die Schlickhydra sinkt zurück. Alle drei Köpfe gleichzeitig.') },
  { id: 'borkenoger', name: t('Borkenoger'), level: 9, shape: 'troll', prop: 'club', scale: 1.15, eyes: '#f3c06a',
    intro: t('Ein Oger mit Haut wie Baumrinde reißt einen jungen Baum aus und benutzt ihn als Keule.'),
    hits: t('drischt mit dem Baumstamm auf dich ein'), falls: t('Der Borkenoger fällt um wie eine gefällte Eiche.') },

  // Stufe 10
  { id: 'grabwicht', name: t('Grabwicht'), level: 10, shape: 'ghost', scale: 1.0, eyes: '#bfe3ff',
    intro: t('Aus einem alten Hügelgrab steigt ein Grabwicht und flüstert deinen Namen.'),
    hits: t('berührt dich mit eisigen Fingern'), falls: t('Der Grabwicht sinkt zurück in seinen Hügel.') },
  { id: 'moortroll', name: t('Moortroll'), level: 10, shape: 'troll', scale: 1.15, eyes: '#c8e07a',
    intro: t('Ein Moortroll watet auf dich zu. Er riecht, wie er aussieht.'),
    hits: t('wirft dich in den Schlamm'), falls: t('Der Moortroll versinkt blubbernd im Sumpf.') },
  { id: 'eisenkaefer', name: t('Eisenkäfer'), level: 10, shape: 'beetle', scale: 1.15, eyes: '#ff8a6a',
    intro: t('Ein Eisenkäfer rasselt heran. Sein Panzer klingt wie eine Rüstung.'),
    hits: t('quetscht dich mit seinen Zangen'), falls: t('Der Eisenkäfer bleibt mit einem rostigen Klonk liegen.') },
  { id: 'wiedergaenger', name: t('Wiedergänger'), level: 10, shape: 'humanoid', prop: 'sword', scale: 1.05, eyes: '#bfe3ff',
    intro: t('Ein Wiedergänger in rostiger Rüstung stapft aus einem Hügelgrab.'),
    hits: t('schlägt mit seinem schartigen Schwert zu'), falls: t('Der Wiedergänger zerfällt, und seine Rüstung scheppert leer zu Boden.') },
  { id: 'kristallspinne', name: t('Kristallspinne'), level: 10, shape: 'spider', scale: 1.15, eyes: '#bfe3ff',
    intro: t('Eine Spinne aus glitzerndem Kristall klirrt über die Felsen.'),
    hits: t('schneidet dich mit gläsernen Beinen'), falls: t('Die Kristallspinne zerspringt in tausend funkelnde Splitter.') },

  // Stufe 11
  { id: 'nachtmahr', name: t('Nachtmahr'), level: 11, shape: 'stag', scale: 1.1, eyes: '#ff8a6a',
    intro: t('Ein Nachtmahr stampft aus dem Nebel. Seine Hufe berühren den Boden nicht.'),
    hits: t('tritt dich mit Hufen aus Rauch'), falls: t('Der Nachtmahr zerfließt wie ein schlechter Traum.') },
  { id: 'wurzelriese', name: t('Wurzelriese'), level: 11, shape: 'treant', scale: 1.2, eyes: '#f3c06a',
    intro: t('Der Boden bebt. Ein Wurzelriese zieht seine Füße aus der Erde.'),
    hits: t('zermalmt dich mit Wurzelfäusten'), falls: t('Der Wurzelriese kippt um wie eine alte Eiche.') },
  { id: 'felsenkeiler', name: t('Felsenkeiler'), level: 11, shape: 'boar', scale: 1.25, eyes: '#ff8a6a',
    intro: t('Ein Felsenkeiler. Seine Borsten sind aus Stein, seine Laune auch.'),
    hits: t('überrennt dich'), falls: t('Der Felsenkeiler kracht gegen einen Baum und bleibt liegen.') },
  { id: 'nachtgreif', name: t('Nachtgreif'), level: 11, shape: 'bird', scale: 1.25, eyes: '#ff8a6a',
    intro: t('Ein Greif mit Federn, schwarz wie die Nacht, stößt aus den Wolken herab.'),
    hits: t('reißt dich mit seinen Klauen'), falls: t('Der Nachtgreif stürzt in die Baumkronen.') },
  { id: 'dornendruide', name: t('Dornendruide'), level: 11, shape: 'humanoid', prop: 'staff', scale: 1.05, eyes: '#c8e07a',
    intro: t('Ein Druide, dem Dornen aus der Haut wachsen, ruft die Ranken gegen dich.'),
    hits: t('lässt Dornenranken nach dir peitschen'), falls: t('Der Dornendruide verwurzelt sich und wird zu einem stillen Busch.') },

  // Stufe 12
  { id: 'harpyie', name: t('Harpyie'), level: 12, shape: 'bird', scale: 1.2, eyes: '#ff8a6a',
    intro: t('Eine Harpyie kreischt vom Felsen. Sie hat Hunger und schlechte Manieren.'),
    hits: t('schlägt ihre Krallen in deinen Rücken'), falls: t('Die Harpyie stürzt kreischend in die Tiefe.') },
  { id: 'knochenritter', name: t('Knochenritter'), level: 12, shape: 'humanoid', prop: 'sword', scale: 1.1, eyes: '#bfe3ff',
    intro: t('Ein Knochenritter salutiert. Dann zieht er sein Schwert.'),
    hits: t('trifft dich mit seiner rostigen Klinge'), falls: t('Der Knochenritter fällt klappernd in sich zusammen.') },
  { id: 'dornengolem', name: t('Dornengolem'), level: 12, shape: 'troll', scale: 1.2, eyes: '#c8e07a',
    intro: t('Ein Golem aus Brombeerranken und Zorn versperrt den Pfad.'),
    hits: t('umschlingt dich mit Dornen'), falls: t('Der Dornengolem zerfällt zu einem Haufen Gestrüpp.') },
  { id: 'steinblickechse', name: t('Steinblickechse'), level: 12, shape: 'serpent', scale: 1.2, eyes: '#e9dfc3',
    intro: t('Eine Echse mit grauen Augen. Wo sie hinsieht, wird das Moos zu Stein.'),
    hits: t('beißt zu, und deine Hand wird für einen Moment schwer wie Stein'), falls: t('Die Steinblickechse erstarrt selbst zu Stein.') },
  { id: 'frostbaer', name: t('Frostbär'), level: 12, shape: 'bear', scale: 1.3, eyes: '#bfe3ff',
    intro: t('Ein weißer Bär, dessen Atem Raureif auf die Farne malt.'),
    hits: t('schlägt mit eisigen Pranken zu'), falls: t('Der Frostbär legt sich in den Schnee, den er selbst gemacht hat.') },

  // Stufe 13
  { id: 'wyrmling', name: t('Wyrmling'), level: 13, shape: 'serpent', scale: 1.2, eyes: '#ffcf5a',
    intro: t('Ein junger Wyrmling. Irgendwo muss seine Mutter sein.'),
    hits: t('speit dir Funken ins Gesicht'), falls: t('Der Wyrmling rollt sich zusammen und rührt sich nicht mehr.') },
  { id: 'sturmrabe', name: t('Sturmrabe'), level: 13, shape: 'bird', scale: 1.3, eyes: '#bfe3ff',
    intro: t('Der Wind dreht. Ein Sturmrabe landet auf einem Ast, der unter ihm bricht.'),
    hits: t('schleudert dich mit einem Flügelschlag zu Boden'), falls: t('Der Sturmrabe verweht wie eine Gewitterwolke.') },
  { id: 'waldhexe', name: t('Waldhexe'), level: 13, shape: 'humanoid', prop: 'staff', scale: 1.0, eyes: '#c8e07a',
    intro: t('Eine Waldhexe kichert. „Du kommst mir gerade recht.“'),
    hits: t('verflucht dich'), falls: t('Die Waldhexe verwandelt sich in eine Kröte und hüpft davon.') },
  { id: 'schattenreiter', name: t('Schattenreiter'), level: 13, shape: 'horse', scale: 1.25, eyes: '#ff6b5e',
    intro: t('Ein Reiter ohne Gesicht auf einem Pferd aus Rauch galoppiert auf dich zu.'),
    hits: t('trifft dich im Vorbeireiten mit seiner Klinge'), falls: t('Schattenreiter und Pferd zerfließen zu Nebel.') },
  { id: 'moorriese', name: t('Moorriese'), level: 13, shape: 'troll', scale: 1.35, eyes: '#c8e07a',
    intro: t('Ein Riese aus Torf und Schilf erhebt sich aus dem Moor. Frösche sitzen auf seinen Schultern.'),
    hits: t('begräbt dich unter einer Faust voll Schlamm'), falls: t('Der Moorriese zerfällt zu einem Hügel aus Torf. Die Frösche hüpfen davon.') },

  // Stufe 14
  { id: 'eichenhueter', name: t('Eichenhüter'), level: 14, shape: 'treant', scale: 1.35, eyes: '#ffcf5a',
    intro: t('Der Eichenhüter ist älter als das Dorf. Er erinnert sich an jeden gefällten Baum.'),
    hits: t('schmettert dich mit seinem Stamm'), falls: t('Der Eichenhüter neigt sich und wird still.') },
  { id: 'schattenwolf', name: t('Schattenwolf'), level: 14, shape: 'wolf', scale: 1.3, eyes: '#ff6b5e',
    intro: t('Ein Schattenwolf wächst aus der Dunkelheit zwischen den Bäumen.'),
    hits: t('zerfetzt dich mit Zähnen aus Nacht'), falls: t('Der Schattenwolf zerfasert wie Rauch.') },
  { id: 'steinwurm', name: t('Steinwurm'), level: 14, shape: 'serpent', scale: 1.35, eyes: '#ff8a6a',
    intro: t('Felsen bewegen sich. Ein Steinwurm windet sich aus der Klamm.'),
    hits: t('zermalmt dich in seinen Windungen'), falls: t('Der Steinwurm erstarrt zu einem neuen Bergrücken.') },
  { id: 'glutgeweih', name: t('Glutgeweih'), level: 14, shape: 'stag', scale: 1.3, eyes: '#ffcf5a',
    intro: t('Ein Hirsch, dessen Geweih glüht wie ein Schmiedefeuer.'),
    hits: t('spießt dich mit seinem glühenden Geweih auf'), falls: t('Das Glutgeweih erlischt, und der Hirsch sinkt zu Boden.') },
  { id: 'wyrmpriesterin', name: t('Wyrmpriesterin'), level: 14, shape: 'humanoid', prop: 'staff', scale: 1.05, eyes: '#c8e07a',
    intro: t('Eine Priesterin in einer Robe aus Schuppen singt dem schlafenden Wyrm ein Wiegenlied. Du störst.'),
    hits: t('schleudert dir grünes Feuer entgegen'), falls: t('Die Wyrmpriesterin verstummt mitten im Lied und sinkt nieder.') },

  // Stufe 15
  { id: 'farngeist', name: t('Farngeist'), level: 15, shape: 'ghost', scale: 1.3, eyes: '#c8e07a',
    intro: t('Die Farne flüstern. Dann formen sie ein Gesicht.'),
    hits: t('erstickt dich mit grünem Nebel'), falls: t('Der Farngeist sinkt zurück ins Grün.') },
  { id: 'trollkoenig', name: t('Bergtrollkönig'), level: 15, shape: 'troll', scale: 1.4, eyes: '#ffcf5a',
    intro: t('Der Bergtrollkönig trägt eine Krone aus Felsbrocken. Sie steht ihm nicht.'),
    hits: t('zerschmettert dich mit seiner Keule'), falls: t('Der Bergtrollkönig stürzt. Seine Krone rollt davon.') },
  { id: 'wyrmwaechter', name: t('Wyrmwächter'), level: 15, shape: 'serpent', scale: 1.45, eyes: '#ff6b5e',
    intro: t('Ein Wyrmwächter bewacht den Pfad zur Farnschlucht. Er riecht deinen Mut.'),
    hits: t('peitscht dich mit seinem Schwanz'), falls: t('Der Wyrmwächter windet sich ein letztes Mal und liegt still.') },
  { id: 'urkeiler', name: t('Urkeiler'), level: 15, shape: 'boar', scale: 1.45, eyes: '#ff6b5e',
    intro: t('Ein Keiler so groß wie ein Heuwagen. Seine Hauer sind älter als das Dorf.'),
    hits: t('nimmt dich auf die Hauer und schleudert dich durch die Luft'), falls: t('Der Urkeiler bricht zusammen. Der Boden bebt noch eine Weile.') },
  { id: 'nachtkoenigin', name: t('Nachtkönigin'), level: 15, shape: 'ghost', scale: 1.35, eyes: '#bfe3ff',
    intro: t('Eine Gestalt aus Sternenlicht und Dunkelheit schwebt über der Lichtung. Die Vögel verstummen.'),
    hits: t('berührt dich, und dir wird kalt bis ins Herz'), falls: t('Die Nachtkönigin zerstiebt wie ein Schwarm Glühwürmchen.') },
];

export function monstersOfLevel(level: number): MonsterDef[] {
  return MONSTERS.filter((m) => m.level === level);
}

export function monsterById(id: string): MonsterDef | undefined {
  return MONSTERS.find((m) => m.id === id) ?? FESTE_FOES.find((m) => m.id === id);
}

export const DRAGON: MonsterDef = {
  id: 'dragon',
  name: t('Brackenwyrm'),
  level: 18,
  shape: 'dragon',
  scale: 1,
  eyes: '#ffcf5a',
  intro: t('Die Farne der Schlucht heben sich wie ein Atemzug. Dann öffnet der Brackenwyrm die Augen.'),
  hits: t('speit grünes Feuer'),
  falls: t('Der Brackenwyrm bäumt sich ein letztes Mal auf. Dann sinkt er in die Farne, und der ganze Wald atmet aus.'),
};

// Grammatisches Geschlecht für Artikel im Kampftext.
const GENDER: Record<string, 'm' | 'f' | 'n'> = {
  kellerratte: 'f', fledermausschwarm: 'm', farnspinne: 'f', moderskelett: 'n', gewoelbegeist: 'm', wyrmjaeger: 'm',
  moosratte: 'f', stechmuecken: 'm', wurzelgnom: 'm', borkenwolf: 'm', dornenkaefer: 'm', pilzling: 'm',
  sumpfkroete: 'f', kraehe: 'f', wilderer: 'm', keiler: 'm', nebelweberin: 'f', irrlicht: 'n',
  huegelkobold: 'm', moorschlange: 'f', eulenbaer: 'm', rudelfuehrer: 'm', rindenspinne: 'f',
  raeuberhauptmann: 'm', steintroll: 'm', geisterhirsch: 'm', sumpfschleim: 'm', schattenluchs: 'm',
  riesenfledermaus: 'f', waldschrat: 'm', hoehlenbaer: 'm', giftnatter: 'f', klingenwilderer: 'f',
  grabwicht: 'm', moortroll: 'm', eisenkaefer: 'm', nachtmahr: 'm', wurzelriese: 'm', felsenkeiler: 'm',
  harpyie: 'f', knochenritter: 'm', dornengolem: 'm', wyrmling: 'm', sturmrabe: 'm', waldhexe: 'f',
  eichenhueter: 'm', schattenwolf: 'm', steinwurm: 'm', farngeist: 'm', trollkoenig: 'm', wyrmwaechter: 'm',
  // neue Gegner ab 0.45
  'laubwurm': 'm', 'eichelbold': 'm', 'krallenmarder': 'm', 'riesenzecke': 'f', 'moorhund': 'm', 'raubwels': 'm', 'dornenfuchs': 'm', 'vogelscheuche': 'f', 'schreckreiher': 'm', 'pilzschamane': 'm', 'ertrunkener': 'm', 'elchbulle': 'm', 'moorschmuggler': 'm', 'hornissenschwarm': 'm', 'hoehlenmolch': 'm', 'schwarzschuetzin': 'f', 'schlickhydra': 'f', 'borkenoger': 'm', 'wiedergaenger': 'm', 'kristallspinne': 'f', 'nachtgreif': 'm', 'dornendruide': 'm', 'steinblickechse': 'f', 'frostbaer': 'm', 'schattenreiter': 'm', 'moorriese': 'm', 'glutgeweih': 'm', 'wyrmpriesterin': 'f', 'urkeiler': 'm', 'nachtkoenigin': 'f',
  dragon: 'm',
  // Schattenreich
  'verirrte-seele': 'f', faehrmann: 'm', schattenhund: 'm', knochenkraehe: 'f', 'klagende-witwe': 'f', nebelschlund: 'm',
};

/** "der Borkenwolf", "die Moosratte", "das Irrlicht" (Nominativ). */
export function nom(id: string, name: string): string {
  const g = GENDER[id];
  if (!g) return name;
  if (lang === 'en') return 'the ' + name;
  return (g === 'm' ? 'der ' : g === 'f' ? 'die ' : 'das ') + name;
}

/** "einem Borkenwolf", "einer Moosratte", "einem Irrlicht" (Dativ, unbestimmt). */
export function datIndef(id: string, name: string): string {
  if (lang === 'en') return GENDER[id] ? (/^[aeiouAEIOU]/.test(name) ? 'an ' : 'a ') + name : name;
  return (GENDER[id] === 'f' ? 'einer ' : 'einem ') + name;
}

/** "den Borkenwolf", "die Moosratte", "das Irrlicht" (Akkusativ). */
export function acc(id: string, name: string): string {
  const g = GENDER[id];
  if (!g) return name;
  if (lang === 'en') return 'the ' + name;
  return (g === 'm' ? 'den ' : g === 'f' ? 'die ' : 'das ') + name;
}
