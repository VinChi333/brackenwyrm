// Szenen und Figuren für den Retro-Stil, als Vektorgrafik in Farben,
// die sich gut auf die 16-Farben-Palette von damals abbilden lassen.
// Wird nur beim Erzeugen der Grafiken gebraucht (npm run ansi), nicht im Spiel selbst.

import { MASTERS } from '../../src/content/masters';
import { DRAGON, MONSTERS } from '../../src/content/monsters';
import { SPECIALTIES, SPECIALTY_ORDER } from '../../src/content/specialties';
import type { ShapeId } from '../../src/game/types';
import { creature, humanoid } from '../../src/ui/art/silhouettes';
import { FAR, GROUND_Y, MID, STAGE_H, STAGE_W, frond, tree } from '../../src/ui/art/stage';

// Schachbrett-Muster in Rastergröße (6 Einheiten = 1 Pixel): das klassische ░-Dithering.
const checker = (id: string, a: string, b: string) =>
  `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${b}"/>
    <rect width="6" height="6" fill="${a}"/><rect x="6" y="6" width="6" height="6" fill="${a}"/></pattern>`;
const PATTERNS = `<defs>${checker('dg', '#00aa00', '#000000')}${checker('db', '#0000aa', '#000000')}${checker('dbr', '#aa5500', '#000000')}
  ${checker('dr', '#aa0000', '#000000')}${checker('dgb', '#00aa00', '#0000aa')}</defs>`;

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${PATTERNS}${body}</svg>`;

const STARS: [number, number][] = [
  [40, 30], [96, 74], [150, 22], [212, 58], [268, 18], [330, 64], [388, 30], [446, 80], [520, 26], [576, 60],
  [640, 20], [818, 40], [870, 90], [920, 28], [60, 120], [300, 130], [500, 140], [900, 150], [180, 160], [760, 180],
];
const stars = (fill = '#ffffff', n = STARS.length) => STARS.slice(0, n).map(([x, y]) => `<rect x="${x}" y="${y}" width="6" height="6" fill="${fill}"/>`).join('');

export function forestBg(): string {
  return svg(STAGE_W, STAGE_H, `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000"/><stop offset="0.4" stop-color="#000022"/><stop offset="0.75" stop-color="#000099"/></linearGradient></defs>
    <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#sky)"/>
    ${stars()}
    <circle cx="740" cy="110" r="46" fill="#ffffff"/><circle cx="726" cy="100" r="9" fill="#aaaaaa"/><circle cx="756" cy="124" r="7" fill="#aaaaaa"/>
    <path d="M0 400 Q120 360 240 384 Q360 350 480 376 Q600 346 720 378 Q840 356 960 384 V540 H0 Z" fill="#000000"/>
    <g fill="url(#dg)">${MID.map((x, i) => tree(x, 452, 300 + (i % 2) * 50, 70)).join('')}</g>
    <path d="M0 ${GROUND_Y - 6} Q160 ${GROUND_Y - 18} 320 ${GROUND_Y - 4} Q480 ${GROUND_Y + 8} 640 ${GROUND_Y - 6} Q800 ${GROUND_Y - 16} 960 ${GROUND_Y - 4} V540 H0 Z" fill="url(#dbr)"/>
    <path d="M0 ${GROUND_Y - 6} Q160 ${GROUND_Y - 18} 320 ${GROUND_Y - 4} Q480 ${GROUND_Y + 8} 640 ${GROUND_Y - 6} Q800 ${GROUND_Y - 16} 960 ${GROUND_Y - 4}" fill="none" stroke="#00aa00" stroke-width="10"/>
    <g fill="#00aa00">${frond(-20, 540, -55, 210)}${frond(980, 540, -125, 210, true)}</g>
    <g fill="url(#dg)">${frond(10, 548, -30, 180)}${frond(950, 548, -150, 180, true)}</g>`);
}

export function trainingBg(): string {
  const posts = [40, 150, 260, 700, 810, 920].map((x) => `<rect x="${x - 8}" y="380" width="16" height="84"/>`).join('');
  return svg(STAGE_W, STAGE_H, `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000055"/><stop offset="0.35" stop-color="#aa00aa"/><stop offset="0.6" stop-color="#ff5555"/><stop offset="0.75" stop-color="#ffff55"/></linearGradient></defs>
    <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#sky)"/>
    ${stars('#ffffff', 8)}
    <circle cx="480" cy="372" r="80" fill="#ffff55"/>
    <g fill="#552200"><polygon points="70,402 130,340 190,402"/><polygon points="750,398 820,334 890,398"/></g>
    <g fill="#aa0000"><polygon points="62,404 130,334 198,404" opacity="0.9"/><polygon points="742,400 820,328 898,400" opacity="0.9"/></g>
    <rect x="88" y="402" width="84" height="46" fill="#555555"/><rect x="770" y="398" width="100" height="50" fill="#555555"/>
    <rect x="104" y="414" width="16" height="16" fill="#ffff55"/><rect x="800" y="410" width="16" height="16" fill="#ffff55"/>
    <g fill="#aa5500">${posts}
      <rect x="20" y="398" width="270" height="12"/><rect x="20" y="430" width="270" height="12"/>
      <rect x="680" y="398" width="260" height="12"/><rect x="680" y="430" width="260" height="12"/></g>
    <rect x="474" y="230" width="10" height="230" fill="#aa5500"/><path d="M484 236 Q520 246 566 232 Q544 262 566 292 Q520 278 484 288 Z" fill="#aa0000"/>
    <path d="M0 ${GROUND_Y - 6} Q240 ${GROUND_Y - 14} 480 ${GROUND_Y} Q720 ${GROUND_Y + 6} 960 ${GROUND_Y - 6} V540 H0 Z" fill="#552200"/>
    <path d="M0 ${GROUND_Y - 6} Q240 ${GROUND_Y - 14} 480 ${GROUND_Y} Q720 ${GROUND_Y + 6} 960 ${GROUND_Y - 6}" fill="none" stroke="#aa5500" stroke-width="8"/>`);
}

export function lairBg(): string {
  return svg(STAGE_W, STAGE_H, `
    <defs><radialGradient id="glow" cx="50%" cy="55%" r="65%">
      <stop offset="0" stop-color="#ff5555"/><stop offset="0.35" stop-color="#aa0000"/><stop offset="0.75" stop-color="#330000"/><stop offset="1" stop-color="#000000"/></radialGradient></defs>
    <rect width="${STAGE_W}" height="${STAGE_H}" fill="url(#glow)"/>
    <path d="M0 0 L0 540 L150 540 L170 420 L120 340 L160 260 L110 160 L150 60 L120 0 Z" fill="url(#dbr)"/>
    <path d="M960 0 L960 540 L800 540 L790 430 L850 330 L800 250 L860 150 L820 60 L860 0 Z" fill="url(#dbr)"/>
    <path d="M120 0 L150 60 L110 160 L160 260 L120 340 L170 420" fill="none" stroke="#aa5500" stroke-width="8"/>
    <path d="M860 0 L820 60 L860 150 L800 250 L850 330 L790 430" fill="none" stroke="#aa5500" stroke-width="8"/>
    <g fill="#005500">${frond(150, 470, -70, 230)}${frond(830, 470, -110, 230, true)}</g>
    <g fill="url(#dg)">${frond(120, 470, -100, 200, true)}${frond(860, 470, -80, 200)}</g>
    <path d="M0 ${GROUND_Y - 6} Q480 ${GROUND_Y + 10} 960 ${GROUND_Y - 6} V540 H0 Z" fill="url(#dr)"/>
    <path d="M0 ${GROUND_Y - 6} Q480 ${GROUND_Y + 10} 960 ${GROUND_Y - 6}" fill="none" stroke="#ff5555" stroke-width="6"/>`);
}

function house(x: number, w: number, h: number, roof: number, chimney: boolean): string {
  const y = 300;
  return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="#555555"/>
    <rect x="${x}" y="${y - h}" width="${w}" height="10" fill="#333333"/>
    <polygon points="${x - 14},${y - h} ${x + w / 2},${y - h - roof} ${x + w + 14},${y - h}" fill="#aa0000"/>
    <polygon points="${x - 14},${y - h} ${x + w / 2},${y - h - roof} ${x + w / 2},${y - h}" fill="#880000"/>
    <rect x="${x + w / 2 - 12}" y="${y - 40}" width="24" height="40" fill="#aa5500"/>
    <rect x="${x + 12}" y="${y - h + 18}" width="20" height="20" fill="#ffff55"/><rect x="${x + w - 32}" y="${y - h + 18}" width="20" height="20" fill="#ffff55"/>
    ${chimney ? `<rect x="${x + w - 34}" y="${y - h - roof + 8}" width="16" height="40" fill="#333333"/>
      <rect x="${x + w - 38}" y="${y - h - roof - 26}" width="12" height="12" fill="#777777"/><rect x="${x + w - 26}" y="${y - h - roof - 52}" width="12" height="12" fill="#777777"/>
      <rect x="${x + w - 38}" y="${y - h - roof - 80}" width="12" height="12" fill="#555555"/>` : ''}`;
}

