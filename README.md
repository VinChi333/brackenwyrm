# Brackenwyrm

Ein textbasiertes Fantasy-Rollenspiel mit Tagesrhythmus und Drachen-Neustart, inspiriert von den
Browserspielen der frühen 2000er. Eigene Welt, eigene Texte, eigener Code.

Das Dorf Moosgrund liegt am Rand des Brackenwalds. Jeden Tag gibt es eine feste Zahl an Waldkämpfen.
Wer genug Erfahrung sammelt, fordert den Meister seiner Stufe heraus. Ab Stufe 15 wartet in der
Farnschlucht der Brackenwyrm. Wer ihn besiegt, beginnt wieder bei Stufe 1 und behält einen Bonus.

## Stand: Prototyp 0.5

- 18 Illustrationen: alle Gegner der Stufen 1 bis 5, dazu Rudelführer, Rindenspinne und Steintroll (Originale in `art-source/`)
- 20 Waldereignisse, 7 davon mit Entscheidung (Moosfee, alte Truhe, Wunschbrunnen, leuchtender Pilz, Schrein, schlafender Söldner, verletzter Wanderer)
- Ruhmeshalle: Rangliste der Drachentöter von Moosgrund mit Titeln und eigenen Rekorden
- Gasthaus: Frieda gibt bis zu 3 Tipps am Tag, passend zum Spielstand; am Stammtisch reden die Gäste über dich

- Aufbau wie die Browserspiele von damals, modern gestaltet: Navigation links mit hervorgehobenen Tastenkürzeln, Geschehen in der Mitte, Charakterwerte rechts; am Handy untereinander
- Gegner als illustrierte Karten (Gewöhnlich, Selten, Episch, Legendär) mit Treffer-Effekten; bis die Illustrationen da sind, zeigen sie eine Schattenkarte
- Bestiarium: jede besiegte Kreatur wird als Karte gesammelt
- Charaktererstellung mit drei Fähigkeiten (Klingenkunst, Wurzelmagie, Schleichpfad)
- Dorf: Wald, Trainingsplatz mit 14 Meistern, Heilerin, Schmiede (16 Waffen, 16 Rüstungen), Gasthaus, Kontor
- 45 Waldgegner auf 15 Stufen, 9 Waldereignisse, Endkampf gegen den Brackenwyrm
- Tod und Schattenreich, neuer Tag um Mitternacht (plus Testknopf)
- Spielstand im Browser, mitnehmbar per Code auf ein anderes Gerät

## Illustrationen eintragen

1. Original (z. B. aus Leonardo, Hochformat) nach `art-source/<monster-id>.png` legen.
2. Auf 3:4 zuschneiden, auf 540 × 720 verkleinern und als `src/assets/monsters/<monster-id>.webp` speichern (Qualität 80).
3. Fertig: Jede Datei in diesem Ordner wird automatisch übernommen. Ohne Datei zeigt die Karte die Schattenkarte.

Auch `dragon.webp`, `master-<stufe>.webp` und `hero.webp` werden erkannt.

## Befehle

```bash
npm install
npm run dev             # Entwicklungsserver
npm run build           # baut dist/index.html (eine einzige Datei, läuft offline)
npm run build:artifact  # zusätzlich dist/brackenwyrm.html für die Vorschauseite auf claude.ai
npm run simulate        # Balancing: ein Bot spielt viele Durchgänge bis zum Drachenkill
```

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/game/` | Spielregeln ohne Darstellung: Kampf, Tage, Aufstieg, Speichern. Alle Formeln in `balance.ts`. |
| `src/content/` | Inhalte als Daten: Gegner, Meister, Ausrüstung, Ereignisse, Fähigkeiten. |
| `src/ui/` | Bildschirme und Stil; `art/cards.ts` baut die Monsterkarten, `art/silhouettes.ts` die Schattenbilder. |
| `scripts/` | Balancing-Simulation und Build-Hilfen. |

Texte und Gegner lassen sich in `src/content/` ändern, ohne die Spiellogik anzufassen.

## Balancing (Simulation, 150 Durchgänge)

- Kampfrunden im Wald: etwa 3 bis 4
- Lebenspunkte-Verlust pro Waldkampf: 12 % auf Stufe 1 bis 24 % auf Stufe 14
- Sieg gegen den Meister: etwa 75 %
- Sieg gegen den Brackenwyrm mit guter Ausrüstung: etwa 60 %
- Erster Drachenkill: nach etwa 30 Spieltagen

## Nächste Schritte

1. Spielerkonto und Server-Speicherstand, damit Handy und PC denselben Stand teilen
2. Reittiere, Dorfplatz mit Nachrichten anderer Spieler, Illustrationen für Meister und Drachen
3. Hüllen für Steam (Tauri) und App Stores (Capacitor)
