import { describe, it, expect, vi } from 'vitest';
import { readSurvey, readEntry, fetchCatalog, fetchEntryCatalog } from '../src/data/ccm';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { optionCount, validateEntry, validateSurvey } from '../src/utils/validation';
import { surveyCsv } from '../src/utils/export';
import { surveyPayload, payloadError, fingerprint } from '../src/utils/serialization';
import type { Survey, SurveyEntry } from '../src/utils/types';
vi.mock('@churchtools/churchtools-client', () => ({ churchtoolsClient: { get: vi.fn() } }));
const survey: Survey = {
    id: 10,
    customModuleId: 7,
    shorty: 'survey_test',
    name: 'Test',
    isActive: true,
    type: 'max-options-multiple',
    fields: [
        {
            key: 'options',
            fieldTypeCode: 'multiselect',
            options: [
                { id: 'a', nameTranslated: 'A', maxCount: 2, maxSelectable: 1 },
                { id: 'b', nameTranslated: 'B', archived: true },
            ],
        },
    ],
    meta: { createdDate: '2026-10-11T08:00:00Z' },
};
const entry: SurveyEntry = {
    id: 1,
    dataCategoryId: 10,
    name: 'Vorhanden',
    data: { a: 1 },
    status: 'new',
    meta: { createdDate: '2026-10-11T08:00:00Z' },
};
function row(value: Survey) {
    return { ...surveyPayload(value), id: value.id, shorty: value.shorty, customModuleId: value.customModuleId };
}
describe('Rückgaben, Bearbeitung und Archivierung', () => {
    it('gibt Kapazität bei Rückgaben für Mengen und normale Auswahl frei', () => {
        expect(optionCount(survey, [entry, { ...entry, status: 'cancelled' }], survey.fields[0]!.options[0]!)).toBe(1);
        const single = { ...survey, type: 'max-options' as const };
        expect(
            optionCount(
                single,
                [{ ...entry, data: { options: ['a'] }, status: 'cancelled' }],
                single.fields[0]!.options[0]!,
            ),
        ).toBe(0);
        expect(() =>
            validateEntry(survey, { name: entry.name, data: { a: 1 } }, [{ ...entry, status: 'cancelled' }]),
        ).not.toThrow();
    });
    it('prüft Personen- und Bestandsgrenzen auch bei administrativen Änderungen', () => {
        expect(() => validateEntry(survey, { name: 'Neu', data: { a: 2 } }, [], new Date(), 'admin')).toThrow(
            'pro Person',
        );
        expect(() =>
            validateEntry(survey, { name: 'Neu', data: { a: 1 } }, [{ ...entry, data: { a: 2 } }], new Date(), 'admin'),
        ).toThrow('nicht mehr genügend');
        expect(() =>
            validateEntry({ ...survey, isActive: false }, { name: 'Neu', data: { a: 1 } }, [], new Date(), 'admin'),
        ).not.toThrow();
    });
    it('beachtet Schließzeiten bei eigenen Änderungen, lässt administrative Korrekturen zu', () => {
        expect(() =>
            validateEntry({ ...survey, isActive: false }, { name: 'Neu', data: { a: 1 } }, [], new Date(), 'edit'),
        ).toThrow('geschlossen');
        expect(() =>
            validateEntry({ ...survey, askForMail: true }, entry, [], new Date(), 'admin', true),
        ).not.toThrow();
    });
    it('erlaubt Rückgaben trotz inzwischen belegter Kapazität und behält historische Optionen', () => {
        expect(() =>
            validateEntry(survey, entry, [{ ...entry, name: 'Anderer', data: { a: 2 } }], new Date(), 'admin', true),
        ).not.toThrow();
        expect(() => validateEntry(survey, { name: 'Neu', data: { b: 1 } }, [])).toThrow('gültige');
        expect(() => validateEntry(survey, { name: 'Neu', data: { b: 1 } }, [], new Date(), 'admin')).not.toThrow();
        expect(() =>
            validateSurvey({
                ...survey,
                fields: [
                    {
                        ...survey.fields[0]!,
                        options: survey.fields[0]!.options.map(option => ({ ...option, archived: true })),
                    },
                ],
            }),
        ).toThrow('Option');
    });
});
describe('Backend-Vertrag und beschädigte Daten', () => {
    it('isoliert eine kaputte Umfrage statt die gesamte Liste zu verlieren', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValue([row(survey), { ...row(survey), id: 11, data: '{kaputt' }]);
        const result = await fetchCatalog(7);
        expect(result.surveys.map(item => item.id)).toEqual([10]);
        expect(result.issues[0]?.id).toBe(11);
    });
    it('diagnostiziert Einträge mit verwaisten Optionen statt falsche Kapazitäten zu berechnen', async () => {
        vi.mocked(churchtoolsClient.get).mockResolvedValue([
            { id: 1, dataCategoryId: 10, value: JSON.stringify({ ...entry, data: { missing: 2 } }) },
        ]);
        const result = await fetchEntryCatalog(7, 10, survey);
        expect(result.entries).toEqual([]);
        expect(result.issues[0]?.message).toContain('unbekannte');
    });
    it('weist unbekannte Typen, falsche Versionen und falsche Datentypen zurück', () => {
        for (const value of [
            {},
            { ...survey, type: 'wrong' },
            { ...survey, schemaVersion: 2 },
            { ...survey, fields: null },
            { ...survey, isActive: 'ja' },
            { ...survey, sortKey: 'abc' },
        ])
            expect(() => readSurvey({ ...row(survey), data: JSON.stringify(value) })).toThrow();
        expect(() => readEntry({ id: 1, dataCategoryId: 10, value: '{"name":"Test","data":{"a":"2"}}' })).toThrow();
        expect(() =>
            readEntry({ id: 1, dataCategoryId: 10, value: '{"name":"Test","data":{"a":2},"meta":{"createdDate":{}}}' }),
        ).toThrow();
    });
    it('beachtet das gesamte 2.000-Zeichen-Budget einschließlich Metadaten', () => {
        expect(payloadError({ ...survey, surveyDescription: 'x'.repeat(2100) })).toContain('2.000');
        expect(payloadError({ ...survey, name: 'x'.repeat(101) })).toContain('100');
        expect(payloadError({ ...survey, description: 'x'.repeat(301) })).toContain('300');
        expect(payloadError(survey)).toBeUndefined();
    });
    it('vergleicht Inhalte unabhängig von Schlüsselreihenfolgen', () => {
        expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
        expect(fingerprint(undefined)).toBe('undefined');
    });
});
describe('CSV für Tabellenprogramme', () => {
    it('exportiert Status, archivierte Optionen, Mengen und mehrzeilige Kommentare', () => {
        const csv = surveyCsv(survey, [
            {
                ...entry,
                name: '=HYPERLINK("x")',
                email: '@example',
                status: 'cancelled',
                data: { a: 1, b: 2 },
                comments: [{ comment: 'Zeile 1\nZeile "2"', createdDate: '' }],
            },
        ]);
        expect(csv).toContain('B (archiviert)');
        expect(csv).toContain('Zurückgebracht / storniert');
        expect(csv).toContain("'=HYPERLINK");
        expect(csv).toContain("'@example");
        expect(csv).toContain('Zeile ""2""');
        expect(csv.startsWith('\ufeff')).toBe(true);
    });
});
