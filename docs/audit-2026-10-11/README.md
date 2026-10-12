# Audit der Survey-Extension – 11. Oktober 2026

> **Aktualisierung:** Die anschließende Frontend-Umsetzung und die bewusst akzeptierten API-/Token-Grenzen sind in [Survey 0.1.0](../frontend-improvements-2026-10-11.md) dokumentiert. Die folgenden Befunde beschreiben den ursprünglichen Audit-Stand.

## Ergebnis und Prüfstand

Die Modernisierung ist technisch gebaut, aber noch nicht ausreichend gegen Datenverlust, widersprüchliche Bestände und fehlerhafte gespeicherte Daten abgesichert. Der ursprüngliche erfolgreiche Build war kein Nachweis für eine funktionierende ChurchTools-Integration: Die lokal installierte Extension zeigte weiterhin „Foo“, und die neue Detailabfrage benutzte einen nicht vorhandenen Backend-Endpunkt.

**Die lokale Auslieferung wurde inzwischen korrigiert:** Der neue Produktionsbuild ist über die reguläre Datei-API in `http://churchtools.test/ccm/survey/` installiert. Dort wurden Anlegen einer Umfrage, Hinzufügen einer Option und Öffnen der Detailansicht erfolgreich geprüft. Die dabei angelegte Kategorie 22 wurde anschließend entfernt. Die früheren Audit-Kategorien 20 und 21 wurden ebenfalls entfernt; die ursprüngliche Kategorie 4 blieb unverändert. Die leere Übersicht ist jetzt erwartbar: Kategorie 4 enthält leere Daten und den Shorty `survey-1`, kein vom bisherigen `survey_`-Filter erfasstes Umfrageobjekt.

Geprüft wurden Quellcode, lokale Backend-Implementierung, Lese- und Schreibzugriff mit dem freigegebenen Testkonto, Desktop-Browser und Reproduktionstests. Für die Untersuchung weiterer Funktionen musste der anfänglich fehlerhafte Detail-GET in einem **temporären Entwicklungsserver** durch eine Listenabfrage ersetzt und CSRF initialisiert werden. Dieser Server wurde gestoppt. Die finale Installation verwendet den korrigierten Quellcode ohne diesen Adapter.

Keine belastbare Prüfung von Mobilgeräten, anonymen Teilnehmern, eingeschränkten Rollen oder gleichzeitigen echten Browser-Sessions. Das Admin-Testkonto allein belegt keine korrekte Berechtigungsarchitektur. Bestehende produktive Umfragedaten wurden nicht migriert oder verändert.

Prioritäten: **P1** = Datenverlust, Integrität oder wesentliche Funktionsstörung; **P2** = relevante Robustheits-, Bedienungs- oder Wartbarkeitslücke. „Live“ bezeichnet die lokale ChurchTools-API; manche UI-Reproduktionen liefen während der Untersuchung über den beschriebenen Entwicklungsadapter. Codebefunde und Produktempfehlungen sind entsprechend gekennzeichnet.

## Während des Audits behoben

| Befund | Nachweis | Korrektur |
| --- | --- | --- |
| Installierte Extension zeigt nur „Foo“ | Tatsächliche URL im Browser; installierte Dateien enthielten den alten Platzhalter | Geprüften Build über `/api/files/custom_module/4` installiert; vorherige Dateien in `/tmp/survey-installed-placeholder-backup.tgz` gesichert |
| P1: Nicht unterstützter Detail-GET | `/api/custommodules/4/customdatacategories/20` lieferte 405; Backend bietet nur GET auf der Kategorienliste | `src/data/ccm.ts` lädt die Liste und sucht die ID; Detailansicht und frische Abfrage vor Teilnahme verwenden diese Funktion. Test-Mock lehnt unbekannte Endpunkte jetzt ab |
| P1: E-Mail ohne Abfrage gespeichert | `askForMail=false`, kein E-Mail-Eingabefeld; vorbefüllte Konto-E-Mail erschien dennoch im gespeicherten Testeintrag | `src/form/SurveyForm.vue` übermittelt E-Mail nur bei aktivierter Abfrage |
| P2: CSRF fehlt bei Entwicklungszugriff | Cross-Origin-Schreiben von `127.0.0.1:5174` ergab 401; mit CSRF-Token erfolgreich. Same-Origin-Anfragen waren davon nicht pauschal betroffen | Client lädt API-CSRF über `setLoadCSRFForAPI()` |
| P2: ID-Erzeugung setzt sicheren Browserkontext voraus | `crypto.randomUUID()` ist auf normalen HTTP-Hosts nicht zuverlässig verfügbar | UUID aus `crypto.getRandomValues()`; Option und Umfrage auf `http://churchtools.test` erfolgreich angelegt |
| P2: Rechte nach Anlegen/Löschen veraltet | Kategorie-ID-Rechte werden vom Backend verändert, aber waren nicht invalidiert | Rechtecache wird invalidiert; neue Testumfrage erschien direkt in der Übersicht |
| P2: Routenwechsel während Löschbestätigung verändert Ziel | Reproduktionstest: ID 10 wird während Bestätigung zu 11, bisherige Anfrage verwendete Kategorie 11 | Modul und Kategorie werden vor Bestätigung festgehalten; Regressionstest |

