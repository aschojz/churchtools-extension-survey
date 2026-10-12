# Survey 0.2.0: Umsetzung des UX-/UI-Audits

Stand: 12. Oktober 2026. In `churchtools.test` installiert. Die Anwendung verwendet weiterhin ausschließlich das vorhandene Backend; der vereinbarte Link-Token bleibt erhalten.

## Befunde und Umsetzung

| Befund aus dem [erneuten Audit](../reaudit-2026-10-11/README.md) | Ergebnis |
| --- | --- |
| F01: Entwurfverlust bei eigener Antwort | Interner Antwortwechsel fragt vor dem Verwerfen nach. Abbrechen erhält den Entwurf. Stornierung fragt ebenfalls ausdrücklich nach, falls Eingaben verloren gingen. |
| F02: Verborgene Mehrfachauswahl | Suche und Filterwechsel heben die Auswahl auf. Mehrfachaktionen greifen auf sichtbare Antworten zu, nennen Zielstatus und Betroffene und verlangen Bestätigung. Auswahl lässt sich ausdrücklich aufheben. Schreiben verwendet den zuvor gesehenen Antwortstand als Konfliktsnapshot. |
| F03: Archivierte eigene Optionen unsichtbar | Bereits gewählte archivierte Optionen bleiben im Editor sichtbar. Archivierte Mengen können gehalten oder reduziert werden; Erhöhen über die ursprüngliche Menge ist gesperrt. Für neue Antworten bleiben sie ausgeblendet. |
| F04: Stornierte Wähler in Namenslisten | Namenslisten und Stimmenzahlen schließen zurückgezogene Antworten konsistent aus. Singular „1 Stimme“. |
| F05: Mobile Tabnamen | Zwei Reihen auf Smartphones, vier Tabs auf Desktop. Unter 360 Pixeln haben ausgeschriebene Namen Vorrang vor Icons. Aktiver Tab bleibt eindeutig markiert. |
| F06: Zu geringer Kontrast | Primärfarbe auf `#166534` abgedunkelt. Live am Speichern-Button gemessen: Weiß auf RGB(22,101,52), ca. **7,13:1**. Statusfläche zurückhaltend mit dunklem Text. |
| F07: ISO-Termine im Editor | Einheitliche Datumslabels mit Wochentag und lokaler Uhrzeit, auch im Bearbeitungsdialog und CSV. |
| F08: Such-/Filterverlust | Eintragsverwaltung bleibt bei Detailtabwechsel erhalten. Suche, Filter und Auswahl werden nicht durch neues Mounten zurückgesetzt. Bei Wechsel der Umfrage entsteht ein eigener Zustand. |
| F09: Begriffe und Zähleinheiten | Normale Abstimmung: Aktiv/Zurückgezogen. Reservierung: Reserviert/Ausgegeben/Zurückgebracht. Kennzahlen nennen Einheiten; Optionsfilter zeigen passende Antwortanzahlen einschließlich historischer Antworten. |
| F10: Lange Einstellungen | Abschnitte Inhalt, Optionen, Teilnahme und Termine; technische Bild-/Sortierfelder unter Erweitert. Sichtbare Aktionsleiste mit Speichern, Entwurfsstatus und Testansicht. Kürzere Typnamen mit Beispielen. |
| F11: Unklare eigene Bearbeitung | Formular sitzt in der zugehörigen Antwortkarte, mit eindeutigem Titel und Entwurfskennzeichnung. Zusammenfassung nennt Mengen, archivierte Optionen und Datum. Vorhandene Kommentare lassen sich bearbeiten; Kommentare ergänzen. |
| F12: Kein aggregierter Export | „Ergebnisse als CSV“ exportiert Rang, Mengen/Stimmen, aktive Antworten, Prozentwerte und Kapazitäten. „Antworten als CSV“ exportiert separat die Rohantworten. Ergebnisexport enthält keine Teilnehmernamen, E-Mails oder Kommentare. |

## Zusätzliche UX-Funktionen

