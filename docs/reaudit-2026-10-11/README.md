# Erneuter Survey-Audit: Funktionen, UX und UI

11. Oktober 2026 · installierter Stand 0.1.0 · Prüfung ohne Änderungen am Anwendungscode.

> Umsetzung am 12. Oktober: [Survey 0.2.0 mit UX-/UI-Fixes](../ux-fixes-2026-10-12/README.md). Die folgenden Befunde beschreiben den zuvor geprüften Stand.

## Bewertung

Die neue Aufteilung ist deutlich verständlicher als der frühere Stand. Ergebnisse, Eintragsverwaltung und Einstellungen sind erreichbar; Ladezustände, Entwürfe und Fehlermeldungen sind überwiegend nachvollziehbar. Die Oberfläche ist aber noch nicht durchgehend zuverlässig bedienbar. Zwei reproduzierte Probleme betreffen verlorene Eingaben bzw. ungewollte Änderungen an ausgeblendeten Antworten. Danach sollten Konsistenz, Lesbarkeit und die mobile Navigation verbessert werden.

Bewusst akzeptierte Backendgrenzen, Link-Token und fehlende serverseitige Paginierung sind **keine neuen Audit-Befunde**. Alle folgenden Verbesserungen lassen sich im Frontend bearbeiten.

## Prüfung und Grenzen

- Live in `churchtools.test` mit dem freigegebenen Admin-Testkonto; vier isolierte Umfragen, Kategorien 29–32, mit aktiven und stornierten Antworten.
- Desktop: Ergebnisse, Einstellungen, Eintragsverwaltung, eigene Teilnahme, normale Abstimmung, Archivierung, Filter, Mehrfachaktion, Terminbearbeitung, Teilen, Datumsvalidierung und Rückgängig.
- Smartphone: Screenshot bei 390 Pixel zeigt die mobile Einstellungsseite. Die spätere 320-Pixel-Anforderung wurde von der Browsersteuerung nicht wirksam übernommen (DOM blieb 1280 Pixel); für 320 Pixel wird deshalb kein erfolgreicher Test behauptet.
- `npm run check` erneut erfolgreich: Typecheck, ESLint, 35 Tests und Produktionsbuild. Diese Tests decken die unten beschriebenen Interaktionsketten nicht ausreichend ab.
- Keine separate Prüfung mit anonymen Teilnehmern oder eingeschränkten Rollen. Kein Lasttest mit Hunderten Antworten, keine komplette Screenreader-Prüfung, kein QR-Scan auf einem echten Telefon.
- CSV-Serialisierung ist durch Tests geprüft; der tatsächliche Download wurde im vorangegangenen Durchgang geprüft und in diesem Durchgang nicht wiederholt. Neue Teilnahme wurde diesmal live für Einfachauswahl abgesendet; die übrigen Typen wurden dargestellt und über bestehende Tests geprüft.
- Eigene Testdaten wurden nach der Prüfung entfernt; ursprüngliche Kategorie 4 blieb unverändert.

## Priorisierte Befunde

### F01 · P1 · Wechsel zwischen eigenen Antworten verwirft Eingaben

**Live reproduziert:** „Meine Teilnahme verwalten“ öffnen; erste Antwort bearbeiten; Name auf `TEST UNGESPEICHERT` ändern; bei der zweiten Antwort „Bearbeiten“ anklicken. Der Editor zeigt sofort den Namen der zweiten Antwort. Keine Nachfrage, keine Erhaltung des ersten Entwurfs.

`edit()` ersetzt den Entwurf und seine Baseline direkt. Der Routenwächter schützt diesen internen Wechsel nicht. Auch die Aktionsbuttons der übrigen Antworten bleiben verfügbar.

**Änderung:** Wechsel durch denselben Verwerfen-Dialog absichern oder andere Bearbeiten-/Stornieren-Aktionen während eines Entwurfs sperren. Editor direkt an der betroffenen Karte darstellen und die bearbeitete Antwort eindeutig kennzeichnen.

Quelle: [OwnParticipation.vue](../../src/form/OwnParticipation.vue), Zeilen 42–45 und 83–102.

### F02 · P1 · Mehrfachaktion verändert ausgeblendete Antworten

**Live reproduziert:** `TEST Teilnehmer 1` auswählen; nach `Neue Abstimmung` suchen. Nur `TEST Neue Abstimmung` ist sichtbar und ihre Checkbox ist leer; trotzdem steht „1 ausgewählt“. „Zurücknehmen / stornieren“ anklicken: Die ausgeblendete Antwort von `TEST Teilnehmer 1` wird ohne zusätzliche Bestätigung storniert. Nach erneutem Suchen ist der geänderte Status sichtbar.

