// Sprachen. Der deutsche Text ist zugleich der Schlüssel: t`Du hast ${n} Gold.` sucht "Du hast {0} Gold."
// in der englischen Liste. Fehlt eine Übersetzung, bleibt der deutsche Text stehen (der Prüfer meldet das).
// Die Sprache wird beim Laden festgelegt; ein Wechsel lädt die Seite neu.
import { EN } from './en';

export type Lang = 'de' | 'en';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'de', name: 'Deutsch' }, { id: 'en', name: 'English' }];
const STORE = 'brackenwyrm.lang';

function detect(): Lang {
  const env = typeof process !== 'undefined' ? process.env?.BW_LANG : undefined;
  if (env === 'de' || env === 'en') return env;
  if (typeof window === 'undefined') return 'de';
  try {
    const v = localStorage.getItem(STORE);
    if (v === 'de' || v === 'en') return v;
  } catch { /* privates Fenster */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de';
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export let lang: Lang = detect();

/** Nur für Tests und Werkzeuge: Sprache ohne Neuladen umstellen. */
export function useLang(l: Lang): void { lang = l; }

/** Sprache merken und die Seite neu laden. */
export function switchLang(l: Lang): void {
  try { localStorage.setItem(STORE, l); } catch { /* egal */ }
  location.reload();
}

/** Fehlende Übersetzungen, die zur Laufzeit aufgefallen sind (für Tests). */
export const missing = new Set<string>();

function fill(tpl: string, vals: unknown[]): string {
  return vals.length ? tpl.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < vals.length ? String(vals[Number(i)]) : m)) : tpl;
}

/** Schlüssel aus einem Template: Text mit {0}, {1} … an den Stellen der Werte. */
export function keyOf(strings: TemplateStringsArray | readonly string[]): string {
  let k = strings[0];
  for (let i = 1; i < strings.length; i++) k += `{${i - 1}}` + strings[i];
  return k;
}

export function tr(key: string, vals: unknown[] = []): string {
  if (lang === 'de') return fill(key, vals);
  const en = EN[key];
  if (en === undefined) { missing.add(key); return fill(key, vals); }
  return fill(en, vals);
}

/**
 * Übersetzen. Als Tag: t`Du hast ${n} Gold.` – oder als Funktion: t('Moosgrund'), t('Du hast {0} Gold.', n).
 */
export function t(strings: TemplateStringsArray | string, ...vals: unknown[]): string {
  if (typeof strings === 'string') return tr(strings, vals);
  return tr(keyOf(strings), vals);
}

/** Markiert einen deutschen Schlüssel, ohne ihn schon zu übersetzen (z. B. für Listen, die später mit tr() übersetzt werden). */
export function tkey(key: string): string { return key; }

/** Text, der erst beim Lesen übersetzt wird (z. B. in Neuigkeiten für Spieler mit anderer Sprache). */
export function tk(key: string): string { return '~' + key; }
