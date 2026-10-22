# Server für Spielerkonto und Online-Spielstand

Das Spiel nutzt [Supabase](https://supabase.com) für Anmeldung und Speicherung. Solange nichts eingerichtet ist,
läuft das Spiel rein lokal; das Spielerkonto erscheint dann gar nicht erst.

## Einrichten (einmalig, etwa 15 Minuten)

1. Auf supabase.com ein Konto und ein neues Projekt anlegen (Region Frankfurt, wegen DSGVO).
2. Beim Anlegen: „Enable Data API“ an, „Automatically expose new tables“ aus, „Enable automatic RLS“ an.
   Dann im Projekt unter **SQL Editor** den Inhalt von `supabase.sql` einfügen und ausführen.
3. Unter **Authentication → Sign In / Providers**: **Email** aktiv, **Confirm email** aus, neue Anmeldungen erlaubt.
   Angemeldet wird vorerst mit E-Mail und Passwort, dafür muss keine Mail verschickt werden.
4. Später, mit eigener Domain: eigenen E-Mail-Versand (SMTP) einrichten, dann sind Passwort-Zurücksetzen und
   Anmeldecodes per E-Mail möglich (Vorlage „Magic Link“ mit `{{ .Token }}`; im Spiel `requestCode`/`verifyCode`).
5. Unter **Project Settings → API** die **Project URL** und den **anon public key** kopieren und im Projektordner
   eine Datei `.env` anlegen:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

6. `npm run build` – ab jetzt zeigt das Spiel in den Einstellungen „Spielerkonto“.

Der anon key ist für den Einsatz im Spiel gedacht und darf öffentlich sein; geschützt wird über die Regeln in
`supabase.sql` (jeder sieht nur seinen eigenen Spielstand).

## Teil 2: Spieler gegen Spieler und Dorfplatz

Danach `supabase-2-dorf.sql` ebenfalls im SQL Editor ausführen (kann gefahrlos wiederholt werden). Ohne diesen Teil
funktioniert das Spiel weiter, nur Felder, Dorfplatz und Tagesneuigkeiten bleiben leer.

## Teil 3: Kriegerliste und Briefe

Im SQL Editor den Inhalt von `supabase-3-briefe.sql` einfügen und auf **Run** klicken. Voraussetzung: Teil 1 und Teil 2
(in der Fassung ab Testversion 0.21) sind schon ausgeführt. Die Datei lässt sich gefahrlos erneut ausführen.

Zum Testen ohne Supabase: `node scripts/fake-supabase.mjs` startet einen Nachbau mit echtem Postgres auf Port 54321.

## Wie der Abgleich funktioniert

- Jeder Spielstand trägt den Zeitpunkt, an dem er gespeichert wurde.
- Hat nur ein Gerät weitergespielt, gewinnt dieses automatisch.
- Haben beide Geräte seit dem letzten Abgleich weitergespielt, fragt das Spiel, welcher Stand bleiben soll.
- Ohne Internet wird lokal weitergespielt und beim nächsten Mal abgeglichen.

## Noch offen vor dem Verkauf

- Ruhmeshalle gegen Schummeln absichern: Drachenkills auf dem Server aus dem Spielstand berechnen statt sie vom Spiel
  zu übernehmen.
- Datenschutzerklärung (E-Mail-Adresse wird gespeichert) und Möglichkeit, das Konto zu löschen.
- Briefe und Dorfplatz: Melden und Blockieren von Spielern, Wortfilter.
