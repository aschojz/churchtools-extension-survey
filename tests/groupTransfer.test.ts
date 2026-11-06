import { beforeEach, describe, expect, it, vi } from 'vitest';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { buildTransferPlan, exactEmailMatches, planFields, valuesForEntry } from '../src/utils/groupTransfer';
import type { PersonResolution } from '../src/utils/groupTransfer';
import { executeGroupTransfer, mapMemberValues, validateTransferSettings } from '../src/data/groupTransfer';
import type { TransferMasterdata, TransferProgress, TransferSettings } from '../src/data/groupTransfer';
import type { Survey, SurveyEntry } from '../src/utils/types';
import { fetchEntries, fetchSurvey } from '../src/data/ccm';
import { fingerprint } from '../src/utils/serialization';
vi.mock('@churchtools/churchtools-client', () => ({
    churchtoolsClient: {
        get: vi.fn(),
        getAllPages: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        oldApi: vi.fn(),
        setLoadCSRFForOldAPI: vi.fn(),
    },
}));
vi.mock('../src/data/ccm', () => ({ fetchEntries: vi.fn(), fetchSurvey: vi.fn() }));
const survey: Survey = {
    id: 10,
    customModuleId: 4,
    shorty: 'survey_test',
    name: 'Material',
    description: 'Intern',
    surveyDescription: 'Für das Wochenende',
    type: 'max-options-multiple',
    isActive: false,
    allowComments: true,
    fields: [
        {
            key: 'choices',
            fieldTypeCode: 'multiselect',
            options: [
                { id: 'a', nameTranslated: 'Zelte' },
                { id: 'b', nameTranslated: 'Zelte', archived: true },
            ],
        },
    ],
    meta: { createdDate: '' },
};
const entry: SurveyEntry = {
    id: 20,
    dataCategoryId: 10,
    name: 'Anna Test',
    email: 'anna@example.org',
    data: { a: 2, b: 1 },
    comments: [{ comment: 'Danke', createdDate: '' }],
    status: 'completed',
    meta: { createdDate: '' },
};
const resolution: PersonResolution = {
    entryId: 20,
    mode: 'existing',
    person: { id: 42, firstName: 'Anna', lastName: 'Test' },
    create: { firstName: '', lastName: '', email: '' },
};
const master: TransferMasterdata = {
    groupTypes: [{ id: 9, name: 'Aktionen' }],
    roles: [{ id: 71, groupTypeId: 9, name: 'Teilnehmer' }],
    statuses: [{ id: 5, name: 'Gast' }],
    campuses: [{ id: 8, name: 'Nord' }],
    departments: [{ id: 3, name: 'Gemeinde' }],
};
const settings: TransferSettings = {
    groupTypeId: 9,
    roleId: 71,
    securityLevel: 1,
    personDefaults: { statusId: 5, campusId: 8, departmentIds: [3] },
};
const makePlan = () => buildTransferPlan(survey, [entry], [resolution], false);
const makeProgress = (): TransferProgress => ({
    personIds: [],
    fieldIds: [],
    memberIds: [],
    message: '',
    finished: false,
});
const source = () => ({ moduleId: 4, surveyId: 10, fingerprint: fingerprint({ survey, entries: [entry] }) });
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchSurvey).mockResolvedValue(structuredClone(survey));
    vi.mocked(fetchEntries).mockResolvedValue([structuredClone(entry)]);
    vi.mocked(churchtoolsClient.get).mockImplementation(async path => {
        if (path === '/person/masterdata') return master;
        if (path === '/config') return {};
        if (path === '/persons/42') return { id: 42 };
        if (path === '/groups/100') return { information: { note: survey.surveyDescription } };
        throw new Error(`Unexpected ${path}`);
    });
    let fieldId = 200;
    vi.mocked(churchtoolsClient.post).mockImplementation(async (path, body) => {
        if (path === '/groups') return { id: 100 };
        if (path === '/persons') return { id: 99 };
        if (path === '/groups/100/memberfields/group')
            return {
                id: fieldId++,
                fieldTypeCode: body!.fieldTypeCode,
                options: (body!.options as { name: string }[]).map((option, index) => ({
                    id: String(800 + index),
                    name: option.name,
                })),
            };
        throw new Error(`Unexpected ${path}`);
    });
});
describe('Übertragungsplan', () => {
    it('übernimmt Mengen, archivierte Optionen, Kommentare und Status ohne Quelländerung', () => {
        const before = structuredClone(entry);
        const plan = buildTransferPlan(survey, [entry, { ...entry, id: 21, status: 'cancelled' }], [resolution], false);
        expect(plan).toMatchObject({ name: 'Material', description: 'Für das Wochenende', skipped: 1 });
        expect(plan.members[0]!.values).toEqual({
            'quantity-0': 2,
            'quantity-1': 1,
            comments: 'Danke',
            status: 'completed',
        });
        expect(new Set(plan.fields.map(field => field.name)).size).toBe(plan.fields.length);
        expect(entry).toEqual(before);
        expect(churchtoolsClient.post).not.toHaveBeenCalled();
    });
    it.each(['best-option', 'best-date', 'max-options'] as const)('bildet %s über die Quell-IDs ab', type => {
        const selectedSurvey = {
            ...survey,
            type,
            fields: [
                {
                    ...survey.fields[0]!,
                    fieldTypeCode: 'multiselect' as const,
                    options: survey.fields[0]!.options.map((option, index) => ({
                        ...option,
                        nameTranslated:
                            type === 'best-date' ? `2026-11-${10 + index}T10:00:00Z` : option.nameTranslated,
                    })),
                },
            ],
        };
        const fields = planFields(selectedSurvey);
        expect(valuesForEntry(selectedSurvey, { ...entry, data: { choices: ['a', 'b'] } }, fields).selection).toEqual([
            'a',
            'b',
        ]);
        expect(new Set(fields[0]!.options.map(option => option.name)).size).toBe(2);
    });
    it('verhindert Mehrfachauswahl im Einfachauswahlfeld und unbekannte Optionen', () => {
        const s = {
            ...survey,
            type: 'best-option' as const,
            fields: [{ ...survey.fields[0]!, fieldTypeCode: 'select' as const }],
        };
        expect(() => valuesForEntry(s, { ...entry, data: { choices: ['a', 'b'] } }, planFields(s))).toThrow(
            'Mehrere Antworten',
        );
        expect(() => valuesForEntry(s, { ...entry, data: { choices: ['unknown'] } }, planFields(s))).toThrow(
            'Unbekannte Auswahl',
        );
    });
    it('verlangt Auflösung, verhindert doppelte Mitglieder und erlaubt bewusstes Überspringen', () => {
        expect(() => buildTransferPlan(survey, [entry], [], false)).toThrow('zuordnen');
        expect(() =>
            buildTransferPlan(
                survey,
                [entry, { ...entry, id: 21 }],
                [resolution, { ...resolution, entryId: 21 }],
                false,
            ),
        ).toThrow('Mehrere Antworten');
        expect(
            buildTransferPlan(
                survey,
                [entry, { ...entry, id: 21 }],
                [resolution, { ...resolution, entryId: 21, mode: 'skip' }],
                false,
            ).members,
        ).toHaveLength(1);
    });
    it('verlangt explizite Namen und erforderliche Datenschutzangaben für Neuanlagen', () => {
        const row = { ...resolution, mode: 'new' as const };
        expect(() => buildTransferPlan(survey, [entry], [row], false)).toThrow('Vor- und Nachname');
        row.create = { firstName: 'Anna', lastName: 'Test', email: 'anna@example.org' };
        expect(() => buildTransferPlan(survey, [entry], [row], true)).toThrow('Datenschutzangaben');
        expect(buildTransferPlan(survey, [entry], [row], false).members[0]!.create).toEqual(row.create);
    });
    it('blockiert offene Umfragen und überlange Kommentare vor jeglichem Schreiben', () => {
        expect(() => buildTransferPlan({ ...survey, isActive: true }, [entry], [resolution], false)).toThrow('beendet');
        expect(() =>
            buildTransferPlan(
                survey,
                [{ ...entry, comments: [{ comment: 'a'.repeat(4001), createdDate: '' }] }],
                [resolution],
                false,
            ),
        ).toThrow('4.000');
    });
    it('erhält Kommentare nach nachträglichem Abschalten der Kommentarfunktion', () => {
        expect(
            buildTransferPlan({ ...survey, allowComments: false }, [entry], [resolution], false).members[0]!.values
                .comments,
        ).toBe('Danke');
    });
    it('liefert nur exakte E-Mail-Vorschläge und ordnet sie nicht selbst zu', () => {
        const people = [
            { id: 1, email: 'ANNA@example.org' },
            { id: 2, email: 'xanna@example.org' },
            { id: 3, emails: [{ email: 'anna@example.org' }] },
        ];
        expect(exactEmailMatches(people, ' anna@example.org ').map(person => person.id)).toEqual([1, 3]);
        expect(exactEmailMatches(people)).toEqual([]);
    });
});
describe('ChurchTools-Übertragung', () => {
    it('validiert installationsspezifische Stammdaten und Rollen', () => {
        expect(() => validateTransferSettings(makePlan(), { ...settings, roleId: 99 }, master)).toThrow(
            'Mitgliedsrolle',
        );
        const plan = makePlan();
        plan.members[0]!.create = { firstName: 'A', lastName: 'B', email: '' };
        expect(() =>
            validateTransferSettings(
                plan,
                { ...settings, personDefaults: { ...settings.personDefaults, departmentIds: [] } },
                master,
            ),
        ).toThrow('Bereich');
    });
    it('verwendet zurückgelieferte Options-IDs, niemals Quell-IDs oder die Reihenfolge', () => {
        const field = planFields({ ...survey, type: 'best-option' })[0]!;
        const created = {
            id: 22,
            fieldTypeCode: 'multiselect',
            options: field.options.map((option, index) => ({ id: String(90 + index), name: option.name })).reverse(),
        };
        expect(mapMemberValues(field, created, ['a', 'b'])).toEqual(['90', '91']);
        expect(() => mapMemberValues(field, { ...created, options: [] }, ['a'])).toThrow('zugeordnet');
    });
    it('erstellt eine neue Gruppe mit Beschreibung und danach Felder und Mitglieder', async () => {
        const progress = makeProgress();
        await executeGroupTransfer(makePlan(), settings, master, source(), progress);
        expect(churchtoolsClient.post).toHaveBeenCalledWith('/groups', {
            name: 'Material',
            groupTypeId: 9,
            groupStatusId: 1,
            visibility: 'restricted',
            force: true,
        });
        expect(churchtoolsClient.oldApi).toHaveBeenCalledWith('churchdb', 'f_group', {
            id: 100,
            notiz: 'Für das Wochenende',
        });
        expect(churchtoolsClient.put).toHaveBeenCalledWith(
            '/groups/100/members/42',
            expect.objectContaining({
                groupTypeRoleId: 71,
                groupMemberStatus: 'active',
                only_add: true,
                fields: { '200': 2, '201': 1, '202': 'Danke', '203': '801' },
            }),
        );
        expect(progress).toMatchObject({
            groupId: 100,
            fieldIds: [200, 201, 202, 203],
            memberIds: [42],
            finished: true,
        });
    });
    it('legt neue Personen mit den gewählten Stammdaten vor der Gruppe an', async () => {
        const row = {
            ...resolution,
            mode: 'new' as const,
            create: { firstName: 'Anna', lastName: 'Test', email: 'anna@example.org' },
        };
        const plan = buildTransferPlan(survey, [entry], [row], false);
        await executeGroupTransfer(plan, settings, master, source(), makeProgress());
        expect(vi.mocked(churchtoolsClient.post).mock.calls[0]).toEqual([
            '/persons',
            { ...row.create, ...settings.personDefaults },
        ]);
        expect(churchtoolsClient.put).toHaveBeenCalledWith('/groups/100/members/99', expect.anything());
    });
    it('blockiert geänderte Quelldaten und fehlende Personen vor dem Schreiben', async () => {
        vi.mocked(fetchEntries).mockResolvedValue([{ ...entry, data: { a: 3 } }]);
        await expect(executeGroupTransfer(makePlan(), settings, master, source(), makeProgress())).rejects.toThrow(
            'geändert',
        );
        expect(churchtoolsClient.post).not.toHaveBeenCalled();
        vi.mocked(fetchEntries).mockResolvedValue([entry]);
        vi.mocked(churchtoolsClient.get).mockRejectedValue(new Error('Forbidden'));
        await expect(executeGroupTransfer(makePlan(), settings, master, source(), makeProgress())).rejects.toThrow(
            'Forbidden',
        );
        expect(churchtoolsClient.post).not.toHaveBeenCalled();
    });
    it('zeigt Teilschritte bei Feldfehlern, legt keine Mitglieder an und wiederholt nichts', async () => {
        vi.mocked(churchtoolsClient.post).mockImplementation(async path => {
            if (path === '/groups') return { id: 100 };
            throw new Error('Forbidden');
        });
        const progress = makeProgress();
        await expect(executeGroupTransfer(makePlan(), settings, master, source(), progress)).rejects.toThrow(
            'Forbidden',
        );
        expect(progress).toMatchObject({ groupId: 100, finished: false, memberIds: [] });
        expect(churchtoolsClient.put).not.toHaveBeenCalled();
        await expect(executeGroupTransfer(makePlan(), settings, master, source(), progress)).rejects.toThrow(
            'bereits gestartet',
        );
        expect(vi.mocked(churchtoolsClient.post).mock.calls.filter(([path]) => path === '/groups')).toHaveLength(1);
    });
    it('bricht bei nicht bestätigter Gruppenbeschreibung vor den Mitgliedern ab', async () => {
        const get = vi.mocked(churchtoolsClient.get).getMockImplementation()!;
        vi.mocked(churchtoolsClient.get).mockImplementation(async (path, ...args) =>
            path === '/groups/100' ? { information: { note: '' } } : get(path, ...args),
        );
        await expect(executeGroupTransfer(makePlan(), settings, master, source(), makeProgress())).rejects.toThrow(
            'Gruppenbeschreibung',
        );
        expect(churchtoolsClient.put).not.toHaveBeenCalled();
    });
});
