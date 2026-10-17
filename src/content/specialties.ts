import type { PropId, SpecialtyId } from '../game/types';

export interface SpecialtyDef {
  id: SpecialtyId;
  name: string;
  blurb: string;
  move: string;
  moveBlurb: string;
  heroProp: PropId;
}

export const SPECIALTIES: Record<SpecialtyId, SpecialtyDef> = {
  klinge: {
    id: 'klinge',
    name: 'Klingenkunst',
    blurb: 'Du hast im Holzfällerlager gelernt, dass jede Rinde eine schwache Stelle hat.',
    move: 'Rindenbrecher',
    moveBlurb: 'Ein gewaltiger Hieb mit fast doppelter Wucht.',
    heroProp: 'sword',
  },
  wurzel: {
    id: 'wurzel',
    name: 'Wurzelmagie',
    blurb: 'Deine Großmutter sprach mit Bäumen. Manchmal antworten sie dir.',
    move: 'Dornenranke',
    moveBlurb: 'Ranken treffen durch jede Rüstung und fesseln den Gegner eine Runde lang.',
    heroProp: 'staff',
  },
  schleich: {
    id: 'schleich',
    name: 'Schleichpfad',
    blurb: 'Du weißt, wo das Moos am weichsten ist und kein Zweig knackt.',
    move: 'Schattenschritt',
    moveBlurb: 'Du tauchst ab, triffst aus dem Schatten und weichst dem Gegenschlag aus.',
    heroProp: 'daggers',
  },
};

export const SPECIALTY_ORDER: SpecialtyId[] = ['klinge', 'wurzel', 'schleich'];
