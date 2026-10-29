// Texte, die vom Server kommen (Fehlermeldungen, Neuigkeiten, Morwens Brief). Der Server schreibt deutsch;
// für Leser in einer anderen Sprache werden sie hier anhand dieser Muster übersetzt.
// Neue Server-Texte gehören hier dazu, sonst bleiben sie deutsch (der Prüfer verlangt eine Übersetzung jedes Musters).
import { lang, t } from './index';

export const SERVER_TEXTS = [
  // Fehlermeldungen
  '{0} hat heute schon drei Überweisungen bekommen. Morgen wieder.',
  '{0} ist außerhalb deiner Reichweite.',
  '{0} ist hellwach.',
  '{0} ist schon bei Morwen.',
  '{0} ist selbst bei Morwen.',
  '{0} schläft woanders.',
  '{0} steht noch unter dem Schutz der Neulinge.',
  '{0} wurde gerade erst angegriffen.',
  '{0} wurde heute schon heimgesucht. Such dir jemand anderen.',
  'Am Wyrmstein reden nur Drachentöter.',
  'An {0} darfst du höchstens {1} Gold auf einmal überweisen (25 je Stufe).',
  'An dich selbst? Ansgar runzelt die Stirn.',
  'Das gibt es nicht mehr.',
  'Das kann man nicht melden.',
  'Das kostet {0} Gold (mit Veits Anteil). So viel hast du nicht dabei.',
  'Dein Konto ist gesperrt.',
  'Dich selbst kannst du nicht melden.',
  'Diesen Helden findest du nicht.',
  'Diesen Helden gibt es nicht.',
  'Diesen Helden kennt Veit nicht.',
  'Diesen Helden kennt das Kontor nicht.',
  'Dieser Held ist nicht hier.',
  'Du hast heute schon 3 Spielerkämpfe gehabt.',
  'Ein Wurf kostet {0} Gold.',
  'Erst einmal spielen, dann reden.',
  'Erst einmal spielen, dann schreiben.',
  'Erst einmal spielen.',
  'Für {0} nimmt Veit zwischen {1} und {2} Gold.',
  'Für heute hast du genug Briefe geschrieben.',
  'Für heute hast du genug gemeldet.',
  'Heute darfst du nur noch {0} Gold überweisen (25 je eigener Stufe am Tag).',
  'Kein Spielerkonto gefunden.',
  'Morwen hat für heute genug von deinem Gespuke.',
  'Nicht angemeldet.',
  'Nicht so schnell. Der Bote ist noch unterwegs.',
  'Nicht so schnell. Warte einen Moment.',
  'Nur Tote können spuken.',
  'Nur für die Wache.',
  'Bitte schreib ein paar Worte dazu.',
  'Du hast gerade schon viele Rückmeldungen geschickt. Danke! Probier es später wieder.',
  'Gerade kommen sehr viele Rückmeldungen an. Probier es später wieder.',
  'Tote greifen niemanden an.',
  'Unbekannte Entscheidung.',
  'Veit kennt dich nicht.',
  'Veit lacht dreckig. „Auf dich selbst? Nein.“',
  'Veit schüttelt den Kopf. „Fünf am Tag. Mehr Feinde kann keiner haben.“',
  'Veit winkt ab. „Der ist noch grün hinter den Ohren. Ab Stufe 3.“',
  'Wie viel denn?',
  'Zu viele Neuigkeiten heute.',
  'Überweisen kannst du ab Stufe 3.',
  '„Für heute hast du genug gewürfelt. Komm morgen wieder.“',
  // Neuigkeiten vom Server
  '{0} hat sich in Friedas Gasthaus geschlichen und {1} im Schlaf besiegt.',
  '{0} hat {1} auf den Feldern im Schlaf überrascht und besiegt.',
  '{0} wollte {1} im Schlaf überfallen und ist dabei selbst gefallen.',
  'Der Geist von {0} hat {1} heimgesucht!',
  'Der Geist von {0} wollte {1} heimsuchen, aber es hat nicht geklappt.',
  'Veit Galgenstrick nimmt einen neuen Auftrag an: Kopfgeld auf {0}.',
  '{0} hat das Kopfgeld von {1} Gold auf {2} kassiert!',
  '{0} hat fünf Sechser gewürfelt und den Jackpot von {1} Gold geknackt!',
  '{0} hat vier Sechser gewürfelt und {1} Gold gewonnen.',
  // Morwens Brief nach dem Spuken
  'Du wurdest heimgesucht',
  'Heute Nacht hat dich der Geist von {0} heimgesucht. Du wirst morgen früh müde aufwachen.',
  // Gilden (Teil 7)
  'Eine Gilde gründen kann man erst ab Stufe 5.',
  'Du bist schon in einer Gilde.',
  'Der Gildenname braucht 3 bis 30 Zeichen.',
  'Das Kürzel braucht 2 bis 4 Buchstaben oder Ziffern.',
  'Dieser Name geht leider nicht.',
  'Diesen Gildennamen gibt es schon.',
  'Dieses Kürzel ist schon vergeben.',
  'Eine Gilde zu gründen kostet {0} Gold. So viel hast du nicht dabei.',
  'Diese Gilde gibt es nicht mehr.',
  'Das darf nur die Gildenführung.',
  'Diese Bewerbung gibt es nicht mehr.',
  'Das geht nicht.',
  'Das darf nur der Gildenmeister.',
  'Diesen Rang gibt es nicht.',
  'Du gehörst zu keiner Gilde.',
  '{0} hat die Gilde „{1}“ [{2}] gegründet.',
  'Gildenbote',
  'Neue Bewerbung',
  '{0} möchte in die Gilde „{1}“ aufgenommen werden. Entscheide in der Gildenhalle.',
  'Willkommen in der Gilde',
  'Du bist jetzt Mitglied der Gilde „{0}“ [{1}]. Die Gildenhalle steht dir offen.',
  'Bewerbung abgelehnt',
  'Die Gilde „{0}“ hat deine Bewerbung leider abgelehnt.',
  'Aus der Gilde entlassen',
  'Du gehörst nicht mehr zur Gilde „{0}“.',
  // Vollversion (Teil 8)
  'Zu viele Versuche. Probier es in einer Stunde wieder.',
  'Dieser Code ist ungültig oder wurde schon eingelöst.',
  'Zwischen 1 und 100 Codes auf einmal.',
] as const;

let extra: readonly string[] = [];
/** Weitere Muster (z. B. alte Klartext-Neuigkeiten), die ebenfalls erkannt werden sollen. */
export function addServerPatterns(list: readonly string[]): void { extra = [...extra, ...list]; }

const cache = new Map<string, RegExp>();
function rx(tpl: string): RegExp {
  let r = cache.get(tpl);
  if (!r) {
    const src = tpl.split(/\{\d+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
    r = new RegExp(`^${src}$`, 's');
    cache.set(tpl, r);
  }
  return r;
}

/** Deutschen Server-Text in die Sprache des Lesers bringen. Unbekanntes bleibt, wie es ist. */
export function serverText(msg: string): string {
  if (lang === 'de' || !msg) return msg;
  for (const tpl of [...SERVER_TEXTS, ...extra]) {
    const m = rx(tpl).exec(msg);
    if (m) return t(tpl, ...m.slice(1));
  }
  return msg;
}
