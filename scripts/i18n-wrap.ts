// Einmaliges Umbau-Werkzeug: setzt deutschen Spieltext in t(...) bzw. t`...`, ohne die deutsche Ausgabe zu ändern.
//   npx tsx scripts/i18n-wrap.ts src/content/monsters.ts [weitere Dateien …]   (schreibt die Dateien um)
//   --dry  nur zählen
// HTML-Vorlagen werden nicht als Ganzes übersetzt: nur die Textstücke zwischen Block-Tags und Attribute wie
// placeholder/aria-label/alt/title. Inline-Tags (span, b, strong, em …) bleiben Teil des Satzes.
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry');

const NOT_TEXT = [
  /^[a-z0-9_:\-./#?=&%[\]]*$/,
  /^[A-Z][a-zA-Z]*(Up|Down|Left|Right)$/,
  /^(Enter|Escape|Tab|Space|Backspace)$/,
  /^https?:\/\//,
  /^[\s\d.,:;+\-–—×%°/()|·•…→←↑↓✓✗★☆♥]*$/,
  /\.(webp|png|jpg|mp3|svg|css|ts|js)$/,
];
function looksLikeText(raw: string): boolean {
  const s = raw.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\{\d+\}/g, ' ').trim();
  if (!s) return false;
  if (NOT_TEXT.some((r) => r.test(s))) return false;
  if (/[äöüÄÖÜß„“]/.test(s)) return true;
  const words = s.match(/[A-Za-z]{2,}/g) ?? [];
  if (!words.length) return false;
  if (/^[\w-]+(\s+[\w-]+)*$/.test(s) && s === s.toLowerCase()) return false;
  if (/^(var\(|rgba?\(|#[0-9a-f]{3,8}|\d+(px|rem|em|%|ms|s)\b)/i.test(s)) return false;
  return words.some((w) => /^[A-ZÄÖÜ]/.test(w)) || words.length >= 2;
}

const INLINE = new Set(['span', 'b', 'strong', 'em', 'i', 'small', 'a', 'abbr', 'kbd', 'br', 'u', 'mark', 'q', 'sup', 'sub']);
const TEXT_ATTRS = /\b(placeholder|aria-label|alt|title)="([^"]*)"/g;
const TR_FUNCS = new Set(['t', 'tr', 'tk', 'news']);

let total = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const lines = src.split('\n');
  let count = 0;
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
  const ignored = (n: ts.Node) => /i18n-ignore/.test(lines[lineOf(n)] ?? '');

  const skipContext = (node: ts.Node): boolean => {
    const p = node.parent;
    if (!p) return false;
    if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p)) && p.name === node) return true;
    if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return true;
    if (ts.isTaggedTemplateExpression(p)) return true;
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && TR_FUNCS.has(p.expression.text)) return true;
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'startsWith', 'endsWith', 'getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getElementById', 'indexOf', 'split', 'replace'].includes(p.expression.name.text)) return true;
    return false;
  };

  const isInlineExpr = (e: ts.Expression): boolean => {
    const txt = e.getText(sf);
    if (txt.includes('`') || /Html\(|html\(|<[a-z]/.test(txt)) return false;
    return true;
  };

  /** Quelltext eines Knotens mit allen Umbauten darin. */
  const render = (node: ts.Node): string => {
    // Schon übersetzt: unverändert, aber Ausdrücke darin weiter bearbeiten
    if (ts.isTaggedTemplateExpression(node) || (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && TR_FUNCS.has(node.expression.text))) return splice(node);
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !skipContext(node) && !ignored(node) && looksLikeText(node.text)) {
      count++;
      return `t(${node.getText(sf)})`;
    }
    if (ts.isTemplateExpression(node) && !skipContext(node) && !ignored(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      const isHtml = parts.some((p) => /<[a-zA-Z/!]/.test(p));
      if (isHtml) return renderHtml(node);
      if (looksLikeText(parts.join(' {0} '))) { count++; return 't' + splice(node); }
    }
    return splice(node);
  };

  /** Standard: Originaltext, Kinder durch ihre umgebaute Fassung ersetzt. */
  const splice = (node: ts.Node): string => {
    let out = '';
    let pos = node.getStart(sf);
    const end = node.getEnd();
    node.forEachChild((c) => {
      const cs = c.getStart(sf);
      if (cs < pos) return;
      out += src.slice(pos, cs) + render(c);
      pos = c.getEnd();
    });
    return out + src.slice(pos, end);
  };

  type Item = { k: 'lit'; raw: string } | { k: 'expr'; e: ts.Expression };
  const rawOf = (lit: ts.TemplateHead | ts.TemplateMiddle | ts.TemplateTail): string => {
    const t = lit.getText(sf);
    // Kopf: `...${   Mitte: }...${   Ende: }...`
    const start = ts.isTemplateHead(lit) ? 1 : 1;
    const endCut = ts.isTemplateTail(lit) ? 1 : 2;
    return t.slice(start, t.length - endCut);
  };

  /** HTML-Vorlage: Textläufe zwischen Block-Tags einzeln übersetzen. */
  const renderHtml = (node: ts.TemplateExpression): string => {
    const items: Item[] = [{ k: 'lit', raw: rawOf(node.head) }];
    for (const sp of node.templateSpans) { items.push({ k: 'expr', e: sp.expression }, { k: 'lit', raw: rawOf(sp.literal) }); }

    // In Tokens zerlegen: tag (mit Ausdrücken darin), text, expr
    type Tok = { k: 'tag'; parts: (string | ts.Expression)[]; name: string; inline: boolean } | { k: 'text'; s: string } | { k: 'expr'; e: ts.Expression };
    const toks: Tok[] = [];
    let tag: (string | ts.Expression)[] | null = null;
    const pushText = (s: string) => { const last = toks[toks.length - 1]; if (last && last.k === 'text') last.s += s; else toks.push({ k: 'text', s }); };
    for (const it of items) {
      if (it.k === 'expr') { if (tag) tag.push(it.e); else toks.push({ k: 'expr', e: it.e }); continue; }
      let s = it.raw;
      while (s.length) {
        if (tag) {
          const gt = s.indexOf('>');
          if (gt < 0) { tag.push(s); s = ''; break; }
          tag.push(s.slice(0, gt + 1)); s = s.slice(gt + 1);
          const first = typeof tag[0] === 'string' ? tag[0] : '';
          const name = (/^<\/?([a-zA-Z0-9]+)/.exec(first)?.[1] ?? '').toLowerCase();
          toks.push({ k: 'tag', parts: tag, name, inline: INLINE.has(name) });
          tag = null;
          continue;
        }
        const m = /<[a-zA-Z/!]/.exec(s);
        if (!m) { pushText(s); s = ''; break; }
        if (m.index > 0) pushText(s.slice(0, m.index));
        tag = []; s = s.slice(m.index);
      }
    }
    if (tag) toks.push({ k: 'tag', parts: tag, name: '', inline: false });

    const tagSrc = (tk: Extract<Tok, { k: 'tag' }>): string => {
      let out = '';
      for (const p of tk.parts) out += typeof p === 'string' ? p : '${' + render(p) + '}';
      // Attribute mit Text (ohne Ausdrücke darin)
      return out.replace(TEXT_ATTRS, (all, attr, val) => {
        if (val.includes('${') || !looksLikeText(val)) return all;
        count++;
        return `${attr}="\${t\`${val}\`}"`;
      });
    };

    // Läufe bilden: text + inline-Tags + einfache Ausdrücke
    let out = '`';
    let run: Tok[] = [];
    const flush = () => {
      if (!run.length) return;
      const textOnly = run.filter((x) => x.k === 'text').map((x) => (x as { s: string }).s).join(' ');
      const src2 = run.map((x) => (x.k === 'text' ? x.s : x.k === 'expr' ? '${' + render(x.e) + '}' : tagSrc(x))).join('');
      if (looksLikeText(textOnly)) {
        const lead = /^\s*/.exec(src2)![0];
        const trail = /\s*$/.exec(src2.slice(lead.length))![0];
        let core = src2.slice(lead.length, src2.length - trail.length);
        // Inline-Tags am Rand bleiben außerhalb, wenn sie den ganzen Lauf umschließen? Nein: gehören zum Satz.
        core = core.replace(/\s*\n\s*/g, ' ');
        count++;
        out += lead + '${t`' + core + '`}' + trail;
      } else out += src2;
      run = [];
    };
    for (const tk of toks) {
      if (tk.k === 'text' || (tk.k === 'tag' && tk.inline) || (tk.k === 'expr' && isInlineExpr(tk.e))) { run.push(tk); continue; }
      flush();
      out += tk.k === 'tag' ? tagSrc(tk) : '${' + render(tk.e) + '}';
    }
    flush();
    return out + '`';
  };

  const result = render(sf).replace(/^/, '');
  // render(sf) beginnt am ersten Token; führende Kommentare/Leerzeichen wieder anhängen
  const lead = src.slice(0, sf.getStart(sf));
  const next = lead + result + src.slice(sf.getEnd());
  total += count;
  console.log(`${file}: ${count} Stellen`);
  if (!dry && next !== src) {
    let out = next;
    if (count && !/import \{[^}]*\bt\b[^}]*\} from '[^']*i18n'/.test(out)) {
      const inner = file.replace(/^(.*\/)?src\//, '');
      const d = inner.split('/').length - 1;
      const rel = d === 0 ? './i18n' : '../'.repeat(d) + 'i18n';
      // nach dem letzten Import einfügen
      const imports = [...out.matchAll(/^import .*?;\s*$/gms)];
      const at = imports.length ? imports[imports.length - 1].index! + imports[imports.length - 1][0].length : 0;
      out = out.slice(0, at) + `${imports.length ? '\n' : ''}import { t } from '${rel}';\n` + out.slice(at);
    }
    writeFileSync(file, out);
  }
}
console.log(`Gesamt: ${total}`);
