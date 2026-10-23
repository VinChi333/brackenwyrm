// Wortfilter wie im Original (dort hieß er "badword"): grobe Beleidigungen und Hetze werden zu ***.
// Dieselbe Liste steht in server/supabase-4-schutz.sql (Tabelle bad_words), der Server filtert verbindlich.
// Das Spiel filtert zusätzlich selbst, damit man sofort sieht, was andere sehen werden, und damit Namen gar nicht erst durchgehen.
//
// Schreibweise: nur Kleinbuchstaben und Leerzeichen. "=" vorne heißt: nur als ganzes Wort (sonst auch mitten im Wort).
// Leetspeak (f1ck, @rsch), verdoppelte Buchstaben (fiiick) und Trennzeichen (f.i.c.k) werden mit erkannt.
// Milde Flüche (Mist, verdammt, Scheiße) bleiben erlaubt, so wie man im Gasthaus eben redet.

export const BAD_WORDS: readonly string[] = [
  // Deutsch
  'arschloch', 'fotze', 'wichser', 'wixer', 'wixxer', 'hurensohn', '=huso', '=hure', '=huren', 'nutte', 'schlampe',
  'fick', 'missgeburt', 'spast', '=mongo', '=mongos', 'schwuchtel', 'kanake', 'kanacke', 'neger', 'judensau',
  'hitler', 'sieg heil', 'bring dich um', 'kinderschaender', 'kinderschänder', '=pedo', '=paedo', '=pädo',
  // Englisch
  'fuck', '=cunt', '=cunts', 'nigger', 'nigga', 'faggot', '=fag', '=fags', 'whore', 'slut', '=retard', '=retards', '=retarded',
  'bitch', '=pussy', 'asshole', 'kill yourself', 'kill urself', '=kys', 'motherf',
];

const CLASSES: Record<string, string> = {
  a: '[a4@]', e: '[e3]', i: '[i1!|]', o: '[o0]', s: '[s5$]', t: '[t7]', c: '[ck]', k: '[kc]', u: '[uv]',
};

/** Ein Wort aus der Liste als regulärer Ausdruck. Muss zu bw_pattern() in der Datenbank passen. */
export function badWordPattern(word: string): string {
  const whole = word.startsWith('=');
  const body = (whole ? word.slice(1) : word).toLowerCase();
  let out = '';
  let prevLetter = false;
  for (const ch of body) {
    if (ch === ' ') { out += '\\s+'; prevLetter = false; continue; }
    if (prevLetter) out += '[._*-]?';
    out += (CLASSES[ch] ?? ch) + '+';
    prevLetter = true;
  }
  return whole ? `(?<![\\p{L}\\p{N}])${out}(?![\\p{L}\\p{N}])` : out;
}

const FILTER = new RegExp(BAD_WORDS.map(badWordPattern).join('|'), 'giu');

/** Ersetzt grobe Wörter durch ***. */
export function censor(text: string): string {
  return text.replace(FILTER, '***');
}

/** Enthält der Text etwas, das gefiltert würde? */
export function isClean(text: string): boolean {
  FILTER.lastIndex = 0;
  const hit = FILTER.test(text);
  FILTER.lastIndex = 0;
  return !hit;
}