Die Entwicklung meldet einen bereits angemeldeten Benutzer außerdem nicht mehr blind erneut an. Ein fehlgeschlagener erster Entwicklungslogin kann weiterhin den Start vor dem Mount abbrechen; dafür fehlt eine sichtbare Fehlerseite.

## Offene Fehler und Architekturprobleme

### A01 – P1: Ungespeicherter Entwurf geht beim Aktivieren/Deaktivieren verloren

**Live reproduziert.** In der Detailansicht einen anderen Namen eingeben, ohne zu speichern, anschließend „Deaktivieren“ drücken. Der Name springt auf den gespeicherten Wert zurück. `src/survey/SurveyDetail.vue:74` bindet den Editor-Key an `meta.modifiedDate`; die separate Statusänderung aktualisiert das Datum und ersetzt den gesamten Editor. Auch ein fremdes Update mit neuem Datum kann einen Entwurf ersetzen.

**Behebung:** Stabile Editor-Identität pro Umfrage, explizite Synchronisierung nach eigenem erfolgreichem Speichern, Dirty-State und Konflikthinweis bei eingehenden Änderungen. Statusaktionen müssen mit dem aktuellen Entwurf koordiniert werden. Navigation ohne Speichern ebenfalls absichern.

### A02 – P1: Vollständige JSON-Updates überschreiben neuere Änderungen

**Mit Reproduktionstest belegt.** `src/composables/useSurveys.ts` verwendet für Teiländerungen bevorzugt den Kategorienlisten-Cache, erst danach den Detailcache. Eine ältere Liste kann dadurch einen frischeren Detailstand überschreiben. Beispiel: anderer Tab ändert den Namen; lokale Statusänderung schreibt den alten Namen wieder mit. Listen- und Detaildaten haben unabhängige Query-Keys.

**Behebung:** Gemeinsame Datenquelle und Revisionen. Vor dem Schreiben frisch laden reduziert veraltete lokale Daten, löst aber parallele Writes nicht vollständig. Verlässlicher Konfliktschutz benötigt serverseitige Versionsprüfung bzw. bedingte Updates.

### A03 – P1: Verwaltung umgeht Auswahl- und Mengenregeln

**Live reproduziert.** Für eine Option mit Gesamtkapazität 1 und maximal 1 pro Person konnte der vorhandene Eintrag von 1 auf 3 geändert und gespeichert werden. `src/survey/SurveyEntries.vue:83` prüft Namen und nichtnegative ganze Mengen, aber weder Gesamtkapazität noch Personenlimit. Auch Auswahlanzahl, bekannte IDs, doppelte Auswahl und Namenskonflikte werden nicht konsistent geprüft.

**Behebung:** Gemeinsame Domänenvalidierung für Erstellen und Bearbeiten; bei Bearbeitung den alten Eintrag aus dem Bestand herausrechnen. Eine bewusst erlaubte administrative Überschreitung braucht eine ausdrückliche Aktion und Kennzeichnung statt stillen Regelbruchs.

### A04 – P1: Entfernen verwendeter Optionen verwaist bestehende Einträge

**Codebefund.** `src/components/SurveyEditor.vue:173` entfernt eine Option unmittelbar aus dem Schema. Es gibt keine Prüfung auf bestehende Antworten. Die IDs bleiben in gespeicherten Einträgen, aber Beschriftung, Filter und Summen orientieren sich nur an den verbliebenen Optionen. Antworten können dadurch in der Anzeige verschwinden.

**Behebung:** Benutzte Optionen archivieren oder Entfernung verhindern; historische Beschriftungen erhalten. Eine echte Migration muss referenzierende Antworten ausdrücklich behandeln.

### A05 – P1: Gespeicherte JSON-Daten werden nicht als Domänenobjekte validiert

