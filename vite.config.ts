import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Zwei Bauweisen:
//  - Netlify (normal): Code und Stil in kleinen Dateien, Bilder, Schriften und Klänge als eigene Dateien.
//    So ist das Spiel nach wenigen hundert KB spielbereit, Bilder laden nach Bedarf und bleiben im Browser zwischengespeichert.
//  - Vorschau auf claude.ai (--mode artifact): alles in EINER html-Datei, weil die Vorschauseite nur eine Datei zeigt.

/**
 * Beschreibung und Vorschaubild für geteilte Links (WhatsApp, Facebook, Discord …).
 * VITE_SITE_URL = Adresse des Spiels, z. B. https://brackenwyrm.at — Facebook und WhatsApp brauchen das Bild
 * mit voller Adresse. Ohne sie steht ein relativer Pfad drin (reicht manchen Diensten, nicht allen).
 */
function shareTags(site: string): Plugin {
  const base = site.replace(/\/$/, '');
  const img = base ? `${base}/og.jpg` : './og.jpg';
  const title = 'Brackenwyrm';
  const desc = 'Ein Rollenspiel im Farnwald, gespielt im Browser oder am Handy. Kämpfe im Brackenwald, besiege deine Meister und stell dich dem Wyrm, der in der Farnschlucht schläft.';
  const tags = [
    `<meta name="description" content="${desc}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${title}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${desc}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Ein schlafender Drache im Farnwald unter dem Vollmond">`,
    `<meta property="og:locale" content="de_AT">`,
    ...(base ? [`<meta property="og:url" content="${base}/">`, `<link rel="canonical" href="${base}/">`] : []),
    `<meta name="twitter:card" content="summary_large_image">`,
  ];
  return { name: 'share-tags', transformIndexHtml: (html) => html.replace('</title>', `</title>\n${tags.join('\n')}`) };
}

/** Vorschau-Bau: Bilder aus .artifact-cache/ (verkleinert, siehe scripts/artifact-images.py) statt der Originale einbetten. */
function smallImages(): Plugin {
  const src = path.resolve('src/assets');
  const cache = path.resolve('.artifact-cache');
  return {
    name: 'artifact-small-images',
    enforce: 'pre',
    load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.webp') || !file.startsWith(src + path.sep)) return null;
      const small = path.join(cache, path.relative(src, file));
      if (!existsSync(small)) return null;
      return `export default "data:image/webp;base64,${readFileSync(small).toString('base64')}"`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return mode === 'artifact'
    ? {
        plugins: [smallImages(), viteSingleFile()],
        build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2020' },
      }
    : {
        base: './',
        plugins: [shareTags(env.VITE_SITE_URL ?? '')],
        build: { assetsInlineLimit: 2048, cssCodeSplit: false, target: 'es2020', chunkSizeWarningLimit: 1500 },
      };
});