export function villageScene(): string {
  return svg(960, 360, `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000"/><stop offset="0.6" stop-color="#000066"/><stop offset="1" stop-color="#0000aa"/></linearGradient></defs>
    <rect width="960" height="360" fill="url(#sky)"/>
    ${stars()}
    <circle cx="820" cy="70" r="36" fill="#ffffff"/><circle cx="808" cy="62" r="7" fill="#aaaaaa"/>
    <path d="M0 220 Q140 170 300 200 Q460 160 620 196 Q780 170 960 206 V360 H0 Z" fill="url(#db)"/>
    <g fill="url(#dg)">${FAR.map((x, i) => tree(x, 230, 80 + (i % 3) * 24, 20)).join('')}</g>
    <rect x="0" y="226" width="960" height="134" fill="url(#dg)"/>
    ${house(130, 130, 90, 74, true)}${house(330, 160, 104, 88, false)}${house(560, 120, 82, 68, true)}${house(730, 140, 94, 80, true)}
    <rect x="514" y="200" width="10" height="100" fill="#aa5500"/><path d="M524 204 L584 216 L524 230 Z" fill="#ff5555"/>
    <path d="M0 300 Q240 292 480 302 Q720 312 960 298 V360 H0 Z" fill="#00aa00"/>
    <path d="M0 316 Q240 308 480 318 Q720 328 960 314 V360 H0 Z" fill="url(#dg)"/>
    <path d="M440 360 Q480 330 494 302 L520 302 Q526 330 580 360 Z" fill="#aa5500"/>
    <g fill="#55ff55">${frond(-10, 360, -50, 150)}${frond(970, 360, -130, 150, true)}</g>`);
}

