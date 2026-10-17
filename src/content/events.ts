import { expPerKill, maxHp, specialUsesPerDay } from '../game/balance';
import { chance, roll } from '../game/rng';
import type { LogLine, Player } from '../game/types';

// Kleine Begegnungen im Wald statt eines Kampfes. Jede kostet einen Waldkampf.

export interface ForestEvent {
  id: string;
  weight: number;
  run: (p: Player) => LogLine[];
}

export const FOREST_EVENTS: ForestEvent[] = [
  { id: 'eichhoernchen', weight: 14, run: (p) => {
    const g = roll(5, 15) * p.level;
    p.gold += g;
    return [{ t: `Ein Eichhörnchen hat in einem hohlen Baum Gold versteckt. Es hätte besser aufpassen sollen. Du findest ${g} Gold.`, k: 'gold' }];
  } },
  { id: 'edelstein', weight: 6, run: (p) => {
    p.gems += 1;
    return [{ t: 'Zwischen den Wurzeln einer alten Buche glitzert etwas: ein Edelstein!', k: 'gold' }];
  } },
  { id: 'moosquelle', weight: 10, run: (p) => {
    p.hp = maxHp(p);
    return [{ t: 'Du findest eine Moosquelle. Das Wasser schmeckt nach Regen und schließt deine Wunden.', k: 'good' }];
  } },
  { id: 'dornen', weight: 10, run: (p) => {
    const d = Math.max(1, Math.round(maxHp(p) * 0.1));
    p.hp = Math.max(1, p.hp - d);
    return [{ t: `Du stolperst in einen Brombeerstrauch. Er ist nicht so freundlich, wie Brombeeren schmecken. ${d} Schaden.`, k: 'bad' }];
  } },
  { id: 'pilzring', weight: 9, run: (p) => {
    if (chance(0.5)) {
      p.forestFights += 1;
      return [{ t: 'Du trittst in einen Pilzring. Die Zeit fühlt sich plötzlich länger an. Du erhältst einen zusätzlichen Waldkampf.', k: 'good' }];
    }
    p.forestFights = Math.max(0, p.forestFights - 1);
    return [{ t: 'Du trittst in einen Pilzring und tanzt eine Stunde lang, ohne es zu wollen. Du verlierst einen Waldkampf.', k: 'warn' }];
  } },
  { id: 'koehler', weight: 9, run: (p) => {
    const e = expPerKill(p.level);
    p.exp += e;
    return [{ t: `Ein alter Köhler erzählt dir von seinen Kämpfen. Die Hälfte davon ist gelogen, aber du lernst trotzdem etwas. ${e} Erfahrung.`, k: 'good' }];
  } },
  { id: 'loch', weight: 6, run: (p) => {
    const g = Math.floor(p.gold * 0.1);
    if (g < 1) return [{ t: 'Dein Geldbeutel hat ein Loch. Zum Glück war nichts drin.', k: 'info' }];
    p.gold -= g;
    return [{ t: `Dein Geldbeutel hat ein Loch. Irgendwo im Wald liegen jetzt ${g} Gold.`, k: 'bad' }];
  } },
  { id: 'gluehwuermchen', weight: 7, run: (p) => {
    if (p.specialUses >= specialUsesPerDay(p) + 2) {
      return [{ t: 'Glühwürmchen umschwirren dich. Du fühlst dich schon randvoll mit Kraft.', k: 'info' }];
    }
    p.specialUses += 1;
    return [{ t: 'Glühwürmchen umschwirren dich und flüstern dir etwas zu. Du kannst deine Fähigkeit einmal mehr einsetzen.', k: 'good' }];
  } },
  { id: 'igel', weight: 10, run: () => [
    { t: 'Etwas raschelt im Unterholz. Es ist ein Igel. Er sieht dich vorwurfsvoll an, bis du weitergehst.', k: 'info' },
  ] },
];

export function pickEvent(): ForestEvent {
  const total = FOREST_EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = roll(1, total);
  for (const e of FOREST_EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return FOREST_EVENTS[0];
}
