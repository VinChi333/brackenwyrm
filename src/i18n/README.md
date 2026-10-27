# Sprachen in Brackenwyrm

Der deutsche Text steht direkt im Code und ist zugleich der Schlüssel für die Übersetzung.

```ts
t('Moosgrund')                         // einfacher Text
t`Du hast ${p.gold} Gold.`             // mit Werten → Schlüssel "Du hast {0} Gold."
```

- `src/i18n/en.ts` – englische Texte (deutscher Text → englischer Text). Platzhalter `{0}`, `{1}` … müssen übereinstimmen.
- `src/i18n/news.ts` – Neuigkeiten für alle Spieler werden als Code gespeichert und beim Lesen in der Sprache des Lesers ausgeschrieben.
- `src/i18n/server.ts` – Texte, die vom Server kommen (Fehlermeldungen, Server-Neuigkeiten). Neue Server-Texte hier eintragen.

## Neue Texte übersetzen

```sh
npx tsx scripts/i18n-check.ts                 # Überblick: fehlt etwas? deutscher Text ohne t()?
npx tsx scripts/i18n-check.ts --list          # alle Fundstellen
npx tsx scripts/i18n-check.ts --export /tmp/tr   # fehlende Texte als Arbeitslisten (Nr<TAB>Text)
#   → zu jeder *.de.tsv eine *.en.tsv mit "Nr<TAB>English" schreiben
npx tsx scripts/i18n-import.ts /tmp/tr        # in en.ts übernehmen
```

Listen, die erst später übersetzt werden, markieren ihre deutschen Texte mit `tkey('…')` (der Prüfer findet sie) und übersetzen sie mit `tr()`.

Kein Spieltext ohne `t()`. Technische Zeichenketten (Pfade, Aktionen, CSS) bleiben ohne; im Zweifel `// i18n-ignore` ans Zeilenende.

Die Sprache wird beim Start festgelegt (gespeichert oder Gerätesprache) und beim Wechsel in den Einstellungen wird neu geladen.
Tastenkürzel passen zur deutschen Beschriftung; in anderen Sprachen sucht sich jeder Menüpunkt automatisch einen freien Buchstaben aus seinem Wort.
