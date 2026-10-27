import type { ItemDef } from '../game/types';

import { t } from '../i18n';

// Stufe 0 ist die Startausrüstung. Wert = Angriff (Waffe) bzw. Verteidigung (Rüstung).
// Preise folgen ungefähr 28 × Stufe^1,8 und wachsen mit den Einnahmen mit. Gold bleibt trotzdem eine Entscheidung.

const W: [string, number][] = [
  [t('Haselstecken'), 0],
  [t('Schnitzmesser'), 30],
  [t('Holzfälleraxt'), 100],
  [t('Jagdspeer'), 200],
  [t('Kurzschwert'), 340],
  [t('Dornenkeule'), 510],
  [t('Langschwert'), 700],
  [t('Kriegsbeil'), 930],
  [t('Harzgehärtete Klinge'), 1180],
  [t('Rabenschnabel-Hammer'), 1460],
  [t('Eschenlanze'), 1770],
  [t('Mondsichel'), 2100],
  [t('Wurzelstahl-Schwert'), 2450],
  [t('Glutklinge'), 2830],
  [t('Farnschneide'), 3240],
  [t('Wyrmzahn'), 3670],
];

const A: [string, number][] = [
  [t('Leinenhemd'), 0],
  [t('Filzwams'), 30],
  [t('Lederweste'), 100],
  [t('Gesteppter Gambeson'), 200],
  [t('Beschlagenes Leder'), 340],
  [t('Rindenpanzer'), 510],
  [t('Kettenhemd'), 700],
  [t('Schuppenpanzer'), 930],
  [t('Moosgrüne Brünne'), 1180],
  [t('Eisenplatten'), 1460],
  [t('Harzlack-Rüstung'), 1770],
  [t('Wolfsfell-Plattenrock'), 2100],
  [t('Wurzelstahl-Panzer'), 2450],
  [t('Glutschuppen-Harnisch'), 2830],
  [t('Farnritter-Rüstung'), 3240],
  [t('Wyrmschuppen-Panzer'), 3670],
];

export const WEAPONS: ItemDef[] = W.map(([name, price], tier) => ({ tier, name, value: tier * 2 + 1, price }));
export const ARMORS: ItemDef[] = A.map(([name, price], tier) => ({ tier, name, value: tier * 2 + 1, price }));

/** Eintauschwert der alten Ausrüstung beim Kauf. */
export function tradeIn(item: ItemDef): number {
  return Math.floor(item.price * 0.5);
}
