import type { Gender, RaceId } from '../game/types';

// Die vier Rassen wie im Original, mit denselben Vorteilen.

export interface RaceDef {
  id: RaceId;
  name: [string, string];      // männlich, weiblich
  plural: string;
  bonus: string;
  blurb: string;
}

export const RACES: Record<RaceId, RaceDef> = {
  mensch: { id: 'mensch', name: ['Mensch', 'Mensch'], plural: 'Menschen', bonus: '+1 Waldkampf pro Tag',
    blurb: 'Menschen sind zäh und ausdauernd. Wo andere müde werden, gehen sie noch einmal in den Wald.' },
  elf: { id: 'elf', name: ['Elf', 'Elfe'], plural: 'Elfen', bonus: 'Mehr Verteidigung (+1, alle 5 Stufen +1 mehr)',
    blurb: 'Elfen sind flink und aufmerksam. Kaum ein Schlag trifft sie dort, wo er treffen sollte.' },
  troll: { id: 'troll', name: ['Troll', 'Trollin'], plural: 'Trolle', bonus: 'Mehr Angriff (+1, alle 5 Stufen +1 mehr)',
    blurb: 'Waldtrolle sind riesig und schlaksig, ihre Arme reichen bis zu den Knien, und in ihrer Mähne wächst Moos. Sie schlagen zu, bevor sie nachdenken. Meistens ist das auch besser so.' },
  zwerg: { id: 'zwerg', name: ['Zwerg', 'Zwergin'], plural: 'Zwerge', bonus: '20 % mehr Gold im Wald',
    blurb: 'Zwerge riechen Gold durch drei Fuß Moos hindurch. Kein Beutel im Wald bleibt ungefunden.' },
};

export const RACE_ORDER: RaceId[] = ['mensch', 'elf', 'troll', 'zwerg'];

export function raceName(r: RaceId, g: Gender): string {
  return RACES[r].name[g === 'f' ? 1 : 0];
}

export function normalizeRace(x: unknown): RaceId {
  return x === 'elf' || x === 'troll' || x === 'zwerg' ? x : 'mensch';
}
