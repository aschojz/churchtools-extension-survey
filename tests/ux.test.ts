import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, nextTick } from 'vue';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import OwnParticipation from '../src/form/OwnParticipation.vue';
import SurveyEntries from '../src/survey/SurveyEntries.vue';
import SurveyResults from '../src/survey/SurveyResults.vue';
import { changeDetails } from '../src/utils/changeDetails';
import type { Change } from '../src/data/history';
import type { Ref } from 'vue';
import SurveySelection from '../src/form/SurveySelection.vue';
import { resultsCsv } from '../src/utils/export';
import type { Survey, SurveyEntry } from '../src/utils/types';
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), update: vi.fn(), state: {} as Record<string, unknown> }));
vi.mock('../src/composables/useSurvey', () => ({ useSurvey: () => mocks.state }));
vi.mock('../src/composables/usePlatform', () => ({
    usePermissions: () => ({ allowed: () => true }),
    useCurrentUser: () => ({ data: ref({ id: 1 }) }),
}));
vi.mock('../src/composables/useConfirm', () => ({ confirmAction: mocks.confirm }));
vi.mock('../src/composables/useDraftGuard', () => ({ useDraftGuard: vi.fn() }));
vi.mock('../src/composables/useHelper', () => ({ useHelper: () => ({ surveyIsOpen: () => true }) }));
const survey: Survey = {
    id: 10,
    customModuleId: 4,
    shorty: 'survey_test',
    name: 'Test',
    type: 'max-options-multiple',
    isActive: true,
    meta: { createdDate: '' },
    fields: [
        {
            key: 'options',
            fieldTypeCode: 'multiselect',
            options: [
                { id: 'a', nameTranslated: 'A', maxCount: 10 },
                { id: 'b', nameTranslated: 'B', archived: true },
            ],
        },
    ],
};
const entries: SurveyEntry[] = [
    {
        id: 1,
        dataCategoryId: 10,
        name: 'Erste',
        personId: 1,
        data: { a: 1, b: 2 },
        status: 'new',
        meta: { createdDate: '' },
    },
    {
        id: 2,
        dataCategoryId: 10,
        name: 'Zweite',
        personId: 1,
        data: { a: 1 },
        status: 'new',
        meta: { createdDate: '' },
    },
];
const container = defineComponent({
    setup(_, { slots }) {
        return () => h('div', slots.default?.());
    },
});
const input = defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(props, { emit, attrs }) {
        return () =>
            h('input', {
                ...attrs,
                value: props.modelValue,
                onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
            });
    },
});
const checkbox = defineComponent({
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('input', {
                type: 'checkbox',
                'aria-label': props.label,
                checked: props.modelValue,
                onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
            });
    },
});
const button = defineComponent({
    setup(_, { slots, attrs }) {
        return () => h('button', attrs, slots.default?.());
    },
});
const stubs = {
    UCard: container,
    UForm: container,
    UFormField: defineComponent({
        props: ['label'],
        setup(props, { slots }) {
            return () => h('div', [h('label', String(props.label ?? '')), slots.default?.()]);
        },
    }),
    URadioGroup: true,
    UInput: input,
    UTextarea: input,
    UInputNumber: input,
    UButton: button,
    UCheckbox: checkbox,
    UBadge: container,
    UTooltip: container,
    USelect: true,
    UProgress: true,
    USwitch: checkbox,
    UModal: true,
    UAlert: true,
    SurveySelection: true,
};
const flush = async () => {
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    await nextTick();
};
beforeEach(() => {
    mocks.confirm.mockReset().mockResolvedValue(true);
    mocks.update.mockReset().mockResolvedValue(undefined);
    mocks.state = {
        survey: ref(structuredClone(survey)),
        surveyEntries: ref(structuredClone(entries)),
        entriesPending: ref(false),
        entriesIssues: ref([]),
        entriesError: ref(null),
        updateSurveyEntry: mocks.update,
    };
});
describe('Audit-Regressionsabläufe', () => {
    it('gibt jeder Checkbox ein eigenes Labelziel, auch bei mehreren Auswahlgruppen', () => {
        const choiceSurvey: Survey = {
            ...survey,
            type: 'best-option',
            fields: [
                {
                    key: 'options',
                    fieldTypeCode: 'multiselect',
                    options: [
                        { id: 'a', nameTranslated: 'A' },
                        { id: 'b', nameTranslated: 'B' },
                    ],
                },
            ],
        };
        const group = defineComponent({
            components: { SurveySelection },
            setup: () => ({ choiceSurvey }),
            template:
                '<div><SurveySelection :survey="choiceSurvey" :entries="[]" :model-value="{}" /><SurveySelection :survey="choiceSurvey" :entries="[]" :model-value="{}" /></div>',
        });
        const wrapper = mount(group, { global: { stubs: { ...stubs, SurveySelection: false } } });
        const ids = wrapper.findAll('input').map(input => input.attributes('id'));
        expect(ids).toHaveLength(4);
        expect(ids.every(Boolean)).toBe(true);
        expect(new Set(ids).size).toBe(4);
        wrapper.unmount();
    });
    it('erhält den eigenen Entwurf beim abgelehnten Wechsel und wechselt erst nach Bestätigung', async () => {
        const wrapper = mount(OwnParticipation, { props: { id: 10 }, global: { stubs } });
        await wrapper.find('[aria-label="Erste: bearbeiten"]').trigger('click');
        await flush();
        await wrapper.find('input').setValue('Ungespeichert');
        mocks.confirm.mockResolvedValueOnce(false);
        await wrapper.find('[aria-label="Zweite: bearbeiten"]').trigger('click');
        await flush();
        expect(wrapper.find('input').element.value).toBe('Ungespeichert');
        expect(mocks.confirm).toHaveBeenCalledOnce();
        await wrapper.find('[aria-label="Zweite: bearbeiten"]').trigger('click');
        await flush();
        expect(wrapper.find('input').element.value).toBe('Zweite');
        wrapper.unmount();
    });
    it('hebt Auswahl nach Suche auf und verändert keine zuvor ausgeblendete Antwort', async () => {
        const wrapper = mount(SurveyEntries, { props: { id: 10 }, global: { stubs } });
        await wrapper.find('input[aria-label="Erste auswählen"]').setValue(true);
        await wrapper.find('input[aria-label="Einträge durchsuchen"]').setValue('Zweite');
        expect(wrapper.text()).toContain('0 ausgewählt');
        const cancel = wrapper.findAll('button').find(button => button.text() === 'Zurücknehmen / stornieren')!;
        expect(cancel.attributes('disabled')).toBeDefined();
        expect(mocks.update).not.toHaveBeenCalled();
        wrapper.unmount();
    });
    it('bestätigt die sichtbaren Zielantworten vor einer Mehrfachänderung und respektiert Abbrechen', async () => {
        const wrapper = mount(SurveyEntries, { props: { id: 10 }, global: { stubs } });
        await wrapper.find('input[aria-label="Erste auswählen"]').setValue(true);
        mocks.confirm.mockResolvedValueOnce(false);
        const cancel = wrapper.findAll('button').find(button => button.text() === 'Zurücknehmen / stornieren')!;
        await cancel.trigger('click');
        await flush();
        expect(mocks.confirm).toHaveBeenLastCalledWith(expect.stringContaining('Betroffen: Erste'));
        expect(mocks.update).not.toHaveBeenCalled();
        await cancel.trigger('click');
        await flush();
        expect(mocks.update).toHaveBeenCalledOnce();
        expect(mocks.update.mock.calls[0]![0]).toMatchObject({ id: 1, status: 'cancelled' });
        wrapper.unmount();
    });
    it('zeigt nur bereits gewählte archivierte Mengen mit ihrer ursprünglichen Obergrenze', () => {
        const wrapper = mount(SurveySelection, {
            props: { survey, entries, modelValue: { a: 1, b: 2 }, originalData: { a: 1, b: 2 } },
            global: { stubs: { ...stubs, SurveySelection: false } },
        });
        expect(wrapper.text()).toContain('archiviert');
        const numbers = wrapper.findAllComponents(input);
        expect(numbers[1]!.attributes('max')).toBe('2');
        wrapper.unmount();
        const fresh = mount(SurveySelection, {
            props: { survey, entries, modelValue: {} },
            global: { stubs: { ...stubs, SurveySelection: false } },
        });
        expect(fresh.findAllComponents(input)).toHaveLength(1);
        fresh.unmount();
    });
    it('schließt stornierte Wähler aus derselben Radio-Beschreibung wie der Stimmenzahl aus', () => {
        const radio = defineComponent({
            name: 'URadioGroup',
            props: ['items'],
            setup() {
                return () => h('div');
            },
        });
        const wrapper = mount(SurveySelection, {
            props: {
                survey: {
                    ...survey,
                    type: 'best-option',
                    fields: [{ key: 'options', fieldTypeCode: 'select', options: [{ id: 'a', nameTranslated: 'A' }] }],
                },
                entries: [
                    { ...entries[0]!, data: { options: ['a'] } },
                    { ...entries[1]!, status: 'cancelled', data: { options: ['a'] } },
                ],
                modelValue: {},
            },
            global: { stubs: { URadioGroup: radio } },
        });
        const items = wrapper.findComponent(radio).props('items') as { description: string }[];
        expect(items[0]!.description).toBe('1 Stimme · Erste');
        wrapper.unmount();
    });
    it('exportiert aggregierte Mengen ohne Teilnehmerdaten und ohne stornierte Belegung', () => {
        const csv = resultsCsv(survey, [
            ...entries,
            { ...entries[0]!, name: 'Storniert', status: 'cancelled', data: { a: 9 } },
        ]);
        expect(csv).toContain('Belegte Einheiten');
        expect(csv).toContain('Verfügbar');
        expect(csv).not.toContain('Erste');
        expect(csv).not.toContain('Storniert');
        expect(csv).toContain('"A";"Nein";"2";"2";"";"10";"8"');
    });
});

