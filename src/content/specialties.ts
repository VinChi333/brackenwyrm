import type { Buff, Player, PropId, SpecialtyId } from '../game/types';

import { t } from '../i18n';

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
    name: t('Dunkle Künste'),
    childhood: t('Viele kleine Waldtiere erlegt'),
    blurb: t('Als Kind warst du überzeugt, dass die Waldtiere sich gegen dich verschworen hatten. Später verschwandest du tagelang im Wald, und niemand wusste, woher die Geräusche kamen.'),
    heroProp: 'staff',
    color: '#e0605a',
    skills: [
      { cost: 1, name: t('Skelettkrieger'), blurb: t('Knochenhände greifen 5 Runden lang an.'),
        start: t('Du rufst die Geister der Toten. Knochenhände greifen aus dem Waldboden nach {a}.'),
        buff: (p) => ({ id: 'dunkel1', name: t('Skelettkrieger'), atkMult: 1, rounds: 5, minions: Math.round(p.level / 3) + 1, minDmg: 0, maxDmg: Math.round(p.level / 2) + 1,
          effectMsg: t('Ein untoter Diener trifft {a} für {d} Schaden.'), missMsg: t('Ein untoter Diener schlägt nach {a}, verfehlt aber.'), wearOff: t('Deine Knochendiener zerfallen zu Staub.') }) },
      { cost: 2, name: t('Voodoo'), blurb: t('Ein einzelner, sehr schmerzhafter Nadelstich.'),
        start: t('Du ziehst eine kleine Puppe hervor, die genau wie {N} aussieht.'),
        buff: (_p, atk) => ({ id: 'dunkel2', name: t('Voodoo'), atkMult: 1, rounds: 1, minions: 1, minDmg: Math.round(atk * 1.5), maxDmg: Math.round(atk * 3),
          effectMsg: t('Du stichst eine Nadel in die Puppe. {N} zuckt zusammen: {d} Schaden!') }) },
      { cost: 3, name: t('Ahnenfluch'), blurb: t('Der Gegner richtet 5 Runden lang nur halben Schaden an.'),
        start: t('Du verfluchst die Ahnen von {a}.'),
        buff: () => ({ id: 'dunkel3', name: t('Ahnenfluch'), atkMult: 1, rounds: 5, foeDmgMult: 0.5,
          roundMsg: t('{N} wankt unter deinem Fluch und richtet nur halben Schaden an.'), wearOff: t('Dein Fluch verblasst.') }) },
      { cost: 5, name: t('Seelenwelke'), blurb: t('Der Gegner kann 5 Runden lang weder angreifen noch sich wehren.'),
        start: t('Du streckst die Hand aus, und {N} beginnt aus den Ohren zu bluten.'),
        buff: () => ({ id: 'dunkel5', name: t('Seelenwelke'), atkMult: 1, rounds: 5, foeAtkMult: 0, foeDefMult: 0,
          roundMsg: t('{N} krallt nach den eigenen Augen und kann weder angreifen noch sich wehren.'), wearOff: t('Die Seele deines Opfers erholt sich.') }) },
    ],
  },
  mystik: {
    id: 'mystik',
    name: t('Mystische Kräfte'),
    childhood: t('Mit mystischen Kräften gespielt'),
    blurb: t('Schon als Kind wusstest du, dass es mehr gibt als das, was man anfassen kann. Du lerntest, die Kraft der Elemente zu formen: Feuer, Wasser, Erde und Wind.'),
    heroProp: 'staff',
    color: '#5ac8e0',
    skills: [
      { cost: 1, name: t('Regeneration'), blurb: t('Du heilst 5 Runden lang jede Runde um deine Stufe.'),
        start: t('Deine Wunden beginnen sich zu schließen!'),
        buff: (p) => ({ id: 'mystik1', name: t('Regeneration'), atkMult: 1, rounds: 5, regen: p.level,
          effectMsg: t('Du heilst um {d} Lebenspunkte.'), missMsg: t('Du hast keine Wunden zu heilen.'), wearOff: t('Deine Heilung lässt nach.') }) },
      { cost: 2, name: t('Erdfaust'), blurb: t('Eine Faust aus Erde schlägt 5 Runden lang zu.'),
        start: t('{N} wird von einer Faust aus Erde gepackt und zu Boden geschmettert!'),
        buff: (p) => ({ id: 'mystik2', name: t('Erdfaust'), atkMult: 1, rounds: 5, minions: 1, minDmg: 1, maxDmg: p.level * 3,
          effectMsg: t('Eine riesige Faust aus Erde trifft {a} für {d} Schaden.'), wearOff: t('Die Erdfaust zerbröckelt.') }) },
      { cost: 3, name: t('Lebensentzug'), blurb: t('5 Runden lang heilt dich jeder deiner Treffer.'),
        start: t('Deine Waffe glüht in einem unheimlichen Licht.'),
        buff: () => ({ id: 'mystik3', name: t('Lebensentzug'), atkMult: 1, rounds: 5, lifetap: 1,
          effectMsg: t('Du ziehst {d} Lebenspunkte aus deinem Gegner.'), wearOff: t('Das Glühen deiner Waffe erlischt.') }) },
      { cost: 5, name: t('Blitzaura'), blurb: t('Wer dich trifft, bekommt 5 Runden lang den doppelten Schaden zurück.'),
        start: t('Deine Haut knistert. Eine Aura aus Blitzen umgibt dich.'),
        buff: () => ({ id: 'mystik5', name: t('Blitzaura'), atkMult: 1, rounds: 5, dmgShield: 2,
          effectMsg: t('{N} zuckt zurück, als Blitze aus deiner Haut springen: {d} Schaden.'), wearOff: t('Die Blitzaura erlischt.') }) },
    ],
  },
  dieb: {
    id: 'dieb',
    name: t('Diebeskünste'),
    childhood: t('Den Reichen etwas gestohlen'),
    blurb: t('Früh hast du gemerkt, dass ein kleiner Rempler im Gedränge einen fremden Geldbeutel einbringt. Und dass der Rücken eines Gegners viel weicher ist als seine Vorderseite.'),
    heroProp: 'daggers',
    color: '#e8b85a',
    skills: [
      { cost: 1, name: t('Beleidigen'), blurb: t('Der Gegner greift 5 Runden lang nur halbherzig an.'),
        start: t('Du nennst {a} einen bösen Namen. {N} ist den Tränen nahe.'),
        buff: () => ({ id: 'dieb1', name: t('Beleidigt'), atkMult: 1, rounds: 5, foeAtkMult: 0.5,
          roundMsg: t('{N} ist gekränkt und greift nur halbherzig an.'), wearOff: t('{N} hat sich wieder gefangen.') }) },
      { cost: 2, name: t('Giftklinge'), blurb: t('Doppelte Angriffskraft für 5 Runden.'),
        start: t('Du bestreichst deine Waffe mit Gift.'),
        buff: () => ({ id: 'dieb2', name: t('Giftklinge'), atkMult: 2, rounds: 5,
          roundMsg: t('Dein Gift verdoppelt deine Schläge!'), wearOff: t('Das Gift auf deiner Klinge ist aufgebraucht.') }) },
      { cost: 3, name: t('Versteckter Angriff'), blurb: t('Der Gegner findet dich 5 Runden lang nicht.'),
        start: t('Mit dem Geschick eines Meisterdiebs verschwindest du fast und greifst aus dem Verborgenen an.'),
        buff: () => ({ id: 'dieb3', name: t('Versteckt'), atkMult: 1, rounds: 5, foeAtkMult: 0,
          roundMsg: t('{N} findet dich nicht und schlägt wild ins Leere!'), wearOff: t('Du bist wieder zu sehen.') }) },
      { cost: 5, name: t('Meucheln'), blurb: t('Dreifacher Angriff und dreifache Verteidigung für 5 Runden.'),
        start: t('Du verschwindest hinter {a} und schiebst eine dünne Klinge zwischen die Wirbel!'),
        buff: () => ({ id: 'dieb5', name: t('Meucheln'), atkMult: 3, defMult: 3, rounds: 5,
          roundMsg: t('Angriff und Verteidigung sind verdreifacht!'), wearOff: t('Der Vorteil aus dem Hinterhalt ist dahin.') }) },
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