Die Aktion liest Auswahl-IDs aus dem gesamten Bestand statt aus der aktuellen Ansicht. Unsichtbare Auswahl kann sinnvoll sein, braucht aber eine ausdrückliche Kennzeichnung und nachvollziehbare Bestätigung.

**Änderung:** Auswahl beim Filterwechsel bereinigen oder „1 ausgewählt, davon 1 ausgeblendet“ zeigen, Auswahlübersicht und „Auswahl aufheben“ anbieten. Vor Stornierungen Anzahl und Zielzustand bestätigen. Aktionen sollten klar erkennen lassen, auf welche Antworten sie wirken.

Quelle: [SurveyEntries.vue](../../src/survey/SurveyEntries.vue), Zeilen 155–177. [Screenshot](hidden-bulk-selection.png).

### F03 · P2 · Archivierte eigene Auswahl bleibt unsichtbar im Editor

**Live reproduziert:** Antwort mit Vormittag und Nachmittag vorhanden; Nachmittag archivieren; eigene Antwort bearbeiten. Die Zusammenfassung nennt beide Workshops. Der Editor zeigt ausschließlich Vormittag. Die archivierte Nachmittagsmenge bleibt im Entwurf erhalten, ist aber weder sichtbar noch reduzierbar.

`SurveySelection` entfernt archivierte Optionen unabhängig davon, ob gerade eine neue oder bestehende Antwort bearbeitet wird. Mengenänderungen erhalten die übrigen Schlüssel im Datenobjekt. Bei Radio-Auswahl würde die Wahl einer aktiven Option dagegen die alte Auswahl ersetzen: unterschiedliche, für Teilnehmer nicht erkennbare Regeln.

**Änderung:** Bei Bearbeitung bereits gewählte archivierte Optionen anzeigen, als archiviert kennzeichnen und eine klare Regel für Beibehalten/Reduzieren anbieten. Sie bleiben für neue Antworten gesperrt.

Quellen: [SurveySelection.vue](../../src/form/SurveySelection.vue), Zeilen 17–18 und 37–49; [OwnParticipation.vue](../../src/form/OwnParticipation.vue), Zeilen 106–112. [Screenshot](own-archived.png).

### F04 · P2 · Stimmzahl und Wählerliste widersprechen sich

**Live reproduziert:** Eine aktive und eine stornierte Antwort für dieselbe Radio-Option. Anzeige: „1 Stimmen · TEST Teilnehmer 1, TEST Teilnehmer 2“. Die Stimmenzählung schließt Stornierungen korrekt aus; die Namensliste nicht. Dasselbe ungefilterte Muster existiert bei Checkboxen.

**Änderung:** Aktive Stimmen und Namenslisten aus derselben gefilterten Datenmenge ableiten. Historische Teilnehmer gegebenenfalls getrennt und mit Status zeigen. „1 Stimme“ korrekt singularisieren.

Quelle: [SurveySelection.vue](../../src/form/SurveySelection.vue), Zeilen 74–78 und 135–139. [Screenshot](cancelled-voters.png).

### F05 · P2 · Mobile Tabnamen sind kaum unterscheidbar

Bei 390 Pixel zeigt die Navigation „Erg…“, „Eint…“, „Eins…“, „Verl…“. Insbesondere Einträge und Einstellungen sehen ähnlich aus. Zugängliche Namen sind vollständig, helfen aber sehenden Nutzern nicht bei der Orientierung. Der große Kopfbereich verdrängt den eigentlichen Inhalt weit nach unten.

**Änderung:** Zwei Reihen mit ausgeschriebenen Tabnamen oder eine horizontale Navigation mit ausreichend breiten Tabs; kompakter Statusbereich und kleinere sekundäre Kopfaktionen. Nicht allein auf Icons setzen.

Quelle: [SurveyDetail.vue](../../src/survey/SurveyDetail.vue), Zeilen 94–115. [Mobiler Screenshot](mobile-settings.png).

### F06 · P2 · Primärfarbe bietet zu wenig Textkontrast

Live gelesen am aktiven Speichern-Button: weißer Text auf `oklch(0.723 0.219 149.579)`. Daraus ergibt sich rechnerisch ein Kontrast von ungefähr **2,25:1**. Helles Grün wird auch für zahlreiche Outline-Aktionen genutzt. Im mobilen Screenshot fallen insbesondere kleine Aktionslabels und Icons schwach aus.

