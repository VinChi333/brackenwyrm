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

## Teil 4 bis 6

Danach in dieser Reihenfolge `supabase-4-schutz.sql`, `supabase-5-dorfleben.sql` und `supabase-6-spieltage.sql` ausführen.
Teil 6 (ab Testversion 0.44) stellt auf zwei Spieltage pro echtem Tag um (6 und 18 Uhr Wiener Zeit) und bringt die
eigenen Titel. **Wer Teil 2 bis 5 erneut ausführt, führt danach immer auch Teil 6 erneut aus.**
Ob alles da ist, zeigt `supabase-pruefung.sql` (jede Zeile muss `true` sein).

## Teil 7: Gilden (ab 0.46)

`supabase-7-gilden.sql` nach Teil 6 ausführen. Bringt Gilden mit Gildenhalle, Rängen und eigenem Gespräch.
Teil 7 ersetzt die Gesprächsregel aus Teil 4: Wer Teil 4 erneut ausführt, führt danach Teil 6 und Teil 7 erneut aus.

## E-Mails: Passwort vergessen (ab 0.44)

„Passwort vergessen?“ schickt einen Code per E-Mail. Der eingebaute Mailversand von Supabase schickt nur an
Mitglieder des eigenen Supabase-Teams (höchstens 2 Mails pro Stunde), für Spieler braucht es einen eigenen Versand:

1. Eine eigene Domain (z. B. bei einem österreichischen Anbieter) und ein kostenloses Konto bei Brevo.
2. In Brevo unter **Senders, Domains & Dedicated IPs** die Domain hinzufügen und die angezeigten DNS-Einträge
   (SPF, DKIM) beim Domain-Anbieter eintragen. Einen Absender anlegen, z. B. `no-reply@deine-domain.at`.
3. In Brevo unter **Settings → SMTP & API → SMTP** einen SMTP-Schlüssel erzeugen (kein API-Schlüssel).
4. In Supabase unter **Authentication → Emails → SMTP Settings** „Enable custom SMTP“ einschalten:
   Host `smtp-relay.brevo.com`, Port `587`, Benutzername = Brevo-Anmelde-E-Mail, Passwort = SMTP-Schlüssel,
   Absender = der Brevo-Absender von oben, Absendername `Brackenwyrm`.
5. In Supabase unter **Authentication → Emails → Templates → Magic Link** den Text so ändern, dass der Code
   drinsteht, zum Beispiel:

   ```
   <h2>Dein Code für Brackenwyrm</h2>
   <p>Gib diesen Code im Spiel ein, um ein neues Passwort festzulegen:</p>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>Der Code gilt eine Stunde. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>
   ```

   Betreff zum Beispiel: `Dein Code für Brackenwyrm`.
6. Testen: Im Spiel unter Einstellungen „Passwort vergessen?“ mit der eigenen Adresse ausprobieren.

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
