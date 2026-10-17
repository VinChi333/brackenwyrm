import type { ItemDef } from '../game/types';

// Stufe 0 ist die Startausrüstung. Wert = Angriff (Waffe) bzw. Verteidigung (Rüstung).
// Preise folgen ungefähr 28 × Stufe^1,8 und wachsen mit den Einnahmen mit. Gold bleibt trotzdem eine Entscheidung.

const W: [string, number][] = [
  ['Haselstecken', 0],
  ['Schnitzmesser', 30],
  ['Holzfälleraxt', 100],
  ['Jagdspeer', 200],
  ['Kurzschwert', 340],
  ['Dornenkeule', 510],
  ['Langschwert', 700],
  ['Kriegsbeil', 930],
  ['Harzgehärtete Klinge', 1180],
  ['Rabenschnabel-Hammer', 1460],
  ['Eschenlanze', 1770],
  ['Mondsichel', 2100],
  ['Wurzelstahl-Schwert', 2450],
  ['Glutklinge', 2830],
  ['Farnschneide', 3240],
  ['Wyrmzahn', 3670],
];

const A: [string, number][] = [
  ['Leinenhemd', 0],
  ['Filzwams', 30],
  ['Lederweste', 100],
  ['Gesteppter Gambeson', 200],
  ['Beschlagenes Leder', 340],
  ['Rindenpanzer', 510],
  ['Kettenhemd', 700],
  ['Schuppenpanzer', 930],
  ['Moosgrüne Brünne', 1180],
  ['Eisenplatten', 1460],
  ['Harzlack-Rüstung', 1770],
  ['Wolfsfell-Plattenrock', 2100],
  ['Wurzelstahl-Panzer', 2450],
  ['Glutschuppen-Harnisch', 2830],
  ['Farnritter-Rüstung', 3240],
  ['Wyrmschuppen-Panzer', 3670],
];

export const WEAPONS: ItemDef[] = W.map(([name, price], tier) => ({ tier, name, value: tier * 2 + 1, price }));
export const ARMORS: ItemDef[] = A.map(([name, price], tier) => ({ tier, name, value: tier * 2 + 1, price }));

/** Eintauschwert der alten Ausrüstung beim Kauf. */
export function tradeIn(item: ItemDef): number {
  return Math.floor(item.price * 0.5);
}