**Änderung:** Dunkleren Grünton für Text und primäre Buttons verwenden; Erfolgsmeldungen mit zurückhaltendem Hintergrund und dunklem Text darstellen. Fokus-, Hover- und Disabled-Zustände anschließend separat prüfen. Dies ist eine konkrete Farbmessung, keine vollständige Barrierefreiheitszertifizierung.

### F07 · P2 · Terminbearbeitung zeigt technische ISO-Werte

**Live reproduziert:** Terminantwort bearbeiten. In der Auswahl steht `2026-11-01T09:00:00Z`, während Ergebnisse und Teilnahmeansicht `1.11.2026, 10:00:00` anzeigen. Das sieht wie ein anderes Datum bzw. eine andere Uhrzeit aus.

**Änderung:** Auch im Bearbeitungsdialog `optionLabel()` verwenden; kompakt mit Wochentag, Datum und Uhrzeit. Zeitzone bei Bedarf einmal erklären. Technischer gespeicherter Wert bleibt unverändert.

Quelle: [SurveyEntries.vue](../../src/survey/SurveyEntries.vue), Zeile 403. [Screenshot](date-edit.png).

### F08 · P2 · Tabwechsel verliert Suche, Filter und Auswahl

**Live reproduziert:** Einträge nach `Teilnehmer 1` suchen; zu Ergebnisse wechseln und zurück. Das Suchfeld ist leer, alle Einträge werden wieder angezeigt. Die Komponente wird durch `v-if` neu aufgebaut; Filter und Auswahl sind lokale Zustände.

**Änderung:** Such-/Filterzustand je Umfrage im übergeordneten Detailzustand oder in URL-Parametern halten. Auswahlverhalten ausdrücklich definieren; Detailtab in der URL ermöglicht außerdem Reload und direkte Links.

Quelle: [SurveyDetail.vue](../../src/survey/SurveyDetail.vue), Zeile 118; [SurveyEntries.vue](../../src/survey/SurveyEntries.vue), Zeilen 27–34.

### F09 · P2 · Begriffe und Zahlen passen nicht zum Umfragetyp

Bei normaler Abstimmung erscheinen „Als ausgegeben markieren“ und „Zurückgebracht / storniert“. Mengenübersichten zeigen „Neu: 2“, ohne anzugeben, dass zwei Einheiten und nicht zwei Antworten gemeint sind. Optionsfilter zeigen aktive Mengen/Stimmen in Klammern, filtern aber auch historische Antworten: Klammerzahl und sichtbare Zeilenzahl können auseinanderliegen.

**Änderung:** Typabhängige Sprache: Abstimmung → aktiv/zurückgezogen; Ausgabe → reserviert/ausgegeben/zurückgebracht. Einheiten ausdrücklich nennen. Bei Optionsfiltern entweder passende Antwortanzahl anzeigen oder Kennzahlen klar beschriften. Vorhandene gespeicherte Statuswerte können gleich bleiben.

Quellen: [SurveyEntries.vue](../../src/survey/SurveyEntries.vue), Zeilen 45–58 und 73–84; [export.ts](../../src/utils/export.ts), `statusLabels`.

### F10 · P3 · Einstellungen sind zu lang und schlecht gewichtet

Bei nur zwei Optionen ist die mobile Einstellungsseite bereits rund 1950 Pixel hoch. Die einzige Speichern-Aktion steht am Ende. Bild-URL und technische Sortierreihenfolge sind gleich prominent wie Name und Optionen. Der lange Typname wird abgeschnitten; eine Erklärung der unterschiedlichen Typen fehlt im Bedienablauf.

**Änderung:** Abschnitte „Inhalt“, „Optionen“, „Teilnahme und Termine“, „Erweitert“. Speichern und Entwurfsstatus in einer gut sichtbaren, gegebenenfalls fixierten Aktionsleiste. Typauswahl bei Erstellung mit kurzen Beispielen und verständlicher Unterscheidung zwischen mehreren Optionen und mehreren Einheiten.

### F11 · P3 · Eigene Teilnahme zeigt weder Mengen noch klare Editierzuordnung

Die eigene Zusammenfassung nennt bei Mengen nur Optionsnamen. Ob eine oder zwei Einheiten reserviert sind, ist nicht erkennbar. Das Bearbeitungsformular erscheint unter allen Antwortkarten; identische Buttons „Bearbeiten“ sagen ohne Kartenkontext nicht, welche Antwort geöffnet ist. Auch Änderungen an Kommentaren werden dort nicht angeboten.

**Änderung:** Zusammenfassung mit `2 × Workshop`, Statusbadge und Datum. Formular innerhalb der gewählten Karte oder in eindeutig benanntem Dialog; verfügbare Mengen und eigene Reservierung getrennt benennen. Kommentaränderung als optionale Funktion ergänzen.

