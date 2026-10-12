import { describe, expect, it } from 'vitest';
import { decodeId, encodeId } from '../src/utils/tokenHelper';
import { optionCount, validateEntry, validateSurvey } from '../src/utils/validation';
import type { SurveyEntry, SurveyEntryNew, SurveyNew } from '../src/utils/types';
const survey = (overrides: Partial<SurveyNew> = {}): SurveyNew => ({
    name: 'Umfrage',
    type: 'max-options-multiple',
    isActive: true,
    fields: [
        {
            key: 'options',
            fieldTypeCode: 'multiselect',
            options: [
                { id: 'a', nameTranslated: 'A', maxCount: 5 },
                { id: 'b', nameTranslated: 'B', maxCount: 2, maxSelectable: 1 },
            ],
        },
    ],
    ...overrides,
});
const entry = (data: SurveyEntryNew['data'] = { a: 1 }): SurveyEntryNew => ({ name: 'Teilnehmer', data });
const stored = (data: SurveyEntryNew['data']): SurveyEntry => ({
    ...entry(data),
    name: 'Vorhanden',
    id: 1,
    dataCategoryId: 10,
    status: 'new',
    meta: { createdDate: '2026-10-01T10:00:00Z' },
});
describe('Teilnahme und Kapazitäten', () => {
    it('prüft jede Mengenoption und bereits reservierte Kapazität', () => {
        expect(() => validateEntry(survey(), entry({ a: 1, b: 1 }), [stored({ b: 2 })])).toThrow('nicht mehr genügend');
        expect(() => validateEntry(survey(), entry({ a: 4 }), [stored({ a: 1 })])).not.toThrow();
        expect(() => validateEntry(survey(), entry({ a: 5 }), [stored({ a: 1 })])).toThrow('nicht mehr genügend');
    });
    it('erhält die bisherige Bedeutung von Null-Grenzen als unbegrenzt', () => {
        const s = survey({
            fields: [
                {
                    key: 'options',
                    fieldTypeCode: 'multiselect',
                    options: [{ id: 'a', nameTranslated: 'A', maxCount: 0, maxSelectable: 0 }],
                },
            ],
        });
        expect(() => validateEntry(s, entry({ a: 20 }), [stored({ a: 10 })])).not.toThrow();
        expect(() =>
            validateEntry({ ...s, type: 'max-options' }, entry({ options: ['a'] }), [stored({ options: ['a'] })]),
        ).not.toThrow();
    });
    it('verhindert negative, gebrochene, leere oder unbekannte Mengen', () => {
        for (const data of [{ a: -1 }, { a: 1.2 }, { a: 0 }, { unknown: 1 }, { a: Number.NaN }])
            expect(() => validateEntry(survey(), entry(data), [])).toThrow();
        expect(() => validateEntry(survey(), entry({ b: 2 }), [])).toThrow('pro Person');
    });
    it('prüft die Kapazität normaler Auswahloptionen und normalisiert Altwerte', () => {
        const s = survey({ type: 'max-options' });
        const e = stored({ options: ['b'] });
        expect(optionCount(s, [e, e], s.fields[0].options[1])).toBe(2);
        expect(() => validateEntry(s, entry({ options: ['b'] }), [e, e])).toThrow('ausgebucht');
        expect(() => validateEntry(s, entry({ options: ['a'] }), [e])).not.toThrow();
    });
    it('weist ungültige, doppelte und mehrfache Einzelauswahl zurück', () => {
        const s = survey({ type: 'best-option', fields: [{ ...survey().fields[0], fieldTypeCode: 'select' }] });
        for (const values of [[], ['a', 'b'], ['a', 'a'], ['missing']])
            expect(() => validateEntry(s, entry({ options: values }), [])).toThrow();
        expect(() => validateEntry(s, entry({ options: ['a'] }), [])).not.toThrow();
    });
    it('prüft Namensduplikate mit Leerzeichen und Großschreibung', () => {
        expect(() => validateEntry(survey(), { ...entry(), name: ' VORHANDEN ' }, [stored({ a: 1 })])).toThrow(
            'bereits',
        );
    });
    it('prüft die aktuelle Öffnungszeit unmittelbar vor Speicherung', () => {
        const now = new Date('2026-10-11T10:00:00Z');
        for (const changes of [
            { isActive: false },
            { startDate: '2026-10-12T10:00:00Z' },
            { endDate: now.toISOString() },
        ])
            expect(() => validateEntry(survey(changes), entry(), [], now)).toThrow('geschlossen');
    });
    it('prüft Pflicht-E-Mail und eindeutige Optionen sowie Terminreihenfolge', () => {
        expect(() => validateEntry(survey({ askForMail: true }), entry(), [])).toThrow('E-Mail');
        expect(() => validateSurvey(survey({ startDate: '2026-10-12', endDate: '2026-10-11' }))).toThrow(
            'Schließdatum',
        );
        expect(() =>
            validateSurvey(
                survey({
                    fields: [
                        {
                            key: 'options',
                            fieldTypeCode: 'select',
                            options: [survey().fields[0].options[0], survey().fields[0].options[0]],
                        },
                    ],
                }),
            ),
        ).toThrow('eindeutige');
    });
});
describe('Bestehende Teilnahmelinks', () => {
    it('liest bestehende und neu generierte Tokens', () => {
        for (const id of [1, 30, 9000]) {
            expect(decodeId(encodeId(id))).toBe(id);
            expect(decodeId(btoa(`${id ^ 0x12345}_legacy_timestamp`).replace(/[+=/]/g, ''))).toBe(id);
        }
        expect(decodeId('!invalid!')).toBeNull();
    });
});
