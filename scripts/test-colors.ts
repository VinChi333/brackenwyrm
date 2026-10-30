// Tests für Farbcodes im Gespräch. Aufruf: npm test
import assert from 'node:assert/strict';
import { colorize, stripColors } from '../src/ui/colors';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ', name); };

t('ohne Codes bleibt alles wie es ist', () => assert.equal(colorize('Hallo Moosgrund!', esc), 'Hallo Moosgrund!'));
t('Farbe bis zum Ende', () => assert.equal(colorize('`2Grüner Gruß', esc), '<span class="c2">Grüner Gruß</span>'));
t('Farbwechsel und zurück auf normal', () => assert.equal(colorize('a`1b`3c`0d', esc), 'a<span class="c1">b</span><span class="c3">c</span>d'));
t('HTML im Text bleibt harmlos', () => assert.equal(colorize('`5<script>', esc), '<span class="c5">&lt;script&gt;</span>'));
t('unbekannte Codes bleiben stehen', () => assert.equal(colorize('`9 und `x', esc), '`9 und `x'));
t('Codes zum Umgehen des Filters helfen nicht', () => {
  const out = colorize('du a`2rsch`3loch', esc);
  assert.ok(!out.includes('<span') && out.includes('***'), out);
});
t('ohne Codes für Länge und Filter', () => assert.equal(stripColors('`4Hi`0!'), 'Hi!'));
console.log(`\n${n} Prüfungen bestanden`);