Quelle: [OwnParticipation.vue](../../src/form/OwnParticipation.vue), Zeilen 31–40 und 83–117.

### F12 · P3 · „CSV exportieren“ in Ergebnissen exportiert Rohantworten

Aus dem Code bestätigt: Ergebnisse und Eintragsverwaltung verwenden dieselbe `downloadCsv()`-Funktion. Der Export enthält einzelne Namen, E-Mail-Adressen, Kommentare und Antworten; keine Ergebnistabelle mit Rang, Summe, Prozentwerten oder Kapazität. Die Beschriftung im Ergebnisbereich lässt die Exportart offen.

**Änderung:** „Antworten als CSV“ und „Ergebnisse als CSV“ getrennt anbieten. Aggregierter Export passt zur sichtbaren Auswertung und lässt sich ohne Backendänderung erzeugen.

Quellen: [SurveyResults.vue](../../src/survey/SurveyResults.vue), Exportbutton; [export.ts](../../src/utils/export.ts), `surveyCsv()`.

## Funktionsprüfung

| Bereich | Ergebnis dieses Durchgangs |
| --- | --- |
| Vier Umfragetypen | Laden und Ergebnisse geprüft; Einfachauswahl live abgesendet; Mengen-/Datumsregeln zusätzlich durch Tests abgesichert |
| Rückgaben und Kapazität | Stornierte Antworten werden korrekt aus Mengen und Stimmen herausgerechnet; Namenslisten fehlerhaft, siehe F04 |
| Entwürfe im Einstellungseditor | Speichern mit gesperrten Eingaben, Verwerfen und ungültiger Öffnungs-/Schließreihenfolge live geprüft; eigener Antwortwechsel fehlerhaft, F01 |
| Archivierung | Gespeicherte Option bleibt in historischen Antworten erhalten; neue Teilnahme blendet sie aus; eigene Bearbeitung unvollständig, F03 |
| Suche und Mehrfachaktion | Suche und Statusschreiben funktionieren; verborgene Auswahl und Verlust bei Tabwechsel, F02/F08 |
| Rückgängig | Die geprüfte Stornierung wurde aus dem Sitzungsverlauf wieder auf Neu zurückgesetzt |
| Termine | Ergebnisse lokal formatiert; Bearbeitungsdialog zeigt ISO, F07 |
| Teilen | QR-Bild und Downloadlink vorhanden; HTTP-Linkkopieren zeigte „Link kopiert“; kein erneuter physischer QR-Scan/PNG-Download |
| CSV | 35er-Testlauf prüft Inhalt/Quoting/Formelschutz; kein erneuter Browserdownload; aggregierte Auswertung fehlt, F12 |
| Fehlerhafte Altumfrage | Kategorie 4 isoliert als Diagnose, gültige Umfragen weiter nutzbar |

## Sinnvolle nächste UX-Features

1. **Bestätigung vor Mehrfachänderungen** mit sichtbarer Anzahl, Zielstatus und ausgeblendeter Auswahl; zuverlässiger interner Entwurfsschutz. Zuerst F01/F02 beheben.
2. **Gute mobile Navigation und gemeinsame Darstellung** von Optionen, Datumslabels, Mengen und Status. Danach F03–F09.
3. **Teilnahmebestätigung mit Inhalt:** Nach Absenden Name, gewählte Optionen/Mengen und nächste Schritte zeigen; „Weitere Antwort abgeben“ bzw. „Meine Antwort ansehen“ ausdrücklich anbieten.
4. **Übersicht mit Suche und Statusfiltern**, Teilnehmerzahl und Öffnungs-/Schließdatum; kompakte Aktionsmenüs statt zahlreicher gleichgewichteter Buttons.
5. **Terminvergleich als Matrix** für Terminfindung: Antworten gegen Termine, mit verständlichen Summen und chronologischer Sortierung als Alternative zur Rangfolge.
6. **Verlauf mit Änderungsdetails:** Vorher/Nachher zeigen und kenntlich machen, welcher Stand wiederhergestellt wird. Der bestehende Verlauf nennt nur die geänderte Entität.
7. **Teilnehmeransicht für einen Entwurf** innerhalb der Verwaltung, klar als Test gekennzeichnet und ohne tatsächliches Absenden. So lassen sich Text, Bild und Optionen vor Freigabe beurteilen.

Diese Punkte benötigen keine Backendänderung. Automatisierte Interaktionstests sollten künftig gerade die Abläufe „Entwurf wechseln“, „Filter nach Auswahl ändern“ und „archivierte eigene Antwort bearbeiten“ abdecken.