// ---------- Figuren ----------

type Pair = [string, string];

const SHAPE_COLORS: Record<ShapeId, Pair> = {
  rat: ['#cc8855', '#552a00'], bat: ['#cc66cc', '#440044'], goblin: ['#77cc55', '#225522'], wolf: ['#cc8844', '#552a00'],
  beetle: ['#5577ff', '#0000aa'], blob: ['#55ff55', '#004400'], bird: ['#aaaaaa', '#333333'], humanoid: ['#cc7733', '#552a00'],
  boar: ['#aa6633', '#552a00'], spider: ['#cc66cc', '#440044'], ghost: ['#aaffff', '#0044aa'], serpent: ['#55ff55', '#003300'],
  bear: ['#aa6633', '#552a00'], troll: ['#88aa77', '#225522'], stag: ['#cccccc', '#444444'], treant: ['#55ff55', '#aa5500'],
  dragon: ['#55ff55', '#005500'],
};

const MONSTER_COLORS: Record<string, Pair> = {
  stechmuecken: ['#dddddd', '#555555'], pilzling: ['#ff5555', '#550000'], sumpfkroete: ['#77aa55', '#222200'],
  irrlicht: ['#ffff88', '#aa5500'], geisterhirsch: ['#aaffff', '#0044aa'], nachtmahr: ['#6666aa', '#000000'],
  giftnatter: ['#ff5555', '#330000'], eisenkaefer: ['#bbbbbb', '#222222'], grabwicht: ['#bbbbcc', '#222244'],
  farngeist: ['#55ff55', '#004400'], knochenritter: ['#ffffff', '#555555'], waldhexe: ['#aa55aa', '#220022'],
  steintroll: ['#aaaaaa', '#333333'], moortroll: ['#88aa44', '#225500'], harpyie: ['#ff5555', '#aa0000'],
  sturmrabe: ['#6666cc', '#000022'], schattenwolf: ['#5555aa', '#000011'], schattenluchs: ['#666688', '#0a0a0a'],
  wyrmling: ['#ffaa55', '#441100'], steinwurm: ['#999999', '#222222'], wyrmwaechter: ['#ff5555', '#220000'],
  trollkoenig: ['#bbbb55', '#222200'], rudelfuehrer: ['#aaaaaa', '#222222'], dornengolem: ['#55aa55', '#221100'],
  wilderer: ['#55aa55', '#112211'], raeuberhauptmann: ['#aa5555', '#220000'], klingenwilderer: ['#777777', '#111111'],
  huegelkobold: ['#aaaa55', '#222200'], kraehe: ['#8888bb', '#222255'],
};

function mix(a: string, b: string): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round((p(a, i) + p(b, i)) / 2).toString(16).padStart(2, '0')).join('');
}

function paint(markup: string, [top, bottom]: Pair, y1: number, y2 = 0): string {
  return `<defs><linearGradient id="fg" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <g fill="#000000" stroke="#000000" stroke-width="9" color="#000000" stroke-linejoin="round">${markup}</g>
    <g fill="url(#fg)" color="${mix(top, bottom)}">${markup}</g>`;
}

