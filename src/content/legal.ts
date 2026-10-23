// Impressum und Datenschutzerklärung. Im Spiel als eigene Seiten und für Netlify als datenschutz.html / impressum.html
// (scripts/legal-pages.ts). Hinweis: keine Rechtsberatung. Vor dem Verkauf von jemandem mit Rechtskenntnis prüfen lassen.
//
// BITTE AUSFÜLLEN: Angaben in eckigen Klammern. Solange etwas in [ ] steht, zeigt das Spiel einen Hinweis.

export const OPERATOR = {
  name: 'Christopher [Nachname]',
  street: '[Straße und Hausnummer]',
  city: '[PLZ] [Ort]',
  country: 'Österreich',
  email: '[E-Mail-Adresse für Anfragen]',
  /** Region des Supabase-Projekts (steht im Supabase-Dashboard unter Project Settings → General). */
  dbRegion: '[Region, z. B. EU Central (Frankfurt)]',
};

export const LEGAL_UPDATED = 'Oktober 2026';

export function legalIncomplete(): boolean {
  return Object.values(OPERATOR).some((v) => /\[[^\]]+\]/.test(v));
}

const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const address = () => `${e(OPERATOR.name)}<br>${e(OPERATOR.street)}<br>${e(OPERATOR.city)}<br>${e(OPERATOR.country)}<br>E-Mail: ${e(OPERATOR.email)}`;

export function impressumHtml(): string {
  return `
<h2>Medieninhaber und Herausgeber</h2>
<p>${address()}</p>
<p>Angaben nach § 5 E-Commerce-Gesetz und Offenlegung nach § 25 Mediengesetz.</p>
<h2>Unternehmensgegenstand</h2>
<p>Entwicklung und Vertrieb des Computerspiels Brackenwyrm.</p>
<h2>Grundlegende Richtung</h2>
<p>Ein Fantasy-Rollenspiel mit Spielerkommunikation (Gespräche, Briefe, Steckbriefe). Für Beiträge der Spielerinnen und Spieler sind diese selbst verantwortlich. Unangemessene Beiträge können im Spiel gemeldet werden und werden entfernt.</p>
<h2>Mitwirkende und Lizenzen</h2>
<p>Bilder erstellt mit Leonardo, Musik erstellt mit Suno (kommerzielle Nutzung im Rahmen des bezahlten Abos). Ein Teil der Klangeffekte stammt von Kenney (kenney.nl, CC0). Schriften: Cinzel und Alegreya Sans (SIL Open Font License).</p>
<h2>Haftung für Links</h2>
<p>Für Inhalte externer Seiten, auf die das Spiel verweist, sind deren Betreiber verantwortlich.</p>`;
}