- **Teilnehmeransicht testen:** Vorschau direkt aus dem aktuellen Entwurf, mit ausprobierbarer Auswahl und deutlicher Testkennzeichnung. Sie ruft keine Speicherfunktion auf und zählt keine Testantworten. Verfügbarkeit wird dort ausdrücklich nicht behauptet.
- **Antwortbestätigung:** Nach dem Absenden werden Name, gewählte Optionen/Mengen und Kommentar angezeigt. „Weitere Antwort abgeben“ öffnet den Ablauf ausdrücklich erneut.
- **Übersicht:** Suche, Statusfilter, Öffnungs-/Schließhinweis und kompakte Aktionsmenüs.
- **Terminvergleich:** Optional chronologische Ergebnisreihenfolge sowie Matrix mit aktiven Antworten gegen Termine. Breite Matrix scrollt innerhalb ihres eigenen Bereichs.
- **Verlauf:** Ausklappbare Vorher-/Nachher-Werte und ausdrücklicher Hinweis auf den beim Rückgängigmachen wiederhergestellten Stand. Der Verlauf bleibt auf den bestehenden Sitzungsverlauf begrenzt.

Die Übersicht lädt keine zusätzlichen Teilnehmerbestände für jede Umfrage, nur um dort Teilnehmerzahlen darzustellen. Direkte URL-Verknüpfung der Detailtabs ist in diesem Stand nicht ergänzt; der Zustand bleibt beim Tabwechsel innerhalb der Detailseite erhalten.

## Prüfung

`npm run check` erfolgreich: **43 Tests**, Typecheck, ESLint, Produktionsbuild. Acht neue Regressionstests prüfen insbesondere abgelehnte/bestätigte Antwortwechsel, Auswahl nach Suche, Bestätigung vor Mehrfachänderungen, archivierte eigene Mengen, konsistente Wählerlisten, aggregierten CSV-Inhalt, Terminmatrix und tatsächliche Änderungsdetails. `package:verify` und `git diff --check` erfolgreich.

Live mit dem freigegebenen Admin-Testkonto in `churchtools.test` geprüft:

- Übersichtssuche und Aktionsmenü;
- Auswahl aufheben durch Suche, Erhalt der Suche nach Tabwechsel;
- Mehrfachaktion abbrechen sowie bestätigen, resultierenden Status und Rückgängig prüfen;
- eigene Antwort mit ungespeichertem Namen wechseln: Abbrechen erhält, Bestätigen verwirft;
- archivierte Menge anzeigen, Erhöhen gesperrt, reduzieren und speichern;
- Entwurfs-Testansicht ausprobieren ohne Antwortspeicherung;
- echte Mengenantwort absenden und Zusammenfassung prüfen;
- Radio-Stimmenzahl und aktive Wählerliste vergleichen;
- Terminmatrix und lokal formatierten Bearbeitungsdialog prüfen;
- Vorher-/Nachher-Status im Verlauf prüfen;
- tatsächliche Viewports **390 und 320 Pixel**, einschließlich vollständig sichtbarer Tablabels und ohne Überlauf des Dokumentinhalts. Die Größensteuerung betrifft den zuletzt verwendeten Browser-Tab; die Prüfung misst deshalb dessen DOM-Breite, nicht die des anderen offenen Desktop-Tabs.

Die CSV-Inhalte sind automatisiert geprüft. Ein neuer Browserdownload bzw. ein physischer QR-Scan wurde in diesem Durchgang nicht wiederholt. Anonyme Teilnehmer, eingeschränkte Rollen und echte Mobilgeräte wurden nicht separat geprüft. Die Kontrastmessung des Primärbuttons ist keine vollständige Barrierefreiheitsprüfung.

Alle eigenen Testkategorien **33–36** samt Antworten wurden entfernt. Kategorie 4 blieb unverändert.

## Abbildungen

Die Abbildungen verwenden inzwischen entfernte synthetische Testdaten:

- [Mobile Einstellungen bei 320 Pixel](mobile-settings-320.png)
- [Terminmatrix](date-matrix.png)

Nuxt-UI-Komponenten und Anpassungen folgen der vorhandenen Installation; Dokumentation über [llms.txt](https://ui.nuxt.com/llms.txt).