/** Höhenbereich jeder Form (oben, unten), damit der Farbverlauf die ganze Figur überspannt. */
const SPAN: Record<ShapeId, [number, number]> = {
  rat: [-75, 0], bat: [-200, -100], goblin: [-150, 0], wolf: [-170, 0], beetle: [-110, 0], blob: [-140, 0],
  bird: [-270, -110], humanoid: [-215, 0], boar: [-130, 0], spider: [-150, 0], ghost: [-210, -10], serpent: [-200, 0],
  bear: [-160, 0], troll: [-250, 0], stag: [-290, 0], treant: [-300, 0], dragon: [-400, 0],
};

function figureSvg(markup: string, colors: Pair, x: number, sx: number, sy: number, span: [number, number] = SPAN.humanoid): string {
  return svg(STAGE_W, STAGE_H, `<g transform="translate(${x} ${GROUND_Y}) scale(${sx} ${sy})">${paint(markup, colors, span[0], span[1])}</g>`);
}

export interface FigureJob { key: string; svg: string }

export function figureJobs(): FigureJob[] {
  const jobs: FigureJob[] = [];
  for (const id of SPECIALTY_ORDER) {
    const markup = humanoid(SPECIALTIES[id].heroProp, null, { hood: id === 'schleich', shield: id === 'klinge', cape: id === 'wurzel' });
    jobs.push({ key: `hero:${id}`, svg: figureSvg(markup, ['#aaaaff', '#0000aa'], 260, -1.12, 1.12) });
  }
  for (const m of MONSTERS) {
    const markup = creature(m.shape, m.eyes ?? '#f3c06a', m.prop);
    const colors = MONSTER_COLORS[m.id] ?? SHAPE_COLORS[m.shape];
    const s = m.scale ?? 1;
    jobs.push({ key: `m:${m.id}`, svg: figureSvg(markup, colors, 690, s, s, SPAN[m.shape]) });
  }
  for (const m of MASTERS) {
    jobs.push({ key: `master:${m.level}`, svg: figureSvg(humanoid(m.prop, null, { cape: true }), ['#ffff55', '#aa5500'], 690, 1.14, 1.14) });
  }
  jobs.push({ key: 'dragon', svg: figureSvg(creature('dragon', DRAGON.eyes ?? '#ffcf5a'), SHAPE_COLORS.dragon, 700, 0.95, 0.95, SPAN.dragon) });
  return jobs;
}

// ---------- Logo in Blockschrift ----------

const GLYPHS: Record<string, string[]> = {
  B: ['1110', '1001', '1110', '1001', '1001', '1110'],
  R: ['1110', '1001', '1110', '1010', '1001', '1001'],
  A: ['0110', '1001', '1111', '1001', '1001', '1001'],
  C: ['0111', '1000', '1000', '1000', '1000', '0111'],
  K: ['1001', '1010', '1100', '1010', '1001', '1001'],
  E: ['1111', '1000', '1110', '1000', '1000', '1111'],
  N: ['1001', '1101', '1011', '1001', '1001', '1001'],
  W: ['10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001'],
};

/** Logo als Palettenindizes (-1 = durchsichtig). Jede Glyphenzelle wird 3×3 Pixel groß. */
export function logoPixels(text = 'BRACKENWYRM'): { w: number; h: number; px: number[] } {
  const S = 3;
  const gap = 1;
  const glyphs = [...text].map((c) => GLYPHS[c]);
  const w = glyphs.reduce((sum, g) => sum + (g[0].length + gap) * S, 0) + 2;
  const h = 6 * S + 2;
  const px = new Array(w * h).fill(-1);
  // Farbbänder von oben nach unten: gelb, gelb/braun, braun, rot
  const band = (y: number, x: number) => {
    const r = y / (6 * S);
    if (r < 0.3) return 14;
    if (r < 0.5) return (x + y) % 2 ? 14 : 6;
    if (r < 0.75) return 6;
    return (x + y) % 2 ? 6 : 4;
  };
  let ox = 0;
  for (const g of glyphs) {
    for (let gy = 0; gy < 6; gy++) {
      for (let gx = 0; gx < g[0].length; gx++) {
        if (g[gy][gx] !== '1') continue;
        for (let sy = 0; sy < S; sy++) {
          for (let sx = 0; sx < S; sx++) {
            const x = ox + gx * S + sx;
            const y = gy * S + sy;
            // Schatten
            const shx = x + 2, shy = y + 2;
            if (px[shy * w + shx] === -1) px[shy * w + shx] = 8;
            px[y * w + x] = sy === 0 && gy > 0 && g[gy - 1][gx] !== '1' ? 15 : sy === 0 && gy === 0 ? 15 : band(y, x);
          }
        }
      }
    }
    ox += (g[0].length + gap) * S;
  }
  return { w, h, px };
}