describe('Terminvergleich und Änderungsdetails', () => {
    it('zeigt nur aktive Antworten in der Terminmatrix und sortiert die Spalten chronologisch', async () => {
        const dateSurvey: Survey = {
            ...survey,
            type: 'best-date',
            fields: [
                {
                    key: 'options',
                    fieldTypeCode: 'multiselect',
                    options: [
                        { id: 'b', nameTranslated: '2026-11-02T17:00:00Z' },
                        { id: 'a', nameTranslated: '2026-11-01T09:00:00Z' },
                    ],
                },
            ],
        };
        (mocks.state.survey as Ref<Survey>).value = dateSurvey;
        (mocks.state.surveyEntries as Ref<SurveyEntry[]>).value = [
            { ...entries[0]!, data: { options: ['a'] } },
            { ...entries[1]!, status: 'cancelled', data: { options: ['b'] } },
        ];
        const wrapper = mount(SurveyResults, { props: { id: 10 }, global: { stubs } });
        await wrapper.find('input[aria-label="Antworten als Terminmatrix anzeigen"]').setValue(true);
        expect(wrapper.find('table').text()).toContain('Erste');
        expect(wrapper.find('table').text()).not.toContain('Zweite');
        const headers = wrapper.findAll('thead th').map(header => header.text());
        expect(headers[1]).toContain('1.11.2026');
        expect(headers[2]).toContain('2.11.2026');
        wrapper.unmount();
    });
    it('zeigt die tatsächlichen geänderten Inhalte und ignoriert reine Metadaten', () => {
        const change: Change = {
            id: 'test',
            module: 4,
            category: 10,
            entity: 'entry',
            title: 'Test',
            date: '',
            before: entries[0]!,
            after: {
                ...entries[0]!,
                status: 'cancelled',
                data: { a: 2 },
                meta: { createdDate: '', modifiedDate: 'new' },
            },
        };
        const details = changeDetails(change, survey);
        expect(details.map(detail => detail.field)).toEqual(['Auswahl', 'Status']);
        expect(details[0]!.before).toContain('2 × B (archiviert)');
        expect(details[0]!.after).toBe('2 × A');
        expect(details[1]).toMatchObject({ before: 'Reserviert', after: 'Zurückgebracht / storniert' });
    });
});
