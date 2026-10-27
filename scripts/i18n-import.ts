// Übersetzte Arbeitslisten ("Nr<TAB>English" in *.en.tsv) zu src/i18n/en.ts zusammenführen.
//   npx tsx scripts/i18n-import.ts <Ordner mit ids.json und *.en.tsv>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EN } from '../src/i18n/en';

const dir = process.argv[2];
const ids: Record<string, string> = JSON.parse(readFileSync(join(dir, 'ids.json'), 'utf8'));
const out: Record<string, string> = { ...EN };
let added = 0;
const problems: string[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.en.tsv'))) {
  for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) { problems.push(`${f}: Zeile ohne Tab: ${line.slice(0, 60)}`); continue; }
    const id = line.slice(0, tab).trim();
    const en = line.slice(tab + 1).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    const key = ids[id];
    if (!key) { problems.push(`${f}: unbekannte Nr ${id}`); continue; }
    const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join();
    if (ph(key) !== ph(en)) problems.push(`${f}: Nr ${id} Platzhalter ${ph(key)} ≠ ${ph(en)}`);
    out[key] = en;
    added++;
  }
}
const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
writeFileSync(new URL('../src/i18n/en.ts', import.meta.url),
  `// Englische Texte. Schlüssel = deutscher Text. Erzeugt mit scripts/i18n-import.ts, darf aber von Hand ergänzt werden.\nexport const EN: Record<string, string> = {\n${body}\n};\n`);
console.log(`${added} Übersetzungen übernommen, insgesamt ${Object.keys(out).length}.`);
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
