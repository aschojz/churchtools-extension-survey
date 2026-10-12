# Umsetzung des Audits: Survey 0.1.0

Stand: 11. Oktober 2026. Die Umsetzung bleibt vollständig im Frontend und verwendet die vorhandenen ChurchTools-Endpunkte. Der bewusst gewählte Link-Token wurde beibehalten. Das ursprüngliche [Audit](audit-2026-10-11/README.md) dokumentiert den damaligen Zwischenstand; diese Datei beschreibt den danach umgesetzten Stand.

## Oberfläche

| Wunsch | Umsetzung |
| --- | --- |
| 1. Detailseite aufteilen | Tabs für Ergebnisse, Einträge, Einstellungen und Verlauf; Ergebnisse als Standardansicht, soweit Leserechte vorhanden sind |
| 2. Entwürfe schützen | Kennzeichnung ungespeicherter Änderungen, stabiler Editor über Tabwechsel, ausdrückliches Verwerfen, Bestätigung bei Routenwechsel und Warnung beim Schließen/Neuladen; Statusaktionen bei offenem Entwurf gesperrt |
| 3. Teilnahme-Link korrekt benennen | „Teilnahmeformular“ statt „Vorschau“; Teilen-Dialog weist auf echte Antworten hin |
| 4. Zustände und Termine | Offen, geplant, deaktiviert und beendet getrennt; „Jetzt öffnen“ erhält ein zukünftiges Schließdatum |
| 5. Formularfehler | Nuxt-UI-Formularvalidierung mit Feldzuordnung und Fokus auf das betroffene Eingabefeld; explizite Schalter für unbegrenzte Mengen; Anzeige des serialisierten 2.000-Zeichen-Budgets |
| 6. Aktionen verständlich machen | Namen in zugänglichen Aktionsbeschriftungen, Tooltips, nachvollziehbare Modaltexte und allgemeine Bestätigungsdialoge |
| 7. Ergebnisse darstellen | Rangfolge, Stimmen bzw. Mengen, Prozentwerte, Kapazitäten, archivierte Optionen und formatierte Termine |
| 8. Laufende Requests | Eingaben und Aktionen gesperrt; Speichern arbeitet mit einem festgehaltenen Eingabestand |

## Funktionen und Datenintegrität

