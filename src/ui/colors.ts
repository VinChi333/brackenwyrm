// Farbcodes im Gespräch, wie im Original: ein Akzentzeichen und eine Ziffer.
// `1 Gold · `2 Grün · `3 Blau · `4 Violett · `5 Rot · `6 Bronze · `7 Silber · `8 Rosa · `0 wieder normal.
import { censor, isClean } from '../content/badwords';

const CODE = /`([0-8])/g;

/** Text ohne Farbcodes (für Längen, Filter und überall, wo keine Farben erscheinen). */
export function stripColors(text: string): string {
  return text.replace(CODE, '');
}

/**
 * Macht aus Text mit Farbcodes sicheres HTML. `escape` maskiert den eigentlichen Text.
 * Wer Codes mitten in ein grobes Wort setzt, um den Filter zu umgehen, bekommt den Text ohne Farben und gefiltert.
 */
export function colorize(raw: string, escape: (s: string) => string): string {
  const plain = stripColors(raw);
  if (!isClean(plain)) return escape(censor(plain));
  let out = '';
  let open = false;
  for (const part of raw.split(/(`[0-8])/)) {
    const m = /^`([0-8])$/.exec(part);
    if (!m) { out += escape(part); continue; }
    if (open) out += '</span>';
    open = m[1] !== '0';
    if (open) out += `<span class="c${m[1]}">`;
  }
  if (open) out += '</span>';
  return out;
}

export const COLOR_CODES = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