export function datenschutzHtml(): string {
  return `
<p class="muted">Stand: ${LEGAL_UPDATED}</p>
<h2>Kurz gesagt</h2>
<ul class="plain">
  <li>Keine Werbung, keine Werbe-Cookies, keine Analyse- oder Tracking-Dienste.</li>
  <li>Ohne Spielerkonto bleibt dein Spielstand nur auf deinem Gerät.</li>
  <li>Mit Spielerkonto speichern wir nur, was das Spiel braucht: E-Mail-Adresse, Spielstand und was du im Spiel öffentlich machst.</li>
  <li>Du kannst dein Konto jederzeit selbst löschen (Einstellungen → Konto löschen).</li>
</ul>

<h2>1. Verantwortlich</h2>
<p>${address()}</p>

<h2>2. Spielen ohne Spielerkonto</h2>
<p>Dein Spielstand, deine Einstellungen (zum Beispiel Lautstärke) und dein Fortschritt werden nur im Speicher deines Browsers bzw. Geräts abgelegt („Local Storage“). Diese Daten verlassen dein Gerät nicht. Du kannst sie jederzeit im Spiel unter Einstellungen löschen oder als Code exportieren.</p>
<p>Beim Aufruf der Webseite verarbeitet unser Hosting-Anbieter technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, aufgerufene Datei, Browser), um die Seite auszuliefern und vor Angriffen zu schützen. Liest du die Tagesneuigkeiten oder die Ruhmeshalle, ruft das Spiel diese bei unserer Datenbank ab; dabei fällt ebenfalls deine IP-Adresse an. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>

<h2>3. Spielen mit Spielerkonto</h2>
<p>Damit du auf mehreren Geräten mit demselben Helden spielen und mit anderen spielen kannst, verarbeiten wir:</p>
<ul class="plain">
  <li><strong>Konto:</strong> E-Mail-Adresse und Passwort (das Passwort wird nur verschlüsselt als Prüfwert gespeichert, niemand kann es lesen). Im Browser bleibt ein Anmeldeschlüssel gespeichert, bis du dich abmeldest.</li>
  <li><strong>Spielstand:</strong> dein kompletter Spielstand, damit er auf allen Geräten gleich ist.</li>
  <li><strong>Öffentliche Heldendaten</strong>, die andere Spieler sehen: Heldenname, Titel, Geschlecht des Helden, Stufe, Rasse, Fähigkeit, Drachenkills, Spieltage, Reittier, Ehe im Spiel, Steckbrief, ob du gerade spielst oder schläfst.</li>
  <li><strong>Was du im Spiel schreibst:</strong> Gespräche (für alle sichtbar), Briefe (nur für den Empfänger), Tagesneuigkeiten über deinen Helden.</li>
  <li><strong>Spieler gegen Spieler:</strong> Kampfwerte, Gold und Erfahrung für Überfälle und Spuken, sowie die Nachrichten darüber.</li>
  <li><strong>Schutz und Sicherheit:</strong> Meldungen, die du abgibst oder die über dich abgegeben werden (mit dem gemeldeten Text), deine Blockierliste, und ein Protokoll, wenn der Server unplausible Spielwerte korrigiert.</li>
</ul>
<p>Rechtsgrundlage ist die Bereitstellung des Spiels, das du nutzen möchtest (Art. 6 Abs. 1 lit. b DSGVO). Melden, Blockieren, der Wortfilter und der Schummelschutz dienen dem fairen und sicheren Spiel für alle (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO).</p>

<h2>4. Automatische Prüfungen</h2>
<p>Der Server prüft Spielwerte automatisch auf Plausibilität (zum Beispiel höchstens ein Drachenkill in vier Tagen) und begrenzt unmögliche Werte. Grobe Beleidigungen werden automatisch durch *** ersetzt. Wird ein Beitrag von drei verschiedenen Spielern gemeldet, wird er ausgeblendet, bis ihn ein Mensch geprüft hat. Über Sperren entscheidet immer ein Mensch.</p>

<h2>5. Wer die Daten verarbeitet</h2>
<ul class="plain">
  <li><strong>Supabase Inc.</strong> (USA) betreibt für uns die Datenbank und die Anmeldung. Server-Standort: ${e(OPERATOR.dbRegion)}. Mit Supabase besteht ein Auftragsverarbeitungsvertrag.</li>
  <li><strong>Netlify Inc.</strong> (USA) liefert die Webseite des Spiels aus.</li>
</ul>
<p>Bei Anbietern mit Sitz in den USA kann es zu Übermittlungen in die USA kommen. Diese stützen sich auf das EU-US Data Privacy Framework bzw. auf Standardvertragsklauseln der EU-Kommission. Wir verkaufen keine Daten und geben sie nicht zu Werbezwecken weiter.</p>

<h2>6. Rückmeldungen</h2>
<p>Wenn du über „Rückmeldung geben“ etwas schickst, wählst du selbst, ob per WhatsApp, E-Mail oder auf anderem Weg. Die Nachricht enthält eine kurze Zusammenfassung deines Spielstands. Wir nutzen sie nur, um das Spiel zu verbessern, und löschen sie, wenn sie erledigt ist. Für den Versand gelten die Datenschutzbestimmungen des Dienstes, den du dafür wählst.</p>

<h2>7. Wie lange wir speichern</h2>
<ul class="plain">
  <li>Konto, Spielstand und öffentliche Heldendaten: bis du dein Konto löschst.</li>
  <li>Briefe: höchstens 100 pro Postfach, ältere verschwinden automatisch. Gelöschte Briefe sind sofort weg.</li>
  <li>Meldungen und das Protokoll des Schummelschutzes: höchstens 180 Tage.</li>
  <li>Verbindungsdaten bei Hosting und Datenbank: nur so lange, wie die Anbieter sie für Betrieb und Sicherheit brauchen (in der Regel wenige Tage).</li>
</ul>
<p>Löschst du dein Konto, werden Konto, Spielstand, Heldendaten, Gespräche, Briefe an dich, deine Tagesneuigkeiten und deine Blockierliste sofort gelöscht. Briefe, die du anderen geschickt hast, bleiben bei ihnen, aber ohne deinen Namen. Meldungen über dich bleiben bis zu 180 Tage, ohne Verbindung zu deinem Konto.</p>

<h2>8. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Vieles kannst du direkt im Spiel erledigen: Konto löschen und Spielstand als Code exportieren (Einstellungen). Für alles andere schreib uns an ${e(OPERATOR.email)}.</p>
<p>Wenn du meinst, dass wir mit deinen Daten nicht richtig umgehen, kannst du dich bei der Österreichischen Datenschutzbehörde beschweren: Barichgasse 40–42, 1030 Wien, dsb.gv.at.</p>

<h2>9. Kinder und Jugendliche</h2>
<p>Ein Spielerkonto darfst du ab 14 Jahren selbst anlegen. Wer jünger ist, braucht das Einverständnis der Eltern.</p>

<h2>10. Änderungen</h2>
<p>Wenn sich das Spiel ändert, passen wir diese Erklärung an. Die aktuelle Fassung steht immer im Spiel und auf der Webseite.</p>`;
}
