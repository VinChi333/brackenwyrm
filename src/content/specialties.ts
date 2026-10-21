import type { Buff, Player, PropId, SpecialtyId } from '../game/types';

// Die drei Fähigkeiten wie im Original (Dark Arts, Mystical Powers, Thieving Skills).
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
  /** Was man als Kind gemacht hat (Auswahl wie im Original) */
  childhood: string;
  blurb: string;
  heroProp: PropId;
  color: string;
  skills: SkillDef[];
}

export const SPECIALTIES: Record<SpecialtyId, SpecialtyDef> = {
  dunkel: {
    id: 'dunkel',
    name: 'Dunkle Künste',
    childhood: 'Viele kleine Waldtiere erlegt',
    blurb: 'Als Kind warst du überzeugt, dass die Waldtiere sich gegen dich verschworen hatten. Später verschwandest du tagelang im Wald, und niemand wusste, woher die Geräusche kamen.',
    heroProp: 'staff',
    color: '#e0605a',
    skills: [
      { cost: 1, name: 'Skelettkrieger', blurb: 'Knochenhände greifen 5 Runden lang an.',
        start: 'Du rufst die Geister der Toten. Knochenhände greifen aus dem Waldboden nach {a}.',
        buff: (p) => ({ id: 'dunkel1', name: 'Skelettkrieger', atkMult: 1, rounds: 5, minions: Math.round(p.level / 3) + 1, minDmg: 0, maxDmg: Math.round(p.level / 2) + 1,
          effectMsg: 'Ein untoter Diener trifft {a} für {d} Schaden.', missMsg: 'Ein untoter Diener schlägt nach {a}, verfehlt aber.', wearOff: 'Deine Knochendiener zerfallen zu Staub.' }) },
      { cost: 2, name: 'Voodoo', blurb: 'Ein einzelner, sehr schmerzhafter Nadelstich.',
        start: 'Du ziehst eine kleine Puppe hervor, die genau wie {N} aussieht.',
        buff: (_p, atk) => ({ id: 'dunkel2', name: 'Voodoo', atkMult: 1, rounds: 1, minions: 1, minDmg: Math.round(atk * 1.5), maxDmg: Math.round(atk * 3),
          effectMsg: 'Du stichst eine Nadel in die Puppe. {N} zuckt zusammen: {d} Schaden!' }) },
      { cost: 3, name: 'Ahnenfluch', blurb: 'Der Gegner richtet 5 Runden lang nur halben Schaden an.',
        start: 'Du verfluchst die Ahnen von {a}.',
        buff: () => ({ id: 'dunkel3', name: 'Ahnenfluch', atkMult: 1, rounds: 5, foeDmgMult: 0.5,
          roundMsg: '{N} wankt unter deinem Fluch und richtet nur halben Schaden an.', wearOff: 'Dein Fluch verblasst.' }) },
      { cost: 5, name: 'Seelenwelke', blurb: 'Der Gegner kann 5 Runden lang weder angreifen noch sich wehren.',
        start: 'Du streckst die Hand aus, und {N} beginnt aus den Ohren zu bluten.',
        buff: () => ({ id: 'dunkel5', name: 'Seelenwelke', atkMult: 1, rounds: 5, foeAtkMult: 0, foeDefMult: 0,
          roundMsg: '{N} krallt nach den eigenen Augen und kann weder angreifen noch sich wehren.', wearOff: 'Die Seele deines Opfers erholt sich.' }) },
    ],
  },
  mystik: {
    id: 'mystik',
    name: 'Mystische Kräfte',
    childhood: 'Mit mystischen Kräften gespielt',
    blurb: 'Schon als Kind wusstest du, dass es mehr gibt als das, was man anfassen kann. Du lerntest, die Kraft der Elemente zu formen: Feuer, Wasser, Erde und Wind.',
    heroProp: 'staff',
    color: '#5ac8e0',
    skills: [
      { cost: 1, name: 'Regeneration', blurb: 'Du heilst 5 Runden lang jede Runde um deine Stufe.',
        start: 'Deine Wunden beginnen sich zu schließen!',
        buff: (p) => ({ id: 'mystik1', name: 'Regeneration', atkMult: 1, rounds: 5, regen: p.level,
          effectMsg: 'Du heilst um {d} Lebenspunkte.', missMsg: 'Du hast keine Wunden zu heilen.', wearOff: 'Deine Heilung lässt nach.' }) },
      { cost: 2, name: 'Erdfaust', blurb: 'Eine Faust aus Erde schlägt 5 Runden lang zu.',
        start: '{N} wird von einer Faust aus Erde gepackt und zu Boden geschmettert!',
        buff: (p) => ({ id: 'mystik2', name: 'Erdfaust', atkMult: 1, rounds: 5, minions: 1, minDmg: 1, maxDmg: p.level * 3,
          effectMsg: 'Eine riesige Faust aus Erde trifft {a} für {d} Schaden.', wearOff: 'Die Erdfaust zerbröckelt.' }) },
      { cost: 3, name: 'Lebensentzug', blurb: '5 Runden lang heilt dich jeder deiner Treffer.',
        start: 'Deine Waffe glüht in einem unheimlichen Licht.',
        buff: () => ({ id: 'mystik3', name: 'Lebensentzug', atkMult: 1, rounds: 5, lifetap: 1,
          effectMsg: 'Du ziehst {d} Lebenspunkte aus deinem Gegner.', wearOff: 'Das Glühen deiner Waffe erlischt.' }) },
      { cost: 5, name: 'Blitzaura', blurb: 'Wer dich trifft, bekommt 5 Runden lang den doppelten Schaden zurück.',
        start: 'Deine Haut knistert. Eine Aura aus Blitzen umgibt dich.',
        buff: () => ({ id: 'mystik5', name: 'Blitzaura', atkMult: 1, rounds: 5, dmgShield: 2,
          effectMsg: '{N} zuckt zurück, als Blitze aus deiner Haut springen: {d} Schaden.', wearOff: 'Die Blitzaura erlischt.' }) },
    ],
  },
  dieb: {
    id: 'dieb',
    name: 'Diebeskünste',
    childhood: 'Den Reichen etwas gestohlen',
    blurb: 'Früh hast du gemerkt, dass ein kleiner Rempler im Gedränge einen fremden Geldbeutel einbringt. Und dass der Rücken eines Gegners viel weicher ist als seine Vorderseite.',
    heroProp: 'daggers',
    color: '#e8b85a',
    skills: [
      { cost: 1, name: 'Beleidigen', blurb: 'Der Gegner greift 5 Runden lang nur halbherzig an.',
        start: 'Du nennst {a} einen bösen Namen. {N} ist den Tränen nahe.',
        buff: () => ({ id: 'dieb1', name: 'Beleidigt', atkMult: 1, rounds: 5, foeAtkMult: 0.5,
          roundMsg: '{N} ist gekränkt und greift nur halbherzig an.', wearOff: '{N} hat sich wieder gefangen.' }) },
      { cost: 2, name: 'Giftklinge', blurb: 'Doppelte Angriffskraft für 5 Runden.',
        start: 'Du bestreichst deine Waffe mit Gift.',
        buff: () => ({ id: 'dieb2', name: 'Giftklinge', atkMult: 2, rounds: 5,
          roundMsg: 'Dein Gift verdoppelt deine Schläge!', wearOff: 'Das Gift auf deiner Klinge ist aufgebraucht.' }) },
      { cost: 3, name: 'Versteckter Angriff', blurb: 'Der Gegner findet dich 5 Runden lang nicht.',
        start: 'Mit dem Geschick eines Meisterdiebs verschwindest du fast und greifst aus dem Verborgenen an.',
        buff: () => ({ id: 'dieb3', name: 'Versteckt', atkMult: 1, rounds: 5, foeAtkMult: 0,
          roundMsg: '{N} findet dich nicht und schlägt wild ins Leere!', wearOff: 'Du bist wieder zu sehen.' }) },
      { cost: 5, name: 'Meucheln', blurb: 'Dreifacher Angriff und dreifache Verteidigung für 5 Runden.',
        start: 'Du verschwindest hinter {a} und schiebst eine dünne Klinge zwischen die Wirbel!',
        buff: () => ({ id: 'dieb5', name: 'Meucheln', atkMult: 3, defMult: 3, rounds: 5,
          roundMsg: 'Angriff und Verteidigung sind verdreifacht!', wearOff: 'Der Vorteil aus dem Hinterhalt ist dahin.' }) },
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
