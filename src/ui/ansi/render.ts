// Zeichnet die Retro-Grafiken (16 Farben) auf kleine Leinwände, die per CSS
// pixelgenau vergrößert werden. Kostet kaum Rechenleistung: ein Bild wird einmal
// entschlüsselt und danach nur noch kopiert.

import { ANSI } from './baked';
import type { AnsiImage, AnsiSprite } from './types';

export const EGA: [number, number, number][] = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];

export const GRID_W = 160;
export const GRID_H = 90;

const cache = new Map<string, ImageData>();

function lookup(key: string): AnsiImage | AnsiSprite | undefined {
  if (key === 'village') return ANSI.village;
  if (key === 'logo') return ANSI.logo;
  if (key.startsWith('bg:')) return ANSI.bg[key.slice(3) as 'forest'];
  if (key.startsWith('sp:')) return ANSI.sprites[key.slice(3)];
  return undefined;
}

export function sprite(key: string): AnsiSprite | undefined {
  return ANSI.sprites[key];
}

function decode(img: AnsiImage): ImageData {
  const data = new ImageData(img.w, img.h);
  const px = data.data;
  let i = 0;
  const re = /([A-P.])(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(img.d))) {
    const n = m[2] ? Number(m[2]) : 1;
    if (m[1] === '.') { i += n; continue; }
    const [r, g, b] = EGA[m[1].charCodeAt(0) - 65];
    for (let k = 0; k < n; k++, i++) {
      const o = i * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return data;
}

/** Markup für eine Retro-Leinwand. Gefüllt wird sie danach mit paintAnsi(). */
export function ansiCanvas(key: string, cls = '', style = '', label = ''): string {
  const img = lookup(key);
  if (!img) return '';
  return `<canvas class="ansi ${cls}" data-ansi="${key}" width="${img.w}" height="${img.h}" style="${style}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}></canvas>`;
}

/** Figur auf der Bühne, an ihrer Rasterposition. */
export function ansiFigure(key: string, cls: string): string {
  const sp = sprite(key);
  if (!sp) return '';
  const style = `left:${(sp.x / GRID_W) * 100}%;top:${(sp.y / GRID_H) * 100}%;width:${(sp.w / GRID_W) * 100}%;`;
  return ansiCanvas(`sp:${key}`, `fig ${cls}`, style);
}

export function paintAnsi(root: ParentNode): void {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-ansi]').forEach((c) => {
    const key = c.dataset.ansi!;
    let data = cache.get(key);
    if (!data) {
      const img = lookup(key);
      if (!img) return;
      data = decode(img);
      cache.set(key, data);
    }
    c.getContext('2d')?.putImageData(data, 0, 0);
  });
}
