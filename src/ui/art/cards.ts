// Monsterkarten. Solange es für ein Monster noch keine Illustration gibt, zeigt die Karte
// eine "Schattenkarte": die Silhouette vor farbigem Licht. Sobald ein Bild in MONSTER_ART
// eingetragen ist, erscheint es automatisch.

import { masterForLevel } from '../../content/masters';
import { DRAGON, monsterById } from '../../content/monsters';
import type { MonsterDef, PropId, ShapeId } from '../../game/types';
import { creature, humanoid } from './silhouettes';

/** Illustrationen (z. B. aus Leonardo), Schlüssel = Monster-ID. Wird befüllt, sobald Bilder da sind. */
export const MONSTER_ART: Record<string, string> = {};

// Höhe jeder Form in Zeicheneinheiten (oben, unten), um sie in die Karte einzupassen.
const SPAN: Record<ShapeId, [number, number]> = {
  rat: [-75, 0], bat: [-200, -100], goblin: [-150, 0], wolf: [-170, 0], beetle: [-110, 0], blob: [-140, 0],
  bird: [-270, -110], humanoid: [-215, 0], boar: [-130, 0], spider: [-150, 0], ghost: [-210, -10], serpent: [-200, 0],
  bear: [-160, 0], troll: [-250, 0], stag: [-290, 0], treant: [-300, 0], dragon: [-400, 0],
};
const WIDTH: Partial<Record<ShapeId, number>> = { dragon: 780, wolf: 290, boar: 250, bear: 240, spider: 290, serpent: 260, bat: 290, bird: 230, stag: 250 };

export type Tier = 'bronze' | 'silver' | 'gold' | 'legend';

export function tierFor(level: number, kind: 'monster' | 'master' | 'dragon' = 'monster'): Tier {
  if (kind === 'dragon') return 'legend';
  if (kind === 'master') return 'gold';
  return level <= 5 ? 'bronze' : level <= 10 ? 'silver' : 'gold';
}

let uid = 0;

function shadowArt(markup: string, shape: ShapeId, glow: string, flip = false, offsetX = 0): string {
  const [top, bottom] = SPAN[shape];
  const h = bottom - top;
  const w = WIDTH[shape] ?? 200;
  const scale = Math.min(300 / h, 250 / w, 1.5);
  const id = `ca${uid++}`;
  const cx = 150 + offsetX;
  const baseY = 362 - (bottom * scale);
  return `<svg class="card-svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="${id}" cx="50%" cy="58%" r="70%">
        <stop offset="0" stop-color="${glow}" stop-opacity="0.75"/>
        <stop offset="0.45" stop-color="${glow}" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#0b0d18" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="300" height="400" fill="#12162a"/>
    <rect width="300" height="400" fill="url(#${id})"/>
    <g fill="#0b0d18" opacity="0.8">
      <polygon points="-10,330 30,140 70,330"/><polygon points="230,330 270,120 310,330"/>
    </g>
    <path d="M0 360 Q150 340 300 360 V400 H0 Z" fill="#0b0d18"/>
    <g transform="translate(${cx} ${baseY}) scale(${flip ? -scale : scale} ${scale})">
      <g fill="${glow}" stroke="${glow}" stroke-width="${7 / scale}" color="${glow}" opacity="0.55" transform="translate(${3 / scale} ${-3 / scale})">${markup}</g>
      <g fill="#0b0d18" color="#0b0d18">${markup}</g>
    </g>
  </svg>`;
}

export interface CardInfo {
  key: string;          // für das Bestiarium
  name: string;
  level: number;
  tier: Tier;
  art: string;          // fertiges Markup für die Bildfläche
  hasIllustration: boolean;
  flavor: string;
}

function artFor(id: string, fallback: () => string): { art: string; real: boolean } {
  const src = MONSTER_ART[id];
  if (src) return { art: `<img class="card-img" src="${src}" alt="">`, real: true };
  return { art: fallback(), real: false };
}

export function monsterCard(m: MonsterDef): CardInfo {
  const glow = m.eyes ?? '#f3c06a';
  const a = artFor(m.id, () => shadowArt(creature(m.shape, glow, m.prop), m.shape, glow));
  return { key: m.id, name: m.name, level: m.level, tier: tierFor(m.level), art: a.art, hasIllustration: a.real, flavor: m.intro };
}

export function dragonCard(): CardInfo {
  const a = artFor('dragon', () => shadowArt(creature('dragon', DRAGON.eyes ?? '#ffcf5a'), 'dragon', '#7ee08a', false, -30));
  return { key: 'dragon', name: DRAGON.name, level: DRAGON.level, tier: 'legend', art: a.art, hasIllustration: a.real, flavor: DRAGON.intro };
}

export function masterCard(level: number): CardInfo {
  const m = masterForLevel(level)!;
  const id = `master-${level}`;
  const a = artFor(id, () => shadowArt(humanoid(m.prop, null, { cape: true }), 'humanoid', '#e3b25b'));
  return { key: id, name: m.name, level, tier: 'gold', art: a.art, hasIllustration: a.real, flavor: m.greeting };
}

export function heroArt(prop: PropId, opts: { hood?: boolean; shield?: boolean; cape?: boolean }): string {
  const a = artFor('hero', () => shadowArt(humanoid(prop, null, opts), 'humanoid', '#6fc8e0', true));
  return a.art;
}

export function cardFor(key: string): CardInfo | null {
  if (key === 'dragon') return dragonCard();
  if (key.startsWith('master-')) return masterCard(Number(key.slice(7)));
  const m = monsterById(key);
  return m ? monsterCard(m) : null;
}

const TIER_LABEL: Record<Tier, string> = { bronze: 'Gewöhnlich', silver: 'Selten', gold: 'Episch', legend: 'Legendär' };

/** Kartenmarkup. hp = null blendet den Lebensbalken aus (z. B. im Bestiarium). */
export function cardHtml(c: CardInfo, opts: { hp?: [number, number, number] | null; cls?: string; count?: number; isNew?: boolean } = {}): string {
  const hp = opts.hp;
  return `<figure class="card tier-${c.tier} ${opts.cls ?? ''}">
    <div class="card-art">${c.art}${c.hasIllustration ? '' : '<span class="card-tag">Illustration folgt</span>'}</div>
    <div class="card-level" title="Stufe">${c.level}</div>
    ${opts.isNew ? '<div class="card-new">Neu</div>' : ''}
    <figcaption class="card-plate"><span class="card-name">${c.name}</span><span class="card-tier">${TIER_LABEL[c.tier]}</span></figcaption>
    ${hp ? `<div class="card-hp" aria-label="Lebenspunkte ${hp[0]} von ${hp[1]}"><i style="--from:${hp[2]}%;--to:${Math.round((100 * hp[0]) / hp[1])}%;width:${Math.round((100 * hp[0]) / hp[1])}%"></i><span>${hp[0]} / ${hp[1]}</span></div>` : ''}
    ${opts.count ? `<div class="card-count">${opts.count}× besiegt</div>` : ''}
  </figure>`;
}

export function cardBack(level: number): string {
  return `<figure class="card card-back tier-${tierFor(level)}"><div class="card-art"><span class="card-q">?</span></div>
    <div class="card-level">${level}</div><figcaption class="card-plate"><span class="card-name">???</span><span class="card-tier">Stufe ${level}</span></figcaption></figure>`;
}
