import type { Buff, Player, PropId, SpecialtyId } from '../game/types';

import { t } from '../i18n';

// Die drei Fähigkeiten: Totenbeschwörung, Wildmagie, Schurkenkunst (ids bleiben dunkel, mystik, dieb).
// Jede hat vier Künste, die 1, 2, 3 oder 5 Punkte kosten. Punkte pro Tag: 1 + ein Drittel der Fähigkeitsstufe.
// Die Fähigkeitsstufe steigt mit jedem besiegten Meister und fällt nach dem Drachen wieder auf 0.
// Texte: {a} = Gegner im Akkusativ, {N} = Gegner groß geschrieben, {d} = Zahl.

export interface SkillDef {
  cost: 1 | 2 | 3 | 5;
  name: string;
  blurb: string;
  start: string;
  buff: (p: Player, atk: number) => Buff;
}

export interface SpecialtyDef {
  id: SpecialtyId;
  name: string;
  /** Was man als Kind gemacht hat */
  childhood: string;
  blurb: string;
  heroProp: PropId;
  color: string;
  skills: SkillDef[];
}

export const SPECIALTIES: Record<SpecialtyId, SpecialtyDef> = {
  dunkel: {
    id: 'dunkel',
    name: t('Totenbeschwörung'),
    childhood: t('Nachts auf dem Friedhof gespielt'),
    blurb: t('Die anderen Kinder machten einen Bogen um den alten Friedhof. Du hast dort deine Freunde gefunden. Seitdem gehorchen dir Knochen, Schatten und manches, das besser unter der Erde geblieben wäre.'),
    heroProp: 'staff',
    color: '#e0605a',
    skills: [
      { cost: 1, name: t('Knochenwacht'), blurb: t('Morsche Gerippe kämpfen 5 Runden lang an deiner Seite.'),
        start: t('Du klopfst dreimal auf den Waldboden. Morsche Gerippe kriechen aus dem Laub und stellen sich gegen {a}.'),
        buff: (p) => ({ id: 'dunkel1', name: t('Knochenwacht'), atkMult: 1, rounds: 5, minions: Math.round(p.level / 3) + 1, minDmg: 0, maxDmg: Math.round(p.level / 2) + 1,
          effectMsg: t('Ein Gerippe schlägt {a} für {d} Schaden.'), missMsg: t('Ein Gerippe stolpert über die eigenen Rippen und verfehlt {a}.'), wearOff: t('Die Gerippe fallen klappernd auseinander.') }) },
      { cost: 2, name: t('Wachsfigur'), blurb: t('Ein einziger, sehr gemeiner Stich.'),
        start: t('Blitzschnell knetest du aus Kerzenwachs ein Figürchen, das {a} verdächtig ähnlich sieht.'),
        buff: (_p, atk) => ({ id: 'dunkel2', name: t('Wachsfigur'), atkMult: 1, rounds: 1, minions: 1, minDmg: Math.round(atk * 1.5), maxDmg: Math.round(atk * 3),
          effectMsg: t('Du drückst der Wachsfigur den Daumen in den Bauch. {N} krümmt sich: {d} Schaden!') }) },
      { cost: 3, name: t('Grabeskälte'), blurb: t('5 Runden lang trifft dich der Gegner nur halb so hart.'),
        start: t('Ein eisiger Hauch aus der Gruft legt sich um {a}.'),
        buff: () => ({ id: 'dunkel3', name: t('Grabeskälte'), atkMult: 1, rounds: 5, foeDmgMult: 0.5,
          roundMsg: t('{N} zittert vor Grabeskälte, die Schläge kommen nur halb so hart.'), wearOff: t('Die Kälte weicht.') }) },
      { cost: 5, name: t('Seelenfessel'), blurb: t('5 Runden lang kann der Gegner weder angreifen noch sich wehren.'),
        start: t('Du flüsterst ein Wort, das kein Lebender kennen sollte. Schwarze Ketten aus Rauch schließen sich um {a}.'),
        buff: () => ({ id: 'dunkel5', name: t('Seelenfessel'), atkMult: 1, rounds: 5, foeAtkMult: 0, foeDefMult: 0,
          roundMsg: t('{N} zerrt an Ketten, die es nicht sehen kann, und kann weder angreifen noch sich wehren.'), wearOff: t('Die Ketten zerfallen zu Rauch.') }) },
    ],
  },
  mystik: {
    id: 'mystik',
    name: t('Wildmagie'),
    childhood: t('Mit den Bäumen geredet'),
    blurb: t('Schon als Kind hast du gemerkt, dass der Wald antwortet, wenn man ihn richtig fragt. Moos, Wurzeln und Gewitter leihen dir ihre Kraft, solange du sie mit Respekt behandelst.'),
    heroProp: 'staff',
    color: '#5ac8e0',
    skills: [
      { cost: 1, name: t('Moosheilung'), blurb: t('5 Runden lang heilst du jede Runde um deine Stufe.'),
        start: t('Weiches, kühles Moos legt sich auf deine Wunden.'),
        buff: (p) => ({ id: 'mystik1', name: t('Moosheilung'), atkMult: 1, rounds: 5, regen: p.level,
          effectMsg: t('Das Moos heilt dich um {d} Lebenspunkte.'), missMsg: t('Das Moos findet keine Wunde und döst vor sich hin.'), wearOff: t('Das Moos trocknet und fällt ab.') }) },
      { cost: 2, name: t('Wurzelpeitsche'), blurb: t('Eine knotige Wurzel schlägt 5 Runden lang mit zu.'),
        start: t('Der Boden reißt auf, und eine knotige Wurzel schnellt auf {a} zu!'),
        buff: (p) => ({ id: 'mystik2', name: t('Wurzelpeitsche'), atkMult: 1, rounds: 5, minions: 1, minDmg: 1, maxDmg: p.level * 3,
          effectMsg: t('Die Wurzel peitscht {a} für {d} Schaden.'), wearOff: t('Die Wurzel zieht sich in die Erde zurück.') }) },
      { cost: 3, name: t('Lebensranke'), blurb: t('5 Runden lang heilt dich jeder deiner Treffer.'),
        start: t('Eine grüne Ranke windet sich um deine Waffe und pulsiert wie ein Herz.'),
        buff: () => ({ id: 'mystik3', name: t('Lebensranke'), atkMult: 1, rounds: 5, lifetap: 1,
          effectMsg: t('Die Ranke trinkt {d} Lebenspunkte aus deinem Gegner und gibt sie dir.'), wearOff: t('Die Ranke welkt und fällt ab.') }) },
      { cost: 5, name: t('Gewittermantel'), blurb: t('5 Runden lang bekommt jeder, der dich trifft, den doppelten Schaden zurück.'),
        start: t('Donner grollt über den Wipfeln, und ein Mantel aus Funken legt sich um deine Schultern.'),
        buff: () => ({ id: 'mystik5', name: t('Gewittermantel'), atkMult: 1, rounds: 5, dmgShield: 2,
          effectMsg: t('Die Funken beißen zurück: {N} nimmt {d} Schaden.'), wearOff: t('Der Gewittermantel verraucht.') }) },
    ],
  },
  dieb: {
    id: 'dieb',
    name: t('Schurkenkunst'),
    childhood: t('Jedem Marktstand etwas mitgehen lassen'),
    blurb: t('Du warst immer schneller als die Dorfwache und leiser als die Katzen auf dem Dach. Im Kampf zählt nicht, wer am stärksten zuschlägt, sondern wer zuerst trifft und wo.'),
    heroProp: 'daggers',
    color: '#e8b85a',
    skills: [
      { cost: 1, name: t('Spott'), blurb: t('5 Runden lang greift der Gegner nur halbherzig an.'),
        start: t('Du machst {a} so treffend nach, dass sogar die Bäume kichern.'),
        buff: () => ({ id: 'dieb1', name: t('Gekränkt'), atkMult: 1, rounds: 5, foeAtkMult: 0.5,
          roundMsg: t('{N} ist gekränkt und schlägt nur halbherzig zu.'), wearOff: t('{N} hat sich wieder im Griff.') }) },
      { cost: 2, name: t('Natternbiss'), blurb: t('5 Runden lang doppelte Angriffskraft.'),
        start: t('Du träufelst einen Tropfen Natterngift auf deine Klinge.'),
        buff: () => ({ id: 'dieb2', name: t('Natternbiss'), atkMult: 2, rounds: 5,
          roundMsg: t('Das Gift brennt in jeder Wunde: doppelte Wucht!'), wearOff: t('Das Gift auf deiner Klinge ist verbraucht.') }) },
      { cost: 3, name: t('Farnversteck'), blurb: t('5 Runden lang findet dich der Gegner nicht.'),
        start: t('Du duckst dich ins Farnkraut und bist plötzlich nur noch ein Rascheln.'),
        buff: () => ({ id: 'dieb3', name: t('Im Farn'), atkMult: 1, rounds: 5, foeAtkMult: 0,
          roundMsg: t('{N} drischt ins Farnkraut und trifft nur Blätter!'), wearOff: t('Du trittst aus dem Farn.') }) },
      { cost: 5, name: t('Schattenstich'), blurb: t('5 Runden lang dreifacher Angriff und dreifache Verteidigung.'),
        start: t('Ein Schritt zur Seite, ein Schritt in den Schatten, und plötzlich stehst du dort, wo {a} dich am wenigsten erwartet.'),
        buff: () => ({ id: 'dieb5', name: t('Schattenstich'), atkMult: 3, defMult: 3, rounds: 5,
          roundMsg: t('Aus dem Schatten triffst du dreifach und bist dreifach schwer zu fassen!'), wearOff: t('Der Schatten gibt dich wieder frei.') }) },
    ],
  },
};

export const SPECIALTY_ORDER: SpecialtyId[] = ['dunkel', 'mystik', 'dieb'];

/** Alte Spielstände (Testversionen bis 0.20) */
export const LEGACY_SPECIALTY: Record<string, SpecialtyId> = { klinge: 'dunkel', wurzel: 'mystik', schleich: 'dieb' };
export const LEGACY_REVERSE: Record<SpecialtyId, string> = { dunkel: 'klinge', mystik: 'wurzel', dieb: 'schleich' };

export function normalizeSpecialty(x: unknown): SpecialtyId {
  if (x === 'dunkel' || x === 'mystik' || x === 'dieb') return x;
  return LEGACY_SPECIALTY[String(x)] ?? 'dunkel';
}
