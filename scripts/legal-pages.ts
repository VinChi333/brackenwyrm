// Schreibt Impressum und Datenschutzerklärung als eigene Seiten (public/impressum.html, public/datenschutz.html),
// damit sie auch ohne Spiel erreichbar sind (für Steam, App-Stores und Suchmaschinen). Läuft vor jedem Build.
import { writeFileSync } from 'node:fs';
import { datenschutzHtml, impressumHtml } from '../src/content/legal';

const page = (title: string, body: string) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Brackenwyrm</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0d0f1c; color: #e8e2d4; font: 17px/1.6 Georgia, 'Times New Roman', serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { color: #f2c86b; font-weight: normal; letter-spacing: .04em; }
  h2 { color: #f2c86b; font-size: 1.1em; margin-top: 2em; }
  a { color: #8fc7e8; }
  .muted { color: #9a96a8; }
  ul.plain { padding-left: 1.2em; }
  li { margin: .3em 0; }
</style></head>
<body><main><p><a href="./">← Zum Spiel</a></p><h1>${title}</h1>${body}</main></body></html>
`;

writeFileSync(new URL('../public/impressum.html', import.meta.url), page('Impressum', impressumHtml()));
writeFileSync(new URL('../public/datenschutz.html', import.meta.url), page('Datenschutzerklärung', datenschutzHtml()));
console.log('Impressum und Datenschutz geschrieben.');
