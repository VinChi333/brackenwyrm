import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Zwei Bauweisen:
//  - Netlify (normal): Code und Stil in kleinen Dateien, Bilder, Schriften und Klänge als eigene Dateien.
//    So ist das Spiel nach wenigen hundert KB spielbereit, Bilder laden nach Bedarf und bleiben im Browser zwischengespeichert.
//  - Vorschau auf claude.ai (--mode artifact): alles in EINER html-Datei, weil die Vorschauseite nur eine Datei zeigt.
export default defineConfig(({ mode }) => mode === 'artifact'
  ? {
      plugins: [viteSingleFile()],
      build: { assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2020' },
    }
  : {
      base: './',
      build: { assetsInlineLimit: 2048, cssCodeSplit: false, target: 'es2020', chunkSizeWarningLimit: 1500 },
    });