**Reproduktionstest und Codebefund.** `src/data/ccm.ts` prüft lediglich, ob JSON ein Objekt ist, und castet anschließend auf den gewünschten Typ. `{}` oder ein unbekannter Umfragetyp passieren. `src/Overview.vue:54` greift ungeprüft auf die Typdefinition zu; andere Komponenten erwarten `fields` und `entry.data`. Ein einziges ungültiges JSON lässt die gesamte Kategorienliste scheitern.

**Behebung:** Laufzeitschema mit Versionsnummer, kontrollierte Migration und getrennte Fehlerbehandlung pro Kategorie. Ungültige Datensätze sollten diagnostizierbar bleiben, während gültige Umfragen weiter nutzbar sind. Keine stillen Defaults, die Datenfehler verstecken.

### A06 – P1: Mengenlimits und Duplikate sind nicht atomar abgesichert

**Architekturbefund; mit Validierungsreproduktion bestätigt, kein echter Parallelbrowser-Test.** Teilnahme liest den aktuellen Bestand, validiert im Browser und schreibt anschließend einen beliebigen JSON-Eintrag. Zwei Teilnehmer können denselben letzten Platz prüfen und beide buchen. Die generische Custom-Data-API versteht weder Kapazitäten noch fachliche Duplikate. Direkte API-Anfragen umgehen die Browservalidierung.

**Behebung:** Serveroperation für Prüfen und Buchen in einer Transaktion oder atomare Reservierung. Der README-Hinweis auf die Einschränkung ist korrekt, ersetzt aber keine verbindliche Kapazitätsgarantie. Bis dahin muss die Produktbeschreibung die Grenze klar benennen.

### A07 – P2: Verborgene Teilnehmerdaten zeigen falsche Verfügbarkeit

**Live reproduziert.** Bei `hideDataFromParticipants=true` lädt `useSurvey` keine Einträge. `SurveySelection` berechnet deshalb den Bestand aus einer leeren Liste. Eine bereits überbuchte Option zeigte „1 verfügbar“; beim Absenden erschien gleichzeitig „nicht mehr genügend Mengen verfügbar“. [Screenshot](availability-contradiction.png).

**Behebung:** Separate zulässige Aggregate ohne Personendaten laden. Falls die API das nicht bietet, keinen verfügbaren Bestand behaupten. Die frische Abfrage beim Absenden benötigt zudem Leserechte; eine Rolle mit ausschließlich Anlegerechten wurde nicht getestet. Der UI-Schalter allein stellt keinen API-Datenschutz her.

### A08 – P2: Backend-Größenlimits fehlen im Editor

**Backend- und Codebefund.** `CustomModuleDataCategoryRestApi` begrenzt `name` auf 100, `description` auf 300, `shorty` auf 50 und das gesamte JSON-`data` auf **2.000 Zeichen**. Optionen, UUIDs und Beschreibung verbrauchen dieses kleine Budget schnell. Einträge sind auf 10.000 Zeichen begrenzt. Der Editor hat keine passende Längenprüfung und keinen Hinweis auf das Gesamtbudget.

**Behebung:** Tatsächliche serialisierte Payload vor dem Speichern prüfen, Feldgrenzen anzeigen und verständliche Fehlermeldung liefern. Für größere Umfragen braucht es ein anderes Speichermodell bzw. eine Erweiterung des Backend-Vertrags. Das ist keine unbegrenzte Dokumentdatenbank.

### A09 – P2: Lade-, Fehler- und Routingzustände sind unvollständig

**Codebefunde und beobachteter Entwicklungsloginfehler.** `/0` deaktiviert die Detailabfrage, bleibt aber im Pending-Zustand. Unbekannte Routen haben keine 404-Seite. Die Eintragsverwaltung zeigt während des Ladens eine leere Liste statt eines Ladezustands. „Erneut laden“ in Übersicht und Detail lädt bei Rechtefehlern nur die Umfragen erneut, nicht die Rechte. Fehler vor `createApp` verhindern eine sichtbare Oberfläche.

**Behebung:** Ungültige IDs vor Query-Aufruf behandeln, 404 und konkrete Fehlerseiten, getrennte Loading-/Empty-Zustände und vollständige Retry-Aktionen. Initialisierung mit sichtbarem Fehlerzustand statt unkontrolliertem Top-Level-Abbruch.

### A10 – P2: Sortieren schreibt sämtliche sichtbaren Umfragen einzeln

**Codebefund.** `src/Overview.vue:26` führt für eine Pfeilaktion N vollständige Updates aus. Zwischenstände sind sichtbar; ein Fehler hinterlässt eine teilweise sortierte Liste. SortKeys werden nur anhand bearbeitbarer Umfragen vergeben und können mit anderen vorhandenen Umfragen kollidieren.

