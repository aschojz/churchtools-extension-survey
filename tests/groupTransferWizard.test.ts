import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, expect, it, vi } from 'vitest';
import SurveyGroupTransfer from '../src/survey/SurveyGroupTransfer.vue';
import type { Survey, SurveyEntry } from '../src/utils/types';
import {
    executeGroupTransfer,
    fetchTransferPerson,
    loadTransferSetup,
    searchTransferPeople,
} from '../src/data/groupTransfer';
import { fetchEntries, fetchSurvey } from '../src/data/ccm';
vi.mock('../src/composables/usePlugin', () => ({ usePlugin: () => ({ moduleId: ref(4) }) }));
vi.mock('../src/composables/useDraftGuard', () => ({ useDraftGuard: vi.fn() }));
vi.mock('../src/data/ccm', () => ({ fetchEntries: vi.fn(), fetchSurvey: vi.fn() }));
vi.mock('../src/data/groupTransfer', async importOriginal => ({
    ...(await importOriginal<object>()),
    executeGroupTransfer: vi.fn(),
    fetchTransferPerson: vi.fn(),
    loadTransferSetup: vi.fn(),
    searchTransferPeople: vi.fn(),
}));
const survey: Survey = {
    id: 10,
    customModuleId: 4,
    name: 'Terminfindung',
    shorty: 'survey_test',
    type: 'best-option',
    isActive: false,
    fields: [{ key: 'options', fieldTypeCode: 'select', options: [{ id: 'a', nameTranslated: 'Samstag' }] }],
    meta: { createdDate: '' },
};
const answer: SurveyEntry = {
    id: 20,
    dataCategoryId: 10,
    name: 'Anna Test',
    email: 'anna@example.org',
    data: { options: ['a'] },
    status: 'new',
    meta: { createdDate: '' },
};
const button = defineComponent({
    props: ['disabled', 'loading'],
    setup(props, { slots, attrs }) {
        return () => h('button', { ...attrs, disabled: props.disabled || props.loading }, slots.default?.());
    },
});
const alert = defineComponent({
    props: ['title', 'description'],
    setup(props) {
        return () => h('p', { role: 'alert' }, `${props.title}: ${props.description}`);
    },
});
const mountWizard = () =>
    mount(SurveyGroupTransfer, { props: { survey }, global: { components: { UButton: button, UAlert: alert } } });
type Wrapper = ReturnType<typeof mountWizard>;
async function click(wrapper: Wrapper, text: string) {
    const found = wrapper.findAll('button').find(item => item.text().includes(text));
    expect(found).toBeDefined();
    await found!.trigger('click');
    await flushPromises();
}
async function groupSettings(wrapper: Wrapper) {
    await wrapper.findAll('select')[0]!.setValue(9);
    await wrapper.findAll('select')[1]!.setValue(71);
}
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchSurvey).mockResolvedValue(survey);
    vi.mocked(fetchEntries).mockResolvedValue([answer]);
    vi.mocked(fetchTransferPerson).mockResolvedValue({ id: 42, firstName: 'Anna', lastName: 'Test' });
    vi.mocked(searchTransferPeople).mockResolvedValue([
        { id: 42, firstName: 'Anna', lastName: 'Test', email: 'anna@example.org' },
    ]);
    vi.mocked(loadTransferSetup).mockResolvedValue({
        masterdata: {
            groupTypes: [{ id: 9, name: 'Aktionen' }],
            roles: [{ id: 71, groupTypeId: 9, name: 'Teilnehmer', isDefault: true }],
            statuses: [],
            departments: [],
            campuses: [],
        },
        privacyRequired: false,
    });
});
it('verlangt die Bestätigung eines E-Mail-Treffers und schreibt erst nach der Vorschau', async () => {
    const wrapper = mountWizard();
    expect(loadTransferSetup).not.toHaveBeenCalled();
    await click(wrapper, 'Übernahme vorbereiten');
    await groupSettings(wrapper);
    await click(wrapper, 'Vorschau anzeigen');
    expect(wrapper.text()).toContain('bitte zuordnen');
    expect(executeGroupTransfer).not.toHaveBeenCalled();
    await click(wrapper, 'auswählen');
    await click(wrapper, 'Vorschau anzeigen');
    expect(wrapper.text()).toContain('3. Vorschau');
    expect(wrapper.text()).toContain('Samstag');
    expect(executeGroupTransfer).not.toHaveBeenCalled();
    await click(wrapper, 'Jetzt übernehmen');
    expect(executeGroupTransfer).toHaveBeenCalledTimes(1);
    wrapper.unmount();
});
it('prüft vorhandene Personen-IDs ohne eine manuelle Neuzuordnung zu verlangen', async () => {
    vi.mocked(fetchEntries).mockResolvedValue([{ ...answer, personId: 42 }]);
    const wrapper = mountWizard();
    await click(wrapper, 'Übernahme vorbereiten');
    expect(fetchTransferPerson).toHaveBeenCalledWith(42);
    expect(searchTransferPeople).not.toHaveBeenCalled();
    await groupSettings(wrapper);
    await click(wrapper, 'Vorschau anzeigen');
    expect(wrapper.text()).toContain('3. Vorschau');
    wrapper.unmount();
});
it('zeigt Fehler und Teilschritte und bietet keine erneute Ausführung an', async () => {
    vi.mocked(fetchEntries).mockResolvedValue([{ ...answer, personId: 42 }]);
    vi.mocked(executeGroupTransfer).mockImplementation(async (_plan, _settings, _master, _source, progress) => {
        progress.groupId = 100;
        progress.fieldIds.push(200);
        throw new Error('Keine Berechtigung für Mitgliedschaften');
    });
    const wrapper = mountWizard();
    await click(wrapper, 'Übernahme vorbereiten');
    await groupSettings(wrapper);
    await click(wrapper, 'Vorschau anzeigen');
    await click(wrapper, 'Jetzt übernehmen');
    expect(wrapper.text()).toContain('Keine Berechtigung für Mitgliedschaften');
    expect(wrapper.text()).toContain('Neue Gruppe #100');
    expect(wrapper.text()).toContain('0 neue Personen, 1 Felder, 0 Mitgliedschaften');
    expect(wrapper.findAll('button').some(item => item.text().includes('Jetzt übernehmen'))).toBe(false);
    wrapper.unmount();
});
