# ChurchTools Extension Survey

Umfragen für ChurchTools: Terminfindung, Abstimmungen, Optionen mit begrenzter Kapazität und Materialausgabe mit Mengen pro Teilnehmer. Die Oberfläche verwendet Vue 3, Nuxt UI 4 und Tailwind CSS 4; API-Zugriffe erfolgen über den öffentlichen ChurchTools Client und TanStack Vue Query.

## Entwicklung

Node.js 22.13+ oder 24 und npm verwenden. Alle Dependencies sind in der öffentlichen npm-Registry verfügbar. Es werden keine privaten ChurchTools-Packages, Registry-Zugangsdaten oder benachbarten Repositories benötigt.

```sh
npm ci
cp .env-example .env
npm run dev
```

In `.env` den Extension-Key (`VITE_KEY`, standardmäßig `survey`) und die ChurchTools-Instanz (`VITE_BASE_URL`) setzen. Optional können `VITE_USERNAME` und `VITE_PASSWORD` für den lokalen Entwicklungslogin eingetragen werden. In ChurchTools muss CORS für den lokalen Entwicklungsserver erlaubt sein. In der installierten Extension wird `window.settings.base_url` verwendet und die bestehende ChurchTools-Sitzung genutzt.

## Funktionen

- Umfragen erstellen, bearbeiten, duplizieren, sortieren und mit Bestätigung löschen.
- Öffnungs- und Schließtermine planen, deaktivieren und wieder öffnen.
- Namen, E-Mail-Abfrage, Kommentare, Bild und öffentliche Listung konfigurieren.
- Einzel- und Mehrfachauswahl, Mengenobergrenzen und Limits pro Teilnehmer.
- Getrennte Ansichten für Ergebnisse, Einträge, Einstellungen und Sitzungsverlauf.
- Ergebnisranglisten mit Stimmen, Prozenten und Kapazitäten; CSV-Export für Tabellenprogramme.
- Teilnahmelink kopieren, QR-Code anzeigen und herunterladen.
- Teilnehmer nach Name, E-Mail, Option oder Status filtern; Einträge bearbeiten, löschen und gemeinsam umstellen.
- Optionen sortieren und archivieren, ohne bestehende Antworten zu verlieren.
- Ungespeicherte Entwürfe markieren, Navigation absichern und Änderungen während Schreibvorgängen sperren.
- Eigene Teilnahme für angemeldete Personen mit vorhandenen API-Rechten bearbeiten oder stornieren.
- Die letzten 20 Änderungen der Browser-Sitzung mit Konfliktprüfung rückgängig machen.
- Bei Materialausgaben die Zustände „Neu“, „Ausgegeben“ und „Zurückgebracht“ verwalten und Mengensummen anzeigen.

Verwaltungsaktionen berücksichtigen die von `/permissions/global` gelieferten modul- und kategoriespezifischen Rechte. Die API erzwingt die tatsächlichen Berechtigungen. Die Einstellung „Teilnehmerdaten verbergen“ blendet Namen, Stimmen und Kommentare in der Teilnehmeroberfläche aus; API-Rechte müssen gesondert in ChurchTools gesetzt werden.

Teilnahmelinks bleiben kompatibel. Gespeicherte Umfragen und Einträge werden zur Laufzeit geprüft. Fehlerhafte Datensätze erscheinen als Diagnose; gültige Umfragen bleiben nutzbar. Es findet keine automatische Datenmigration statt. Neue Umfrage-JSONs tragen `schemaVersion: 1`. Die alten, deaktivierten Gruppenübertragungs-Experimente mit fest eingebauten Gruppen- und Feld-IDs wurden entfernt.

Rückgaben/Stornierungen geben belegte Kapazität wieder frei. Beim Bearbeiten wird der bisherige Eintrag aus dem belegten Bestand herausgerechnet. Bestehende Optionen werden archiviert statt entfernt.

Die Kategorie-API erlaubt höchstens 100 Zeichen im Namen, 300 in der internen Beschreibung und 2.000 im gesamten Umfrage-JSON; Einträge erlauben 10.000 Zeichen. Der Editor zeigt das Budget und prüft die serialisierte Payload.

