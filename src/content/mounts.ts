import type { MountId } from '../game/types';

// Reittiere aus Mertens Stall, nach dem Original (Merick's Stables: Pony, Wallach, Hengst).
// Kosten nur Edelsteine. Jedes Tier bringt Waldkämpfe pro Tag und einen Angriffsbonus für eine Zahl von Runden.
// Beim Verkauf gibt es zwei Drittel zurück. Das Reittier bleibt auch nach dem Drachen.
// Unsere Tage haben doppelt so viele Waldkämpfe wie das Original, darum sind Waldkämpfe und Runden entsprechend höher.

export interface MountDef {
  id: MountId;
  name: string;
  /** "dein Pony", "deinen Wallach" */
  yourAcc: string;
  /** "Dein Pony", "Dein Wallach" */
  yourNom: string;
  /** "deinem Pony" */
  yourDat: string;
  rank: number;
  gems: number;
  fights: number;
  rounds: number;
  feedCost: number;     // Gold je Stufe
  blurb: string;
  buffName: string;
}

export const MOUNTS: Record<MountId, MountDef> = {
  pony: { id: 'pony', yourDat: 'deinem Pony', name: 'Pony', yourAcc: 'dein Pony', yourNom: 'Dein Pony', rank: 1, gems: 6, fights: 2, rounds: 30, feedCost: 20,
    blurb: 'Ein junges, gutmütiges Moorpony mit zotteliger Mähne. Klein, aber es beißt jeden, der dir zu nahe kommt.', buffName: 'Ponyangriff' },
  wallach: { id: 'wallach', yourDat: 'deinem Wallach', name: 'Wallach', yourAcc: 'deinen Wallach', yourNom: 'Dein Wallach', rank: 2, gems: 10, fights: 4, rounds: 60, feedCost: 25,
    blurb: 'Ein kräftiger brauner Wallach, treu bis in die Farnschlucht. Er hat schon drei Holzfäller aus dem Sumpf gezogen.', buffName: 'Wallachangriff' },
  hengst: { id: 'hengst', yourDat: 'deinem Hengst', name: 'Hengst', yourAcc: 'deinen Hengst', yourNom: 'Dein Hengst', rank: 3, gems: 16, fights: 6, rounds: 90, feedCost: 30,
    blurb: 'Ein riesiger, edler Rappe mit Moos in der Mähne. Wenn er wiehert, verstummt der Wald.', buffName: 'Hengstangriff' },
};

export const MOUNT_ORDER: MountId[] = ['pony', 'wallach', 'hengst'];
export const MOUNT_ATK = 1.2;

export const MERTEN = {
  greeting: 'Merten, der alte Rosshändler, lehnt am Gatter und kaut auf einem Strohhalm. „Grüß di! Suchst a Viech, das mit dir in den Wald geht? Bei mir zahlt ma mit Edelsteinen, Gold frisst mir der Gaul eh nur weg.“',
};

export function mountRepay(id: MountId | ''): number {
  return id ? Math.round((MOUNTS[id].gems * 2) / 3) : 0;
}
