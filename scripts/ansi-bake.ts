// Erzeugt die Retro-Grafiken: Vektorszenen werden auf ein grobes Raster verkleinert und
// mit geordnetem Dithering auf die 16 Farben der alten PC-Grafik (EGA/ANSI) gebracht.
// Ergebnis: src/ui/ansi/baked.ts. Aufruf: npm run ansi

import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { figureJobs, forestBg, lairBg, logoPixels, trainingBg, villageScene } from './ansi/scenes';

export const EGA: [number, number, number][] = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const COLS = 160;

function nearest(r: number, g: number, b: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 16; i++) {
    const [pr, pg, pb] = EGA[i];
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function raster(svgText: string, width: number): { w: number; h: number; rgba: Uint8Array } {
  const r = new Resvg(svgText, { fitTo: { mode: 'width', value: width }, shapeRendering: 2 });
  const img = r.render();
  return { w: img.width, h: img.height, rgba: img.pixels };
}

/** Palettenindizes, -1 = durchsichtig. */
function quantize(w: number, h: number, rgba: Uint8Array, transparent: boolean, spread = 56): number[] {
  const out: number[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3];
      if (transparent && a < 110) { out[y * w + x] = -1; continue; }
      const t = (BAYER[(y % 4) * 4 + (x % 4)] / 16 - 0.47) * spread;
      const r = rgba[i] + t;
      const g = rgba[i + 1] + t;
      const b = rgba[i + 2] + t;
      out[y * w + x] = nearest(r, g, b);
    }
  }
  return out;
}

/** Lauflängen-Kodierung: Farbe als Buchstabe A–P, '.' = durchsichtig, danach optional die Anzahl. */
function rle(px: number[]): string {
  let s = '';
  let i = 0;
  while (i < px.length) {
    const c = px[i];
    let n = 1;
    while (i + n < px.length && px[i + n] === c) n++;
    s += (c < 0 ? '.' : String.fromCharCode(65 + c)) + (n > 1 ? String(n) : '');
    i += n;
  }
  return s;
}

function crop(w: number, h: number, px: number[]) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x] >= 0) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(px[y * w + x]);
  return { x: x0, y: y0, w: cw, h: ch, px: out };
}

const result: Record<string, unknown> = {};
const bgs: Record<string, unknown> = {};
for (const [k, fn] of [['forest', forestBg], ['training', trainingBg], ['lair', lairBg]] as const) {
  const r = raster(fn(), COLS);
  bgs[k] = { w: r.w, h: r.h, d: rle(quantize(r.w, r.h, r.rgba, false)) };
}
result.bg = bgs;
{
  const r = raster(villageScene(), COLS);
  result.village = { w: r.w, h: r.h, d: rle(quantize(r.w, r.h, r.rgba, false)) };
}
{
  const l = logoPixels();
  result.logo = { w: l.w, h: l.h, d: rle(l.px) };
}
const sprites: Record<string, unknown> = {};
for (const job of figureJobs()) {
  const r = raster(job.svg, COLS);
  const c = crop(r.w, r.h, quantize(r.w, r.h, r.rgba, true, 44));
  sprites[job.key] = { x: c.x, y: c.y, w: c.w, h: c.h, d: rle(c.px) };
}
result.sprites = sprites;

const body = `// Automatisch erzeugt von scripts/ansi-bake.ts – nicht von Hand bearbeiten.
// Bilder als Lauflängen: Buchstabe A–P = Farbe 0–15 der EGA-Palette, '.' = durchsichtig, Zahl = Anzahl.
import type { AnsiBank } from './types';

export const ANSI: AnsiBank = ${JSON.stringify(result)};
`;
writeFileSync('src/ui/ansi/baked.ts', body);
const size = Buffer.byteLength(body);
console.log(`src/ui/ansi/baked.ts: ${(size / 1024).toFixed(0)} KB, ${Object.keys(sprites).length} Figuren`);
