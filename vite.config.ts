import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Der Prototyp wird zu EINER html-Datei gebaut: Code, Stil und Schriften stecken darin.
// So läuft er offline, im Browser, und später unverändert in Steam- und Handy-Hüllen.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: 'es2020',
  },
});
