// Bühnen (Schattentheater) und Holzschnitte. Alles Vektor: scharf auf jedem Bildschirm,
// wenige Kilobyte, keine Bilddateien.

import type { StageId } from '../../game/types';

export const STAGE_W = 960;
export const STAGE_H = 540;
export const GROUND_Y = 472;

// Feste "Zufalls"-Positionen, damit die Bühne bei jedem Aufbau gleich aussieht.
export const FAR = [20, 70, 118, 160, 214, 262, 318, 372, 590, 640, 694, 748, 800, 852, 902, 944];
export const MID = [-10, 64, 150, 820, 880, 950];

export function tree(x: number, base: number, h: number, w: number): string {
  return `<polygon points="${x - w},${base} ${x},${base - h} ${x + w},${base}"/>
    <polygon points="${x - w * 0.8},${base - h * 0.35} ${x},${base - h * 1.05} ${x + w * 0.8},${base - h * 0.35}"/>`;
}

export function frond(x: number, y: number, rot: number, len: number, flip = false): string {
  let leaves = '';
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const t = (i / (n + 1)) * len;
    const w = (1 - i / (n + 2)) * len * 0.26;
    leaves += `<ellipse cx="${t}" cy="${-w * 0.5}" rx="${w * 0.5}" ry="${w * 0.17}" transform="rotate(${flip ? 40 : -40} ${t} ${-w * 0.5})"/>`;
    leaves += `<ellipse cx="${t}" cy="${w * 0.5}" rx="${w * 0.5}" ry="${w * 0.17}" transform="rotate(${flip ? -40 : 40} ${t} ${w * 0.5})"/>`;
  }
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 -2 Q${len / 2} -8 ${len} 0 Q${len / 2} -2 0 2 Z"/>${leaves}</g>`;
}

function lightDefs(id: StageId): string {
  const stops =
    id === 'lair'
      ? ['#f7c48a', '#d9733f', '#7a2a14']
      : id === 'training'
        ? ['#fde4a8', '#f0b062', '#b9682c']
        : ['#fbe0a0', '#eeaa58', '#b0602a'];
  return `<radialGradient id="light-${id}" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="${stops[0]}"/><stop offset="0.5" stop-color="${stops[1]}"/><stop offset="1" stop-color="${stops[2]}"/>
    </radialGradient>`;
}

function forestBack(): string {
  return `<circle cx="480" cy="210" r="74" fill="#fff3cf" opacity="0.55"/>
    <path d="M0 380 Q120 330 240 360 Q360 320 480 350 Q600 318 720 352 Q840 330 960 360 V540 H0 Z" fill="#c9803f" opacity="0.75"/>
    <g fill="#a35b28">${FAR.map((x, i) => tree(x, 410, 150 + (i % 3) * 30, 34 + (i % 2) * 8)).join('')}</g>
    <g fill="#6e3a18">${MID.map((x, i) => tree(x, 452, 300 + (i % 2) * 50, 70)).join('')}</g>`;
}

function trainingBack(): string {
  const posts = [40, 150, 260, 700, 810, 920]
    .map((x) => `<rect x="${x - 7}" y="380" width="14" height="80" rx="3"/>`).join('');
  return `<circle cx="480" cy="190" r="70" fill="#fff3cf" opacity="0.55"/>
    <g fill="#a35b28">
      <polygon points="80,400 130,350 180,400"/><rect x="92" y="400" width="76" height="40"/>
      <polygon points="760,396 820,340 880,396"/><rect x="774" y="396" width="92" height="44"/>
      ${FAR.slice(5, 11).map((x) => tree(x + 40, 410, 120, 26)).join('')}
    </g>
    <g fill="#6e3a18">
      ${posts}
      <rect x="20" y="400" width="270" height="10" rx="3"/><rect x="20" y="430" width="270" height="10" rx="3"/>
      <rect x="680" y="400" width="260" height="10" rx="3"/><rect x="680" y="430" width="260" height="10" rx="3"/>
      <rect x="476" y="250" width="8" height="200"/><path d="M484 256 Q520 266 560 254 Q540 280 560 304 Q520 290 484 300 Z"/>
    </g>`;
}

function lairBack(): string {
  return `<path d="M0 0 L0 540 L150 540 L170 420 L120 340 L160 260 L110 160 L150 60 L120 0 Z" fill="#5a1e0e"/>
    <path d="M960 0 L960 540 L800 540 L790 430 L850 330 L800 250 L860 150 L820 60 L860 0 Z" fill="#5a1e0e"/>
    <path d="M0 400 Q200 360 400 390 Q600 350 800 380 Q900 370 960 380 V540 H0 Z" fill="#8f3a1c" opacity="0.8"/>
    <g fill="#3c1208">
      ${frond(150, 470, -70, 230)}${frond(120, 470, -100, 200, true)}${frond(830, 470, -110, 230, true)}${frond(860, 470, -80, 200)}
    </g>`;
}

