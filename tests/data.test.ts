import { flushPromises, mount } from '@vue/test-utils';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { defineComponent, h, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { queryClient } from '../src/data/queryClient';
import { useSurvey } from '../src/composables/useSurvey';
import { useSurveys } from '../src/composables/useSurveys';
import { confirmOpen, resolveConfirm } from '../src/composables/useConfirm';
import { permissionAllowed } from '../src/composables/usePlatform';
import { decode, readSurvey } from '../src/data/ccm';
vi.mock('@churchtools/churchtools-client', () => ({
    churchtoolsClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), deleteApi: vi.fn() },
}));
const row = (id: number, hidden = false) => ({
    id,
    customModuleId: 7,
    name: `Umfrage ${id}`,
    shorty: `survey_${id}`,
    description: 'Intern',
    data: JSON.stringify({
        type: 'best-option',
        fields: [{ key: 'options', fieldTypeCode: 'select', options: [{ id: 'a', nameTranslated: 'A' }] }],
        hideDataFromParticipants: hidden,
        meta: { createdDate: '2026-10-01' },
    }),
});
const wrappers: ReturnType<typeof mount>[] = [];
function composable<T>(setup: () => T): T {
    let result!: T;
    const wrapper = mount(
        defineComponent({
            setup: () => {
                result = setup();
                return () => h('div');
            },
        }),
        { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
    );
    wrappers.push(wrapper);
    return result;
}
beforeEach(() => {
    queryClient.clear();
    vi.mocked(churchtoolsClient.get).mockImplementation(async (path: string) => {
        if (path === '/custommodules/survey') return { id: 7 };
        if (path.endsWith('/customdatacategories')) return [row(10, true), row(11, true)];
        if (path.endsWith('/customdatavalues'))
            return [
                {
                    id: 99,
                    dataCategoryId: 10,
                    value: JSON.stringify({
                        name: 'Test',
                        data: { options: ['a'] },
                        meta: { createdDate: '2026-10-01' },
                    }),
                },
            ];
        throw new Error(`Unsupported API endpoint: ${path}`);
    });
});
afterEach(() => {
    wrappers.splice(0).forEach(w => w.unmount());
    resolveConfirm(false);
    queryClient.clear();
});
async function ready() {
    await flushPromises();
    await new Promise(resolve => setTimeout(resolve, 30));
    await flushPromises();
}
describe('Öffentlicher Datenzugriff', () => {
    it('benennt bei leeren oder unvollständigen Umfragen die fehlenden Datenfelder', () => {
        expect(() => readSurvey({ ...row(10), data: '' })).toThrow('„data“ ist leer');
        expect(() => readSurvey({ ...row(10), data: '{}' })).toThrow('„type“');
        expect(() => readSurvey({ ...row(10), data: '{"type":"best-option"}' })).toThrow('„fields“');
    });
    it('legt neue Umfragen hinter dem aktuellen Maximum plus eins an', async () => {
        const state = composable(useSurveys);
        await ready();
        const first = row(10);
        first.data = JSON.stringify({ ...JSON.parse(first.data), sortKey: 8 });
        vi.mocked(churchtoolsClient.get).mockResolvedValue([first, row(11)]);
        await state.createSurvey({
            name: 'Neu',
            type: 'best-option',
            fields: [{ key: 'options', fieldTypeCode: 'select', options: [{ id: 'a', nameTranslated: 'A' }] }],
        });
        const body = vi.mocked(churchtoolsClient.post).mock.calls[0]![1] as { data: string };
        expect(JSON.parse(body.data).sortKey).toBe(9);
    });
    it('repariert Daten mit vorhandenen passenden Antworten unter derselben Kategorie', async () => {
        const state = composable(useSurveys);
        await ready();
        const broken = { ...row(10), data: '{}' };
        vi.mocked(churchtoolsClient.get).mockImplementation(async path =>
            path.endsWith('/customdatavalues')
                ? [{ id: 99, dataCategoryId: 10, value: '{"name":"Alt","data":{"options":["a"]}}' }]
                : [broken],
        );
        await state.repairSurvey(broken, row(10).data);
        expect(churchtoolsClient.put).toHaveBeenCalledWith(
            '/custommodules/7/customdatacategories/10',
            expect.objectContaining({ id: 10, shorty: 'survey_10' }),
        );
        expect(churchtoolsClient.deleteApi).not.toHaveBeenCalled();
    });
    it('berechnet die nächste Position auch bei ausschließlich negativen Sortierwerten', async () => {
        const state = composable(useSurveys);
        await ready();
        const existing = row(10);
        existing.data = JSON.stringify({ ...JSON.parse(existing.data), sortKey: -8 });
        vi.mocked(churchtoolsClient.get).mockResolvedValue([existing]);
        await state.createSurvey({
            name: 'Neu',
            type: 'best-option',
            fields: [{ key: 'options', fieldTypeCode: 'select', options: [{ id: 'a', nameTranslated: 'A' }] }],
        });
        const body = vi.mocked(churchtoolsClient.post).mock.calls[0]![1] as { data: string };
        expect(JSON.parse(body.data).sortKey).toBe(-7);
    });
    it('verhindert eine Korrektur mit unbekannten Optionsbezügen vorhandener Antworten', async () => {
        const state = composable(useSurveys);
        await ready();
        const broken = { ...row(10), data: '{}' };
        vi.mocked(churchtoolsClient.get).mockImplementation(async path =>
            path.endsWith('/customdatavalues')
                ? [{ id: 99, dataCategoryId: 10, value: '{"name":"Alt","data":{"options":["missing"]}}' }]
                : [broken],
        );
        await expect(state.repairSurvey(broken, row(10).data)).rejects.toThrow('vorhandenen Antworten');
        expect(churchtoolsClient.put).not.toHaveBeenCalled();
    });
    it('überschreibt bei einer Korrektur keinen inzwischen geänderten Rohdatenstand', async () => {
        const state = composable(useSurveys);
        await ready();
        await expect(state.repairSurvey({ ...row(10), data: '{}' }, row(10).data)).rejects.toThrow(
            'inzwischen geändert',
        );
        expect(churchtoolsClient.put).not.toHaveBeenCalled();
    });
    it('bewahrt API-Metadaten beim Lesen alter JSON-Daten', () => {
        expect(decode<{ id: number; name: string }>(' {"id": 123, "name": "Alt"} ', { id: 5 }).id).toBe(5);
        expect(() => decode('[]', {})).toThrow();
        expect(() => decode('{bad', {})).toThrow();
    });
    it('lädt Umfragen reaktiv nach Routewechsel und ruft versteckte Daten nicht ab', async () => {
        const id = ref<number | null>(10);
        const state = composable(() => useSurvey(id));
        await ready();
        expect(state.survey.value?.id).toBe(10);
        expect(vi.mocked(churchtoolsClient.get).mock.calls.some(([path]) => path.endsWith('/customdatavalues'))).toBe(
            false,
        );
        id.value = 11;
        await ready();
        expect(state.survey.value?.id).toBe(11);
        id.value = null;
        await ready();
        expect(state.survey.value).toBeUndefined();
        expect(vi.mocked(churchtoolsClient.get).mock.calls.some(([path]) => path.includes('/null'))).toBe(false);
    });
    it('verwendet für Detaildaten nur den vom Backend angebotenen Listen-Endpunkt', async () => {
        const state = composable(() => useSurvey(ref(10)));
        await ready();
        expect(state.survey.value?.id).toBe(10);
        expect(churchtoolsClient.get).toHaveBeenCalledWith('/custommodules/7/customdatacategories');
        expect(
            vi.mocked(churchtoolsClient.get).mock.calls.some(([path]) => /customdatacategories\/\d+$/.test(path)),
        ).toBe(false);
    });
    it('behält beim Löschen die Kategorie vom Beginn der Bestätigung bei', async () => {
        const id = ref(10);
        const state = composable(() => useSurvey(id));
        await ready();
        const deletion = state.deleteSurveyEntry(99);
        id.value = 11;
        resolveConfirm(true);
        await deletion;
        expect(churchtoolsClient.deleteApi).toHaveBeenCalledWith(
            '/custommodules/7/customdatacategories/10/customdatavalues/99',
        );
    });
    it('lädt sichtbare Einträge erst nach dem Laden der Umfrage', async () => {
        vi.mocked(churchtoolsClient.get).mockImplementation(async (path: string) => {
            if (path === '/custommodules/survey') return { id: 7 };
            if (path.endsWith('/customdatavalues'))
                return [{ id: 99, dataCategoryId: 10, value: '{"name":"Alt","data":{"options":["a"]}}' }];
            if (path.endsWith('/customdatacategories')) return [row(10, false)];
            throw new Error(`Unsupported API endpoint: ${path}`);
        });
        const state = composable(() => useSurvey(ref(10)));
        await ready();
        await ready();
        expect(state.surveyEntries.value[0]?.id).toBe(99);
    });
    it('löscht nach Abbruch weder Umfragen noch Einträge', async () => {
        const surveys = composable(useSurveys);
        const survey = composable(() => useSurvey(ref(10)));
        await ready();
        const categoryDeletion = surveys.deleteSurvey(10);
        expect(confirmOpen.value).toBe(true);
        resolveConfirm(false);
        await categoryDeletion;
        const entryDeletion = survey.deleteSurveyEntry(99);
        resolveConfirm(false);
        await entryDeletion;
        expect(churchtoolsClient.deleteApi).not.toHaveBeenCalled();
        const confirmed = survey.deleteSurveyEntry(99);
        resolveConfirm(true);
        await confirmed;
        expect(churchtoolsClient.deleteApi).toHaveBeenCalledWith(
            '/custommodules/7/customdatacategories/10/customdatavalues/99',
        );
    });
    it('mischt Statusänderungen mit frisch geladenen Daten statt einem veralteten Cache', async () => {
        const state = composable(useSurveys);
        await ready();
        vi.mocked(churchtoolsClient.get).mockImplementation(async (path: string) => {
            if (path.endsWith('/customdatacategories')) return [{ ...row(10), name: 'Frischer Name' }];
            throw new Error(`Unsupported endpoint: ${path}`);
        });
        await state.updateSurvey({ id: 10, isListed: true });
        expect(vi.mocked(churchtoolsClient.put).mock.calls[0]![1]).toMatchObject({ name: 'Frischer Name' });
    });
    it('weist einen veralteten expliziten Editorstand ohne Schreiben zurück', async () => {
        const state = composable(useSurveys);
        await ready();
        const original = state.surveys.value[0]!;
        vi.mocked(churchtoolsClient.get).mockResolvedValue([{ ...row(10), name: 'Fremde Änderung' }]);
        await expect(state.updateSurvey({ ...original, name: 'Mein Entwurf' }, original)).rejects.toThrow('inzwischen');
        expect(churchtoolsClient.put).not.toHaveBeenCalled();
    });
    it('wartet auf Schreiboperationen und erhält vorhandene Survey-Felder', async () => {
        const state = composable(useSurveys);
        await ready();
        let finish!: () => void;
        vi.mocked(churchtoolsClient.put).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finish = () => resolve({});
                }),
        );
        let completed = false;
        const saving = state.updateSurvey({ id: 10, isListed: true }).then(() => {
            completed = true;
        });
        await flushPromises();
        expect(completed).toBe(false);
        const [path, body] = vi.mocked(churchtoolsClient.put).mock.calls[0];
        expect(path).toBe('/custommodules/7/customdatacategories/10');
        expect(body).toMatchObject({
            id: 10,
            name: 'Umfrage 10',
            description: 'Intern',
            shorty: 'survey_10',
            customModuleId: 7,
        });
        expect(JSON.parse((body as { data: string }).data)).toMatchObject({
            isListed: true,
            type: 'best-option',
            fields: [{ key: 'options' }],
        });
        finish();
        await saving;
        expect(completed).toBe(true);
    });
});
describe('Berechtigungen', () => {
    it('beachtet kategorienspezifische Rechte, globale Rechte und fehlende Rechte', () => {
        expect(permissionAllowed({ survey: { edit: [10] } }, 'edit', 10)).toBe(true);
        expect(permissionAllowed({ survey: { edit: [10] } }, 'edit', 11)).toBe(false);
        expect(permissionAllowed({ survey: { edit: [-1] } }, 'edit', 11)).toBe(true);
        expect(permissionAllowed({ survey: { create: true } }, 'create')).toBe(true);
        expect(permissionAllowed(undefined, 'edit', 10)).toBe(false);
    });
});
