// Gemeinsame Typen der Spiellogik. Keine Darstellung, kein DOM.

export type SpecialtyId = 'klinge' | 'wurzel' | 'schleich';

export type ShapeId =
  | 'rat' | 'bat' | 'goblin' | 'wolf' | 'beetle' | 'blob' | 'bird' | 'humanoid'
  | 'boar' | 'spider' | 'ghost' | 'serpent' | 'bear' | 'troll' | 'stag' | 'treant'
  | 'dragon';

export type PropId = 'none' | 'sword' | 'axe' | 'bow' | 'hammer' | 'spear' | 'staff' | 'daggers' | 'club';

export type StageId = 'forest' | 'training' | 'lair';

export interface MonsterDef {
  id: string;
  name: string;
  level: number;
  shape: ShapeId;
  prop?: PropId;
  scale?: number;      // Größe auf der Bühne, 1 = normal
  eyes?: string;       // Augenfarbe
  intro: string;       // Satz, wenn es auftaucht
  hits: string;        // Verb-Phrase für Treffer: "beißt zu"
  falls: string;       // Satz, wenn es besiegt ist
}

export interface MasterDef {
  level: number;       // Meister für den Aufstieg von level -> level + 1
  name: string;
  accName?: string;    // Akkusativ, falls abweichend: "Gundolf den Holzfäller"
  prop: PropId;
  greeting: string;
  notReady: string;
  victory: string;     // Spieler gewinnt
  defeat: string;      // Spieler verliert
}

export interface ItemDef {
  tier: number;
  name: string;
  value: number;       // Angriff (Waffe) oder Verteidigung (Rüstung)
  price: number;
}

export interface Combatant {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
}

export type FightKind = 'forest' | 'master' | 'dragon';

export interface Buff {
  name: string;
  atkMult: number;
  rounds: number;
}

export interface LogLine {
  t: string;
  k: 'good' | 'bad' | 'gold' | 'info' | 'warn';
}

export interface Fight {
  kind: FightKind;
  monsterId: string;    // MonsterDef.id, 'master-<lvl>' oder 'dragon'
  foe: Combatant;
  expReward: number;
  goldReward: number;
  round: number;
  log: LogLine[];
  over: '' | 'win' | 'lose' | 'fled';
  bound: number;        // Runden, in denen der Gegner nicht angreift
  // Für die Bühnen-Animation der letzten Aktion:
  lastHeroDmg: number;  // Schaden, den der Held verursacht hat
  lastFoeDmg: number;   // Schaden, den der Held erlitten hat
  lastHeroMiss: boolean;
  lastFoeMiss: boolean;
  lastCrit: boolean;
  lastSpecial: boolean;
  seq: number;          // zählt jede Aktion, damit Animationen neu starten
}

export interface Player {
  name: string;
  specialty: SpecialtyId;
  level: number;
  exp: number;
  hp: number;
  baseMaxHp: number;      // Bonus aus Drachenkills
  bonusAtk: number;       // Bonus aus Drachenkills
  bonusDef: number;
  weaponTier: number;
  armorTier: number;
  gold: number;
  bank: number;
  gems: number;
  forestFights: number;
  specialUses: number;
  dragonKills: number;
  alive: boolean;
  seenMaster: boolean;
  drankToday: boolean;
  songToday: boolean;
  buffs: Buff[];
}

export interface GameState {
  v: 1;
  player: Player;
  day: number;             // Spieltag-Zähler
  lastRealDate: string;    // YYYY-MM-DD, löst den echten neuen Tag aus
  fight: Fight | null;
  pendingDragonBonus: boolean;
  news: string[];          // Kurze Meldungen für den Tag
  settings: { retro: boolean; reducedMotion: boolean };
}