function groundAndFerns(id: StageId): string {
  const fill = id === 'lair' ? '#1f0904' : '#24130a';
  return `<path d="M0 ${GROUND_Y - 6} Q160 ${GROUND_Y - 18} 320 ${GROUND_Y - 4} Q480 ${GROUND_Y + 8} 640 ${GROUND_Y - 6} Q800 ${GROUND_Y - 16} 960 ${GROUND_Y - 4} V540 H0 Z" fill="${fill}"/>
    <g fill="#160b04">
      ${frond(-20, 540, -55, 210)}${frond(10, 548, -30, 180)}${frond(980, 540, -125, 210, true)}${frond(950, 548, -150, 180, true)}
    </g>`;
}

export interface StageOpts {
  id: StageId;
  hero: string;        // Figur-Markup (schaut nach links, wird gespiegelt)
  foe: string;         // Figur-Markup (schaut nach links)
  foeScale: number;
  heroClass: string;
  foeClass: string;
  label: string;
}

export function stageSvg(o: StageOpts): string {
  const back = o.id === 'lair' ? lairBack() : o.id === 'training' ? trainingBack() : forestBack();
  const foeX = o.id === 'lair' ? 700 : 690;
  return `<svg class="stage-svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" role="img" aria-label="${o.label}" preserveAspectRatio="xMidYMid slice">
    <defs>${lightDefs(o.id)}</defs>
    <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#light-${o.id})"/>
    ${back}
    ${groundAndFerns(o.id)}
    <g transform="translate(260 ${GROUND_Y})"><g class="fig hero ${o.heroClass}" color="#160b04" fill="#160b04">
      <g transform="scale(-1.12 1.12)">${o.hero}</g></g></g>
    <g transform="translate(${foeX} ${GROUND_Y})"><g class="fig foe ${o.foeClass}" color="#160b04" fill="#160b04">
      <g transform="scale(${o.foeScale})">${o.foe}</g></g></g>
  </svg>`;
}

// ---------- Holzschnitte ----------

const HATCH = `<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="#2b2116" stroke-width="1"/></pattern>
  <pattern id="hatch-fine" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="#2b2116" stroke-width="0.7"/></pattern>`;

