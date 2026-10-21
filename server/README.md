# Server für Spielerkonto und Online-Spielstand

Das Spiel nutzt [Supabase](https://supabase.com) für Anmeldung und Speicherung. Solange nichts eingerichtet ist,
läuft das Spiel rein lokal; das Spielerkonto erscheint dann gar nicht erst.

## Einrichten (einmalig, etwa 15 Minuten)

1. Auf supabase.com ein Konto und ein neues Projekt anlegen (Region Frankfurt, wegen DSGVO).
2. Beim Anlegen: „Enable Data API“ an, „Automatically expose new tables“ aus, „Enable automatic RLS“ an.
   Dann im Projekt unter **SQL Editor** den Inhalt von `supabase.sql` einfügen und ausführen.
3. Unter **Authentication → Providers** muss **Email** aktiv sein.
4. Unter **Authentication → Email Templates → Magic Link** den Text so ändern, dass der Code drinsteht, z. B.:
   `Dein Anmeldecode für Brackenwyrm: {{ .Token }}` (sonst schickt Supabase nur einen Link statt eines Codes).
5. Unter **Project Settings → API** die **Project URL** und den **anon public key** kopieren und im Projektordner
   eine Datei `.env` anlegen:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

6. `npm run build` – ab jetzt zeigt das Spiel in den Einstellungen „Spielerkonto“.

Der anon key ist für den Einsatz im Spiel gedacht und darf öffentlich sein; geschützt wird über die Regeln in
`supabase.sql` (jeder sieht nur seinen eigenen Spielstand).

## Wie der Abgleich funktioniert

- Jeder Spielstand trägt den Zeitpunkt, an dem er gespeichert wurde.
- Hat nur ein Gerät weitergespielt, gewinnt dieses automatisch.
- Haben beide Geräte seit dem letzten Abgleich weitergespielt, fragt das Spiel, welcher Stand bleiben soll.
- Ohne Internet wird lokal weitergespielt und beim nächsten Mal abgeglichen.

## Noch offen vor dem Verkauf

- Ruhmeshalle gegen Schummeln absichern: Drachenkills auf dem Server aus dem Spielstand berechnen statt sie vom Spiel
  zu übernehmen.
- Datenschutzerklärung (E-Mail-Adresse wird gespeichert) und Möglichkeit, das Konto zu löschen.