Beim Absenden werden Umfragezustand und Einträge frisch geladen und jede gewählte Option geprüft. Gleichzeitige Schreibzugriffe verschiedener Browser können ohne atomare Reservierung in der ChurchTools-API weiterhin miteinander konkurrieren.

## Qualität und Build

```sh
npm run check          # TypeScript, ESLint, Tests und Produktionsbuild
npm run package:verify
npm run deploy        # Build und lokales ZIP; lädt nichts hoch
```

Release-Namen enthalten Paketversion, Git-Revision und einen Hash des Build-Inhalts. Das ZIP unter `releases/` enthält `dist/` für die Installation in ChurchTools. Die Paketprüfung kontrolliert private Package-Referenzen, unerwartete Dateien und die versehentliche Aufnahme lokaler Entwicklungs-Zugangsdaten.

TypeScript 6 wird verwendet, weil der aktuelle `typescript-eslint`-Parser TypeScript 7 noch nicht unterstützt. Die übrigen direkten Dependencies wurden auf aktuelle Versionen aktualisiert.

Nuxt UI wird über den [Vue/Vite-Integrationsweg](https://ui.nuxt.com/docs/getting-started/installation/vue) eingebunden. Die [LLM-Dokumentation](https://ui.nuxt.com/llms.txt) enthält die Komponentenreferenz. Tailwind-Utilities und Nuxt-UI-Klassen tragen das Präfix `survey:`, und es wird kein globaler CSS-Reset in die ChurchTools-Oberfläche eingebracht. Lucide-Icons werden lokal gebündelt.

## API

Die Extension verwendet `/custommodules/{key}`, die Kategorien unter `/custommodules/{moduleId}/customdatacategories` und die Werte unter `/custommodules/{moduleId}/customdatacategories/{categoryId}/customdatavalues`. Survey-Metadaten liegen als JSON in `data`, Einträge als JSON in `value`.

Die Umsetzung des Audits ist in [docs/frontend-improvements-2026-10-11.md](docs/frontend-improvements-2026-10-11.md) dokumentiert. Der Sitzungsverlauf liegt in `sessionStorage`, getrennt nach ChurchTools-Konto, und ist kein zentraler Audit-Log.

## UX-/UI-Überarbeitung 0.2.0

Interner Entwurfsschutz, bestätigte Mehrfachaktionen, erhaltene Filter, bessere mobile Navigation und Kontraste sowie sichtbare archivierte eigene Auswahl. Dazu kommen aggregierter Ergebnisexport, Terminmatrix, Entwurfs-Testansicht, Antwortbestätigung und Vorher-/Nachher-Verlauf.

[Umsetzung und Verifikation](docs/ux-fixes-2026-10-12/README.md).

## Formular-Design 0.2.1

Waldgrün und Lime, große Auswahlkarten und Eingaben, Auswahl vor Kontaktdaten sowie eine laufende Antwortzusammenfassung. Übersicht, Detailkopf, Editor und Vorschau greifen dieselbe Gestaltung auf.

[Designänderungen, Livechecks und Screenshots](docs/design-2026-10-12/README.md).

Die Korrekturen aus dem Browserfeedback, einschließlich vollständiger CSS-Isolation und deaktiviertem globalen Dark Mode, sind in [UI-Feedback 0.2.2](docs/ui-feedback-2026-10-12/README.md) dokumentiert.

Kompakte transparente Eingaben, automatische initiale Sortierreihenfolge, Schließen im Kartenmenü und direkt korrigierbare Datenfehler sind in [Editor-Feedback 0.2.3](docs/editor-feedback-2026-10-12/README.md) dokumentiert.

Die weiteren Anpassungen an Tabs, Eintragsaktionen, Dialogen und Editor-Aktionsgruppen stehen in [Detail-Feedback 0.2.4](docs/detail-feedback-2026-10-12/README.md).

Weiße Übersichtssuche, Statusplatzierung, kompakte Optionszeilen und Speicherplatz im Sticky-Footer: [Layout-Feedback 0.2.5](docs/spacing-feedback-2026-10-12/README.md). Die Entwurfsvorschau wurde auf Wunsch entfernt.

Vollständig klickbare Optionskarten, kompakte Teilnehmerlisten und angepasste Abschnittsüberschriften: [Teilnehmerformular 0.2.6](docs/participant-feedback-2026-10-12/README.md).