**Behebung:** Stabile globale Reihenfolge, möglichst atomare Sortieroperation bzw. wenige gezielte Änderungen mit Wiederherstellungsstrategie. Sortierung darf keine nebenläufigen Änderungen am ganzen JSON überschreiben.

### A11 – P2: Link-Token ist keine Zugriffsberechtigung

**Codebefund.** `src/utils/tokenHelper.ts` codiert eine Kategorie-ID reversibel. Das erlaubt kompatible Links, macht diese aber nicht geheim oder fälschungssicher. Ob fremde Kategorien gelesen/beschrieben werden dürfen, muss ausschließlich die API entscheiden.

**Behebung:** Berechtigungen mit eingeschränkten und anonymen Konten testen. Für echte private Einladungs- oder Bearbeitungslinks serverseitig verifizierte Tokens einsetzen; keine Sicherheitszusage aus der ID-Codierung ableiten.

### A12 – P2: Release-Artefakte sind nicht eindeutig nachvollziehbar

**Codebefund.** `scripts/package.js` benennt ZIPs nach Paketversion und aktuellem Git-Commit, obwohl die Arbeitskopie uncommitted Änderungen enthält. Unterschiedliche Builds können denselben Namen erhalten und vorhandene Archive überschreiben. Der hier installierte Stand ist deshalb nicht allein über den Commit-Suffix identifizierbar.

**Behebung:** Build-Inhaltshash und Metadaten, Dirty-State ausweisen oder Release nur aus einem sauberen Commit erstellen. Installierten Stand in der Oberfläche/Diagnose kenntlich machen.

### A13 – P2: Tests bestätigten einen falschen API-Vertrag

**Nachgewiesen.** Die vorherigen 17 grünen Tests akzeptierten die nicht vorhandene Detail-GET-Route, weil ein allgemeiner Mock beliebige unbekannte Pfade als Kategorie beantwortete. Der Mock ist jetzt streng und es gibt einen expliziten Regressionstest. Weiter fehlen realistische Backend-Vertragstests, Editor-Draft-Tests, Rollen- und echte Browser-Flows sowie Migrationsfixtures.

**Behebung:** API-Fixtures am tatsächlichen Backend-Vertrag ausrichten. Kritische Flows mit create → detail → edit → participate → results prüfen. Tests für Nebenläufigkeit, Fehler, genutzte Optionen und beschädigte Altdaten priorisieren; weitere reine Implementationstests liefern hierfür wenig Sicherheit.

## Fachliche Entscheidungen und Datenkompatibilität

- `optionCount` zählt auch `cancelled`/„Zurückgebracht“ als belegte Kapazität. Ob Rückgaben wieder verfügbar sein sollen, hängt vom fachlichen Modell ab. Derzeit ist das nicht klar beschrieben. Bei Rückgabe von Inventar wäre dieses Verhalten falsch; bei einer Gesamtobergrenze für Anmeldungen kann es beabsichtigt sein.
- Mengen als numerische Strings werden in Labels teilweise angezeigt, aber bei Summen ignoriert. Ein solcher Bestand wurde in der lokalen ursprünglichen Kategorie nicht nachgewiesen. Import-/Migrationsdaten sollten normalisiert oder klar abgewiesen werden.
- Kategorie 4 mit `survey-1` und leeren Daten wird ausgefiltert. Der Unterstrich-Filter war bereits vorher vorhanden: kein neu eingeführter Verlust belegter Altdaten. Vor einer Migration fehlen repräsentative echte Alt-Umfragen aller vier Typen.
- Namensgleichheit ist aktuell das zentrale Duplikatkriterium. Verschiedene Personen mit gleichem Namen werden blockiert, während dieselbe Person durch einen anderen Namen mehrfach teilnehmen kann. Identitäts- und Gastmodell müssen fachlich definiert werden.

## UI und Layout

