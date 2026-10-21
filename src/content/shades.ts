import type { MonsterDef } from '../game/types';

// Verirrte Seelen am Nebelfluss im Schattenreich. Wer tot ist, kämpft hier um Morwens Gunst.
// Sie erscheinen absichtlich als Schattenkarten (Silhouette vor kaltem Licht), nicht als Gemälde.

export const SHADES: MonsterDef[] = [
  { id: 'verirrte-seele', name: 'Verirrte Seele', level: 0, shape: 'ghost', eyes: '#bfe3ff',
    intro: 'Eine verirrte Seele treibt aus dem Nebel und sucht ihren Namen. Sie glaubt, du hättest ihn gestohlen.',
    hits: 'greift mit kalten Fingern nach dir', falls: 'Die Seele seufzt und löst sich in Nebel auf.' },
  { id: 'faehrmann', name: 'Ertrunkener Fährmann', level: 0, shape: 'humanoid', prop: 'staff', eyes: '#7fe0d0',
    intro: 'Ein Fährmann ohne Boot watet aus dem Fluss. Wasser rinnt aus seinem Mantel. „Fahrgeld“, gurgelt er.',
    hits: 'schlägt mit dem nassen Ruder zu', falls: 'Der Fährmann sinkt zurück ins schwarze Wasser.' },
  { id: 'schattenhund', name: 'Schattenhund', level: 0, shape: 'wolf', eyes: '#b493f2',
    intro: 'Ein Schattenhund schnüffelt an deiner Seele. Er knurrt, als würde sie ihm nicht schmecken.',
    hits: 'schnappt nach deinem Schatten', falls: 'Der Schattenhund jault und zerfließt zu Rauch.' },
  { id: 'knochenkraehe', name: 'Knochenkrähe', level: 0, shape: 'bird', eyes: '#e6e6ff',
    intro: 'Eine Knochenkrähe landet auf einem Grabstein. Ihr Krächzen klingt wie dein Name.',
    hits: 'hackt mit dem bleichen Schnabel nach dir', falls: 'Die Knochenkrähe zerfällt klappernd in einen Haufen Federn.' },
  { id: 'klagende-witwe', name: 'Klagende Witwe', level: 0, shape: 'ghost', eyes: '#f2a6c9',
    intro: 'Eine Witwe in zerrissenem Schleier weint am Ufer. Als sie dich sieht, hört sie auf zu weinen. Das ist schlimmer.',
    hits: 'stößt einen Schrei aus, der dir durch die Seele fährt', falls: 'Die Witwe verstummt. Zum ersten Mal seit hundert Jahren.' },
  { id: 'nebelschlund', name: 'Nebelschlund', level: 0, shape: 'blob', eyes: '#9fd18a',
    intro: 'Der Nebel selbst ballt sich zusammen und öffnet ein Maul.',
    hits: 'verschluckt ein Stück deiner Seelenkraft', falls: 'Der Nebelschlund verweht, als hätte jemand ein Fenster geöffnet.' },
];

export function shadeById(id: string): MonsterDef | undefined {
  return SHADES.find((m) => m.id === id);
}

export function isShade(id: string): boolean {
  return SHADES.some((m) => m.id === id);
}
