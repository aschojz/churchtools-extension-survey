# Übernahme einer Umfrage in eine neue Gruppe

Der Tab **Gruppenübernahme** in der Umfrageverwaltung bietet einen Assistenten für beendete oder deaktivierte Umfragen. Bis zum abschließenden Klick auf **Jetzt übernehmen** werden ausschließlich Daten gelesen.

## Ablauf

1. Vorbereitung lädt die aktuelle Umfrage, gültige Antworten und installationsspezifische Stammdaten. Stornierte Antworten sind ausgeschlossen. Fehlerhafte gespeicherte Antworten müssen zuerst in der Verwaltung korrigiert werden.
2. Gruppentyp und Mitgliedsrolle wählen. Es gibt keine Auswahl einer bestehenden Gruppe: Jeder Lauf erzeugt eine neue Gruppe mit dem Umfragetitel. Die öffentliche Umfragebeschreibung (`surveyDescription`), ersatzweise die interne Beschreibung, wird als Gruppenbeschreibung übernommen.
3. Vorhandene Personen-IDs werden überprüft. Exakte E-Mail-Treffer sind Vorschläge und benötigen eine Bestätigung. Weitere Personen können über Name/E-Mail gesucht werden. Fehlende Personen werden mit explizit eingegebenem Vor- und Nachnamen vorbereitet. Status, Standort und mindestens ein Bereich werden aus den Stammdaten gewählt. Von der Installation geforderte Datenschutzangaben werden erfasst; Zustimmung wird weder aus einer Antwort abgeleitet noch automatisch gesetzt. Personen werden ohne `force` angelegt; serverseitige Dublettenprüfungen bleiben wirksam. Bestehende Personendaten bleiben unverändert.
4. Mehrere Antworten für dieselbe Person müssen durch Auswahl eines Eintrags und Überspringen der übrigen aufgelöst werden. Es gibt in dieser Version keine automatische Zusammenführung.
5. Die Vorschau zeigt Gruppe, Rolle, neue Personen samt Vorgaben, automatisch geplante Felder und alle Mitgliedswerte. Separate Felddialoge entfallen.
6. Nach Bestätigung werden Quelle und Personen erneut geprüft. Danach werden neue Personen, eine neue Gruppe mit Beschreibung, die Mitgliedsfelder und schließlich Mitgliedschaften inklusive Werten angelegt. Die neuen Mitgliedschaften sind aktiv, Benachrichtigungen an Gruppenleiter sind für diese Aktion ausgeschaltet.

Eine neue Gruppe erhält eingeschränkte Sichtbarkeit. Die Mitgliedsfelder werden mit Sicherheitsstufe 1 angelegt und nicht in einem Anmeldeformular verwendet. Bestehende Rechte in ChurchTools bestimmen weiterhin den tatsächlichen Zugriff; die Extension erteilt keine Berechtigungen.

## Automatische Felder

| Umfragetyp / Inhalt                          | Gruppenmitgliedsfeld                                                 |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Einfachauswahl                               | `select` mit den Umfrageoptionen                                     |
| Mehrfachauswahl / Terminfindung              | `multiselect` bzw. der konfigurierte Auswahlmodus                    |
| Material mit Mengen (`max-options-multiple`) | Ein `number`-Feld pro Option                                         |
| Kommentare                                   | `textarea`, wenn aktiviert oder bei übertragenen Antworten vorhanden |
| Material-/Kapazitätsumfragen                 | Zusätzliches `select`-Feld für Reserviert/Ausgegeben                 |

Archivierte Optionen bleiben erhalten. Feldnamen werden nummeriert, um Kollisionen und Längenüberschreitungen zu vermeiden. Gleich benannte Auswahlwerte erhalten bei Bedarf einen Zusatz. Quell-Options-IDs werden über die eindeutigen vorbereiteten Beschriftungen auf die vom Backend zugewiesenen Options-IDs abgebildet; Quell-IDs werden nicht als ChurchTools-Options-IDs verwendet. Alle zurückgelieferten Zuordnungen werden vor der ersten Mitgliedschaft validiert. Kommentare über 4.000 Zeichen blockieren die Vorbereitung, statt still gekürzt zu werden.

## API und Grenzen

Verwendete REST-Endpunkte (über den vorhandenen ChurchTools Client):

- `GET /person/masterdata`, `GET /config`
- `GET /persons` mit paginierter Suche, `GET /persons/{id}`, `POST /persons`
- `POST /groups`, `GET /groups/{groupId}`
- `POST /groups/{groupId}/memberfields/group`
- `PUT /groups/{groupId}/members/{personId}` mit `fields` nach numerischer Mitgliedsfeld-ID, `only_add: true`

Die [ChurchTools-OpenAPI-Spezifikation](https://demo.church.tools/system/runtime/swagger/openapi.json) wurde für die Verträge geprüft. Die REST-Gruppenanlage bietet kein Beschreibungsfeld, und das aktuelle Gruppen-PATCH kann `information.note` ebenfalls nicht schreiben. Deshalb wird ausschließlich für die Beschreibung der vom ChurchTools-Editor verwendete Legacy-Aufruf `churchdb / f_group` mit `id` und `notiz` genutzt. Der öffentliche `GroupInfos`-Frontend-Code der Demo wurde dafür am 06.11.2026 gelesen. Anschließend wird die Beschreibung über REST zurückgelesen und auf Übereinstimmung geprüft. Auch dieser Schritt kann bei fehlenden Rechten fehlschlagen.

Ein Lauf hält bei einem Fehler an. Bestätigte Personen-, Gruppen-, Feld- und Mitgliedschafts-IDs bleiben während der Ansicht sichtbar. Der fehlgeschlagene Aufruf kann trotz fehlender Antwort angekommen sein. Es gibt keinen automatischen erneuten Versuch und keine automatische Löschung angelegter Daten. Vor einem neuen Lauf muss der Bestand in ChurchTools manuell geprüft werden; eine weitere Ausführung erzeugt eine weitere Gruppe.

Der Übertragungsplan und sein Fortschritt werden in dieser Version nur im Arbeitsspeicher gehalten. Die Umfrage und ihre Antworten werden beim Übertragen nicht verändert. Laufende Schreibvorgänge sperren Tabs und Seitennavigation innerhalb der Anwendung; ein erzwungenes Schließen des Browsers kann den Lauf dennoch abbrechen.

## Verifikation

Automatisierte Tests decken unter anderem alle Umfragetypen, archivierte Optionen, Pflichtangaben, Dubletten innerhalb der Übernahme, zurückgelieferte Options-IDs, geänderte Quelldaten, Fehler und Teilschritte ab. Komponententests prüfen die ausdrückliche E-Mail-Zuordnung sowie die Grenze zwischen Vorschau und schreibender Übertragung. API-Schreibtests verwenden Mocks; ein Integrationstest auf einer echten ChurchTools-Installation ist vor produktiver Verwendung noch erforderlich.

Siehe [Backlog](backlog.md) für die bewusst zurückgestellten Erweiterungen.