1. **Detailseite ist zu lang:** Der vollständige Einstellungseditor steht immer vor den Einträgen. Regelmäßige Ausgabe-/Rückgabe-Aufgaben verlangen viel Scrollen. Empfohlen sind getrennte Ansichten für Ergebnisse/Einträge und Einstellungen sowie kompakte Status-/Kapazitätsübersicht.
2. **Entwurf und gespeicherter Stand sind unklar:** Optionen werden im Modal lokal „gespeichert“, persistieren aber erst mit „Änderungen speichern“. Es fehlt eine sichtbare Kennzeichnung ungespeicherter Änderungen und eine Navigationsabsicherung.
3. **„Vorschau“ ist das echte Teilnahmeformular:** Antworten werden regulär gespeichert. Eine echte Vorschau muss Schreibaktionen ausschließen bzw. deutlich als produktive Teilnahme bezeichnet werden.
4. **Statusmodell ist zu grob:** Inaktiv, noch nicht geöffnet und abgelaufen teilen sich „geschlossen“. „Jetzt öffnen“ setzt Start- und Enddatum leer und verwirft damit auch eine gewollte zukünftige Schließung. Zustände und Statusaktionen sollten konkreter sein.
5. **Fehler erscheinen gesammelt oben:** Lange Formulare bieten keine konsequente Feldzuordnung oder Fokusführung. Mengenfelder starten teilweise bei 0, obwohl die Grenzen positiv sein sollen; „unbegrenzt“ sollte ausdrücklich wählbar sein.
6. **Icon-Aktionen brauchen Kontext:** Wiederholte Buttons wie „Option entfernen“ haben zwar eine zugängliche Grundbeschriftung, aber keinen Optionsnamen und keine erklärenden Tooltips. Für Tastatur- und Screenreader-Bedienung fehlt eine systematische Prüfung.
7. **Ergebnisdarstellung ist schwach:** Optionsfilter mit Zählern ersetzen keine Rangliste, Terminvergleich, Prozentwerte oder übersichtliche Auswertung. Termintexte erscheinen an manchen Stellen als rohe gespeicherte Strings.
8. **Während Requests bleibt der Entwurf teilweise editierbar:** Der abgesendete Stand kann vom weiterhin sichtbaren Stand abweichen. Snapshot und Pending-Verhalten müssen konsistent sein.

Responsive Layouts sind aufgrund eines nicht wirksam angewendeten Viewport-Overrides **nicht abschließend getestet**. Es wird kein konkreter mobiler Overflow als reproduzierter Fehler behauptet.

## Fehlende Features – Produktpotenzial, keine automatisch belegten Regressionen

| Priorität | Ergänzung | Nutzen |
| --- | --- | --- |
| Hoch | Ergebnisansicht nach Umfragetyp mit Rangfolge, Auslastung und Terminvergleich | Kernnutzen der Umfrage wird direkt erkennbar |
| Hoch | CSV-Export mit stabilen Optionsbeschriftungen und Mengen | Auswertung und operative Weiterverwendung |
| Hoch | Link kopieren, QR-Code und eindeutige Trennung von Vorschau/Teilnahme | Verteilung ohne URL-Handarbeit und Testantworten im Bestand |
| Hoch | Optionen sortieren sowie genutzte Optionen archivieren | Inhaltspflege ohne Verwaisen historischer Antworten |
| Mittel | Statusfilter, Mehrfachaktionen, Pagination | Alltagstaugliche Verwaltung größerer Bestände |
| Mittel | Teilnehmer bearbeiten/stornieren mit serverseitig abgesichertem Zugriff | Korrekturen ohne Admin-Unterstützung |
| Mittel | Änderungsverlauf und Konflikthinweise | Nachvollziehbarkeit und Wiederherstellbarkeit |

## Empfohlene Reihenfolge

1. Datenverlust vermeiden: A01, A02, A04; anschließend A03 für einheitliche Regeln.
2. Laufzeitschemas und Payload-Vertrag absichern: A05, A08, A13.
3. Rollen-/Gastzugriff und Kapazitätsgarantie klären: A06, A07, A11.
4. Detailseite in Einstellungen und Ergebnisse aufteilen; echte Vorschau, Ergebnisansicht und Export ergänzen.
5. Fehlerzustände, Sortierung, Release-Nachvollziehbarkeit und größere Bestände verbessern.

## Prüfnachweise

- Finaler `npm run check`: Typecheck, ESLint, **19 Tests** und Produktionsbuild erfolgreich.
- `reproductions.test.ts.txt` und `test-results.txt` dokumentieren den **früheren Audit-Zwischenstand**: 17 damalige reguläre Tests plus 9 temporäre Tests, die gerade die beschriebenen Fehlverhalten bestätigen. Sie sind kein Beleg für 26 behobene Fehler und werden nicht als aktive Projekt-Tests mitgeliefert.
- [Installierte Oberfläche](installed-overview.png), [Detailseite der danach bereinigten Testumfrage](installed-survey.png), [widersprüchliche Verfügbarkeit vor Behebung weiterer offener Punkte](availability-contradiction.png).
- Keine Änderungen am lokalen ChurchTools-Backend. Es wurde nur das Survey-Frontend regulär installiert.
