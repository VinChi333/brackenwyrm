// Macht aus dist/index.html eine Datei für die claude.ai-Vorschauseite (dist/brackenwyrm.html):
// ohne eigenes Dokumentgerüst, mit <title> und Style ganz oben.
// Gebaut im Modus "artifact": ohne Serververbindung, weil die Vorschauseite keine fremden Server erreichen darf.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');

const out = `<meta charset="utf-8">
${title}
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#241a12">
${styles}
${body}
${scripts}
`;
writeFileSync('dist-artifact/brackenwyrm.html', out);
console.log(`dist-artifact/brackenwyrm.html: ${(out.length / 1024).toFixed(0)} KB`);