- **Rückgaben/Stornierungen geben Kapazität frei.** Ausgegebene Mengen bleiben belegt, bis sie zurückgebracht werden. Summen und Teilnahmevalidierung verwenden dieselbe Zählweise.
- **Mengenprüfung auch beim Bearbeiten:** Personenlimit, Gesamtkapazität, bekannte Optionen, Auswahlanzahl und Duplikate werden geprüft. Der eigene bisherige Eintrag wird aus dem Bestand herausgerechnet. Stornierungen sind auch bei inzwischen überbelegtem Bestand möglich.
- **Optionen sortieren und archivieren:** Gespeicherte Optionen behalten ID und Beschriftung. Archivierte Optionen sind im Teilnahmeformular nicht mehr wählbar; bestehende Antworten bleiben in Verwaltung, Ergebnissen und CSV sichtbar. Nur neue, noch nicht gespeicherte Optionen werden direkt entfernt.
- **CSV-Export:** Ergebnisse vollständig bzw. Einträge mit aktuellen Filtern exportieren. UTF-8-BOM, Semikolon-Trennung, Mengen, Status, Kommentare und archivierte Optionen; Formelanfänge aus Teilnehmereingaben werden entschärft. Für Excel/LibreOffice geeignet; kein zusätzlicher XLSX-Export.
- **Teilen:** Link kopieren, QR-Code lokal im Browser erzeugen und als PNG herunterladen. Kein externer QR-Service. Kopieren funktioniert auch auf der lokalen HTTP-Installation.
- **Eintragsverwaltung:** Suche, Options- und Statusfilter, Mehrfachauswahl und gemeinsame Statusänderungen. Erfolgreiche Teiloperationen bleiben sichtbar; ein Fehler meldet den erreichten Fortschritt.
- **Eigene Teilnahme:** Angemeldete Personen können ihre über `personId` zugeordneten Einträge mit vorhandenen Lese-/Bearbeitungsrechten verwalten. Eigene Auswahländerungen beachten den Öffnungszeitraum; Stornierungen bleiben möglich. Gäste erhalten keine neuen Bearbeitungstokens.
- **Verlauf/Rückgängig:** Die letzten 20 Änderungen an Umfragen und Einträgen in dieser Browser-Sitzung, in `sessionStorage` nach Konto getrennt. Wiederherstellung prüft zuvor den aktuellen Stand. Kein serverweiter Verlauf, keine Wiederherstellung gelöschter Umfragen oder Einträge.
- **Konflikte:** Einheitlicher Kategoriencache und erneutes Laden vor dem Schreiben. Editor-Snapshots werden mit dem aktuellen Inhalt verglichen; ein Konflikt erhält den lokalen Entwurf und verhindert das Überschreiben. Das verbleibende Zeitfenster zwischen Lesen und Schreiben kann die vorhandene API nicht atomar schließen.
- **Datenprüfung:** Laufzeitschemas und `schemaVersion: 1`. Ungültige Kategorien/Einträge werden getrennt diagnostiziert; auch verwaiste Optionsverweise werden erkannt. Ungültige Bestände werden nicht als freie Kapazität interpretiert. Fehlerhafte Einträge können mit vorhandenen Löschrechten und Bestätigung entfernt werden.
- **Verborgene Teilnehmerdaten:** Keine behauptete Verfügbarkeit auf Basis eines leeren Bestands; die Auswahl weist auf die Prüfung beim Absenden hin.
- **Fehlerzustände:** Ungültige IDs, fehlende Seiten, Ladezustände, Rechte-Retry und Fehler vor dem Start erhalten sichtbare Zustände statt leerer Oberflächen.
- **Sortierung:** Ein Pfeilklick schreibt nur die bewegte Umfrage mit einem Wert zwischen ihren Nachbarn. Neue Umfragen und Kopien erhalten einen eigenen Wert am Listenende. Bei nicht unterscheidbaren alten Sortierwerten gibt es einen Hinweis auf die manuelle Sortierreihenfolge in den Einstellungen.
- **Builds:** Öffentliche Dependencies, keine Styleguide-/Utils-Packages; Release-Name mit Version, Git-Revision und Hash des Build-Inhalts.

## Verifikation

`npm run check`: Typecheck, ESLint, **35 Tests** und Produktionsbuild erfolgreich. `package:verify` kontrolliert Paketinhalt und versehentlich eingebettete Entwicklungs-Zugangsdaten. Regressionstests prüfen insbesondere Entwürfe, Archivierung, Rückgaben, Mengenbegrenzungen, Datenfehler, veraltete Editorstände, CSV und Eingabefokus.

Direkt in `http://churchtools.test` getestet:

- Umfrage und Option anlegen, Rechte direkt aktualisieren, Detail öffnen;
- Duplikat erstellen und gezielt in der Übersicht verschieben;
- Entwurf über Tabwechsel erhalten, Navigation abbrechen und ausdrücklich verwerfen;
- deaktivieren/öffnen ohne Verlust des zukünftigen Schließdatums; Sitzungsverlauf und Rückgängig;
- unzulässige Menge in der Verwaltung zurückweisen; mehrere Einträge zurücknehmen und freie Kapazität kontrollieren;
- bestehende Option archivieren und historische Antwort weiterhin anzeigen;
- Teilnahme absenden, dabei Eingaben sperren, eigene Teilnahme bearbeiten und stornieren;
- CSV tatsächlich herunterladen und Inhalt prüfen; QR-Code und Link-Kopieren auf HTTP;
- Terminoptionen in Ergebnissen formatieren; Ergebnisse bei 390 Pixel Viewport ohne horizontalen Überlauf.

Die Browserprüfung nutzte das freigegebene Admin-Testkonto. Eingeschränkte Rollen und anonyme Teilnehmer wurden nicht separat durchgespielt. Die reale API bleibt für Berechtigungen zuständig. Alle ausschließlich angelegten Testkategorien 23–28 samt Einträgen wurden nach der Prüfung entfernt. Die ursprüngliche Kategorie 4 mit leeren, ungültigen Umfragedaten blieb unverändert und wird als Diagnose angezeigt.

[Ergebnisansicht mit temporären Testdaten](screenshots/survey-results.png). Die Testdaten sind nicht mehr im lokalen Bestand.