function house(x: number, w: number, h: number, roof: number, chimney: boolean): string {
  const y = 280;
  return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="#efe3c8" stroke="#2b2116" stroke-width="3"/>
    <rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="url(#hatch-fine)" opacity="0.5"/>
    <polygon points="${x - 12},${y - h} ${x + w / 2},${y - h - roof} ${x + w + 12},${y - h}" fill="#2b2116"/>
    ${[1, 2, 3].map((i) => `<line x1="${x - 12 + (w + 24) * i / 4 - 4}" y1="${y - h - 2}" x2="${x + w / 2}" y2="${y - h - roof + 6}" stroke="#efe3c8" stroke-width="1.4" opacity="0.7"/>`).join('')}
    <rect x="${x + w / 2 - 10}" y="${y - 34}" width="20" height="34" fill="#2b2116"/>
    <rect x="${x + 10}" y="${y - h + 14}" width="16" height="16" fill="#2b2116"/><rect x="${x + w - 26}" y="${y - h + 14}" width="16" height="16" fill="#e8a145"/>
    ${chimney ? `<rect x="${x + w - 30}" y="${y - h - roof + 10}" width="14" height="34" fill="#2b2116"/>
      <path d="M${x + w - 23} ${y - h - roof + 4} q-12 -14 0 -28 q12 -14 0 -28 q-10 -12 4 -24" fill="none" stroke="#2b2116" stroke-width="2.5"/>` : ''}`;
}

export function villageBanner(): string {
  return `<svg class="woodcut" viewBox="0 0 960 330" role="img" aria-label="Holzschnitt: das Dorf Moosgrund am Rand des Brackenwalds">
    <defs>${HATCH}</defs>
    <rect width="960" height="330" fill="#efe3c8"/>
    <rect width="960" height="200" fill="url(#hatch)" opacity="0.55"/>
    <circle cx="790" cy="70" r="34" fill="#efe3c8" stroke="#2b2116" stroke-width="2.5"/>
    <path d="M0 200 Q140 150 300 180 Q460 140 620 176 Q780 150 960 186 V200 H0 Z" fill="#2b2116" opacity="0.9"/>
    <g fill="#2b2116">${FAR.map((x, i) => tree(x, 206, 70 + (i % 3) * 22, 18)).join('')}</g>
    <rect x="0" y="200" width="960" height="130" fill="#efe3c8"/>
    ${house(150, 120, 80, 70, true)}${house(330, 150, 96, 84, false)}${house(540, 110, 74, 64, true)}${house(700, 130, 86, 76, true)}
    <g fill="#2b2116"><rect x="478" y="196" width="8" height="84"/><path d="M486 200 L540 210 L486 222 Z"/></g>
    <path d="M0 282 Q240 274 480 284 Q720 292 960 280 V330 H0 Z" fill="#2b2116"/>
    <path d="M420 330 Q470 300 482 284 L498 284 Q500 300 540 330 Z" fill="#efe3c8"/>
    <g fill="#2b2116">${frond(-10, 330, -50, 160)}${frond(20, 336, -25, 140)}${frond(970, 330, -130, 160, true)}${frond(940, 336, -155, 140, true)}</g>
    <rect x="2" y="2" width="956" height="326" fill="none" stroke="#2b2116" stroke-width="4"/>
    <rect x="9" y="9" width="942" height="312" fill="none" stroke="#2b2116" stroke-width="1.2"/>
  </svg>`;
}

/** Kleine Holzschnitt-Vignetten für die Orte im Dorf. */
export function vignette(kind: 'forest' | 'training' | 'healer' | 'smith' | 'inn' | 'bank' | 'sheet' | 'shadows'): string {
  const ink = '#2b2116';
  let art = '';
  switch (kind) {
    case 'forest':
      art = `<g fill="${ink}">${tree(40, 92, 70, 18)}${tree(64, 96, 84, 22)}${tree(86, 92, 62, 16)}</g>`;
      break;
    case 'training':
      art = `<g fill="${ink}"><g transform="rotate(40 60 60)"><rect x="57" y="14" width="6" height="80"/><rect x="46" y="76" width="28" height="6"/></g>
        <g transform="rotate(-40 60 60)"><rect x="57" y="14" width="6" height="80"/><rect x="46" y="76" width="28" height="6"/></g></g>`;
      break;
    case 'healer':
      art = `<g fill="${ink}"><path d="M30 64 H90 Q88 98 60 100 Q32 98 30 64 Z"/><rect x="58" y="22" width="8" height="52" transform="rotate(25 62 48)"/>
        <ellipse cx="38" cy="40" rx="12" ry="5" transform="rotate(-40 38 40)"/><ellipse cx="84" cy="36" rx="12" ry="5" transform="rotate(40 84 36)"/></g>`;
      break;
    case 'smith':
      art = `<g fill="${ink}"><path d="M20 56 H96 Q92 70 74 72 L72 86 H90 V96 H30 V86 H48 L46 72 Q30 70 20 56 Z"/>
        <g transform="rotate(-30 60 40)"><rect x="56" y="10" width="6" height="44"/><rect x="44" y="8" width="30" height="14" rx="2"/></g></g>`;
      break;
    case 'inn':
      art = `<g fill="${ink}"><rect x="34" y="34" width="44" height="62" rx="6"/><path d="M78 46 Q100 48 98 66 Q96 82 78 82 V74 Q88 74 88 64 Q88 54 78 54 Z"/>
        <path d="M30 36 Q36 18 52 26 Q60 12 74 24 Q88 18 84 36 Z"/></g>`;
      break;
    case 'bank':
      art = `<g fill="${ink}"><rect x="24" y="50" width="72" height="44" rx="4"/><path d="M24 52 Q60 22 96 52 Z"/>
        <rect x="54" y="62" width="12" height="14" fill="#efe3c8"/></g>`;
      break;
    case 'sheet':
      art = `<g fill="${ink}"><rect x="30" y="20" width="60" height="80" rx="4"/>
        ${[34, 46, 58, 70, 82].map((y) => `<rect x="38" y="${y}" width="44" height="3" fill="#efe3c8"/>`).join('')}</g>`;
      break;
    case 'shadows':
      art = `<g fill="${ink}"><path d="M14 74 Q60 96 106 74 Q100 90 60 92 Q20 90 14 74 Z"/>
        <path d="M52 74 L54 46 Q60 36 66 46 L68 74 Z"/><circle cx="60" cy="40" r="7"/>
        <rect x="74" y="20" width="3" height="66" transform="rotate(14 75 53)"/>
        <path d="M20 102 Q40 96 60 102 Q80 108 100 102" fill="none" stroke="${ink}" stroke-width="2"/></g>`;
      break;
  }
  return `<svg class="vignette" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="56" fill="#efe3c8" stroke="${ink}" stroke-width="3"/>
    <circle cx="60" cy="60" r="50" fill="none" stroke="${ink}" stroke-width="1"/>
    ${art}</svg>`;
}
