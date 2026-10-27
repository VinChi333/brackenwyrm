// Prüfer für die Übersetzung.
//   npx tsx scripts/i18n-check.ts          → fehlende englische Texte, unbenutzte Einträge, deutscher Text ohne t()
//   npx tsx scripts/i18n-check.ts --list   → zusätzlich alle Fundstellen ausgeben
//   npx tsx scripts/i18n-check.ts --keys   → alle Schlüssel als JSON (für die Übersetzungsarbeit)
// Beendet sich mit Fehlercode, wenn etwas fehlt (für npm test).
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EN } from '../src/i18n/en';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const args = new Set(process.argv.slice(2));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

// Dateien ohne Spieltext (oder mit eigener Behandlung).
const SKIP_FILES = [/\/i18n\/en/, /\/content\/badwords\.ts$/, /\/main\.ts$/];
// Wörter/Muster, die keine Spieltexte sind.
const NOT_TEXT = [
  /^[a-z0-9_:\-./#?=&%[\]]*$/,          // ids, Pfade, Aktionen
  /^[A-Z][a-zA-Z]*(Up|Down|Left|Right)$/, // Tasten
  /^(Enter|Escape|Tab|Space|Backspace)$/,
  /^https?:\/\//,
  /^[\s\d.,:;+\-–—×%°/()|·•…→←↑↓✓✗★☆♥]*$/,
  /\.(webp|png|jpg|mp3|svg|css|ts|js)$/,
  /^\/(rest|auth)\//, /\?select=/, /=eq\./, /^Bearer/, /resolution=/, /^BW\d:/, /^\s*data-[a-z-]+="/, /^\[data-/, /^\.[a-z-]+ \./,
];

const keys = new Map<string, string[]>();   // Schlüssel → Fundstellen
const loose: { at: string; text: string }[] = [];

function addKey(k: string, at: string): void {
  const list = keys.get(k) ?? [];
  list.push(at);
  keys.set(k, list);
}

function templateKey(tpl: ts.TemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(tpl)) return tpl.text;
  let k = tpl.head.text;
  tpl.templateSpans.forEach((sp, i) => { k += `{${i}}` + sp.literal.text; });
  return k;
}

function looksLikeText(raw: string): boolean {
  const s = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\{\d+\}/g, ' ').trim();
  if (!s) return false;
  if (NOT_TEXT.some((r) => r.test(s))) return false;
  if (/[äöüÄÖÜß„“]/.test(s)) return true;
  const words = s.match(/[A-Za-z]{2,}/g) ?? [];
  if (!words.length) return false;
  // CSS-Klassen, Attribute, Code-Schnipsel ausschließen
  if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && s === s.toLowerCase()) return false;
  if (/^(var\(|rgba?\(|#[0-9a-f]{3,8}|\d+(px|rem|em|%|ms|s)\b)/i.test(s)) return false;
  return words.some((w) => /^[A-ZÄÖÜ]/.test(w)) || words.length >= 2;
}

const TR_FUNCS = new Set(['t', 'tr', 'tk']);

for (const file of walk(SRC)) {
  if (SKIP_FILES.some((r) => r.test(file))) continue;
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const rel = relative(ROOT, file);
  const lines = src.split('\n');
  const isNewsOrServer = /\/i18n\/(news|server)\.ts$/.test(file);

  const visit = (node: ts.Node, inTr: boolean): void => {
    const at = () => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const ignored = () => /i18n-ignore/.test(lines[sf.getLineAndCharacterOfPosition(node.getStart()).line] ?? '');

    if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 't') {
      addKey(templateKey(node.template), at());
      // Ausdrücke im Template weiter prüfen (darin kann wieder Text stehen)
      if (!ts.isNoSubstitutionTemplateLiteral(node.template)) node.template.templateSpans.forEach((sp) => visit(sp.expression, false));
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && TR_FUNCS.has(node.expression.text)) {
      const a0 = node.arguments[0];
      if (a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0))) addKey(a0.text, at());
      node.arguments.slice(1).forEach((x) => visit(x, false));
      if (a0 && !(ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0))) visit(a0, true);
      return;
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (isNewsOrServer && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      // Muster in NEWS / SERVER_TEXTS sind Schlüssel
      if (looksLikeText(node.text)) addKey(node.text, at());
      return;
    }
    if (!inTr && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      const parent = node.parent;
      const isPropName = parent && (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node;
      const isTypeLit = parent && ts.isLiteralTypeNode(parent);
      const isCompare = parent && ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(parent.operatorToken.kind);
      const isIndex = parent && ts.isElementAccessExpression(parent);
      const isCase = parent && ts.isCaseClause(parent);
      if (!isPropName && !isTypeLit && !isCompare && !isIndex && !isCase && !ignored() && looksLikeText(node.text)) loose.push({ at: at(), text: node.text });
      return;
    }
    if (!inTr && ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      const joined = parts.join(' {0} ');
      if (!ignored() && looksLikeText(joined)) loose.push({ at: at(), text: parts.join('${…}') });
      node.templateSpans.forEach((sp) => visit(sp.expression, false));
      return;
    }
    ts.forEachChild(node, (c) => visit(c, inTr));
  };
  visit(sf, false);
}

const missing = [...keys.keys()].filter((k) => EN[k] === undefined);
const unused = Object.keys(EN).filter((k) => !keys.has(k));
const placeholderBad = [...keys.keys()].filter((k) => {
  const en = EN[k];
  if (en === undefined) return false;
  const a = (k.match(/\{\d+\}/g) ?? []).sort().join();
  const b = (en.match(/\{\d+\}/g) ?? []).sort().join();
  return a !== b;
});

if (args.has('--keys')) {
  console.log(JSON.stringify([...keys.keys()], null, 1));
  process.exit(0);
}

const byFile = new Map<string, number>();
for (const l of loose) { const f = l.at.split(':')[0]; byFile.set(f, (byFile.get(f) ?? 0) + 1); }

console.log(`Schlüssel: ${keys.size} · übersetzt: ${keys.size - missing.length} · fehlen: ${missing.length} · unbenutzt: ${unused.length} · Platzhalter falsch: ${placeholderBad.length}`);
console.log(`Deutscher Text ohne t(): ${loose.length}`);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${f}`);
if (args.has('--list')) {
  for (const l of loose) console.log(`${l.at}  ${l.text.slice(0, 140).replace(/\n/g, ' ')}`);
  if (missing.length) { console.log('\nFehlende Übersetzungen:'); for (const k of missing) console.log(`  ${k.slice(0, 140)}   (${keys.get(k)![0]})`); }
  if (unused.length) { console.log('\nUnbenutzt:'); for (const k of unused) console.log(`  ${k.slice(0, 140)}`); }
}
if (placeholderBad.length) { console.log('\nPlatzhalter stimmen nicht überein:'); for (const k of placeholderBad) console.log(`  ${k.slice(0, 120)}  →  ${EN[k].slice(0, 120)}`); }
const strict = args.has('--strict');
process.exit(strict && (missing.length || loose.length || placeholderBad.length) ? 1 : 0);
