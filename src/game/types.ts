// Gemeinsame Typen der Spiellogik. Keine Darstellung, kein DOM.

/** Fähigkeiten wie im Original: Dunkle Künste, Mystische Kräfte, Diebeskünste. */
export type SpecialtyId = 'dunkel' | 'mystik' | 'dieb';

/** Rassen wie im Original. */
export type RaceId = 'mensch' | 'elf' | 'troll' | 'zwerg';

/** Für Heldenbild und Anrede. */
export type Gender = 'm' | 'f';

export type ShapeId =
  | 'rat' | 'bat' | 'goblin' | 'wolf' | 'beetle' | 'blob' | 'bird' | 'humanoid'
  | 'boar' | 'spider' | 'ghost' | 'serpent' | 'bear' | 'troll' | 'stag' | 'horse' | 'treant'
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

export type FightKind = 'forest' | 'master' | 'dragon' | 'grave' | 'pvp';

export interface Buff {
  id?: string;            // gleiche id ersetzt den alten Effekt
  name: string;
  atkMult: number;
  defMult?: number;
  rounds: number;
  foeAtkMult?: number;    // Gegner greift schwächer an (0 = trifft gar nicht)
  foeDmgMult?: number;    // Gegner richtet weniger Schaden an
  foeDefMult?: number;    // Gegner verteidigt sich schwächer (0 = gar nicht)
  minions?: number;       // Helfer, die jede Runde zusätzlich zuschlagen
  minDmg?: number;
  maxDmg?: number;
  regen?: number;         // Heilung pro Runde
  lifetap?: number;       // Anteil des eigenen Schadens, der heilt
  dmgShield?: number;     // Gegner bekommt diesen Anteil seines Schadens zurück
  roundMsg?: string;      // Texte mit {a}/{N} für den Gegnernamen, {d} für Zahlen
  effectMsg?: string;
  missMsg?: string;
  wearOff?: string;
}

export type PartnerId = 'frieda' | 'florian';

export type MountId = 'pony' | 'wallach' | 'hengst';

export interface LogLine {
  t: string;
  k: 'good' | 'bad' | 'gold' | 'info' | 'warn' | 'crit' | 'special';
  r?: number;           // Kampfrunde, 0 = Auftakt
}

/** Ein abgeschlossener Kampf für die Kampfchronik. */
export interface ChronicleEntry {
  day: number;
  kind: FightKind;
  monsterId: string;
  foe: string;
  result: 'win' | 'lose' | 'fled';
  rounds: number;
  topHit: number;
  log: LogLine[];
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
  topHit?: number;      // stärkster eigener Treffer in diesem Kampf
  foeSpec?: SpecialtyId;
  foeRace?: RaceId;  // nur Spieler gegen Spieler: Fähigkeit und Geschlecht des anderen Helden (für sein Bild)
  foeGender?: Gender;
  pvpPlace?: 'felder' | 'gasthaus';
  autoWarned?: boolean; // "Kämpfen bis zum Ende" hat in diesem Kampf schon einmal angehalten
  heroHurt?: boolean;   // Held hat in diesem Kampf Schaden genommen (für den makellosen Drachensieg)
}

export interface Player {
  name: string;
  specialty: SpecialtyId;
  race: RaceId;
  gender: Gender;
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
  specialUses: number;     // Fähigkeitspunkte für heute
  skill: number;           // Stufe in der eigenen Fähigkeit (steigt mit jedem Meister, nach dem Drachen wieder 0)
  dragonKills: number;
  alive: boolean;
  seenMaster: boolean;
  drankToday: boolean;
  songToday: boolean;
  innTalks: number;       // Gespräche mit Frieda heute
  soul: number;           // Seelenkraft im Schattenreich (statt Lebenspunkten)
  favor: number;          // Gunst bei Morwen, bleibt über den Tod hinaus
  graveFights: number;    // Schattenkämpfe heute
  innRoom: boolean;       // Zimmer im Gasthaus für diese Nacht gemietet
  buffs: Buff[];
  bonusFights: number;    // zusätzliche Waldkämpfe pro Tag aus Drachenpunkten
  charm: number;          // Charme, wächst mit jedem Drachenkill (für Flirten und Heiraten im Gasthaus)
  dragonPoints: DragonPoint[]; // Verlauf der gewählten Drachenpunkte
  marriedTo: PartnerId | '';   // verheiratet mit Frieda oder Florian (bleibt über Drachenkills)
  seenLover: boolean;          // heute schon geflirtet
  loverPref?: PartnerId;       // wen man im Gasthaus umwirbt (Standard: das andere Geschlecht)
  mount: MountId | '';         // Reittier aus Mertens Stall (bleibt über Drachenkills)
  mountFed: boolean;           // heute schon gefüttert
}

export type DragonPoint = 'atk' | 'def' | 'hp' | 'ff';

/** Zahlen für die Ruhmeshalle. Bleiben über Drachenkills erhalten. */
export interface Stats {
  kills: number;          // Siege im Wald
  deaths: number;
  masters: number;        // besiegte Meister
  events: number;         // erlebte Waldereignisse
  runStartDay: number;    // Spieltag, an dem der aktuelle Durchgang begann
  fastestDragon: number;  // wenigste Tage bis zum Drachenkill, 0 = noch keiner
  lastDeathDay: number;
  bestHit: { dmg: number; foe: string; day: number };
  shades: number;         // besiegte Seelen im Schattenreich
  resurrections: number;  // Rückkehr mit Morwens Hilfe
  realDays: number;       // an wie vielen echten Kalendertagen gespielt wurde
  firstPlayed: string;    // erster Spieltag (YYYY-MM-DD)
}

/** Ein Waldereignis, das auf eine Entscheidung wartet. */
export interface PendingEvent {
  id: string;
  lines: LogLine[];
}

export interface GameState {
  v: 1;
  savedAt?: number;        // Zeitpunkt des letzten Speicherns (ms), für den Abgleich mit dem Server
  player: Player;
  day: number;             // Spieltag-Zähler
  lastRealDate: string;    // YYYY-MM-DD, löst den echten neuen Tag aus
  fight: Fight | null;
  pendingDragonBonus: boolean;
  flawlessDragon?: boolean; // letzter Drachensieg ohne einen einzigen Treffer einzustecken
  news: string[];          // Kurze Meldungen für den Tag
  bestiary: Record<string, number>; // besiegte Gegner je Art (bleibt über Drachenkills erhalten)
  stats: Stats;
  chronicle: ChronicleEntry[];  // die letzten Kämpfe, neuester zuerst
  outbox: string[];             // Tagesneuigkeiten, die noch an den Server gehen
  pendingEvent: PendingEvent | null;
  settings: { retro: boolean; reducedMotion: boolean };
}
