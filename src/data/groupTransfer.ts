import { churchtoolsClient } from '@churchtools/churchtools-client';
import { fetchEntries, fetchSurvey } from './ccm';
import { fingerprint } from '../utils/serialization';
import type { FieldPlan, TransferPlan, TransferPerson, TransferValue } from '../utils/groupTransfer';

export type CatalogItem = { id: number; name: string; nameTranslated?: string };
export type Role = CatalogItem & { groupTypeId: number; isDefault?: boolean; type?: string };
export type TransferMasterdata = {
    groupTypes: CatalogItem[];
    roles: Role[];
    statuses: CatalogItem[];
    campuses: CatalogItem[];
    departments: CatalogItem[];
};
export type PersonDefaults = { statusId: number; campusId: number; departmentIds: number[] };
export type TransferSettings = {
    groupTypeId: number;
    roleId: number;
    personDefaults: PersonDefaults;
    securityLevel: number;
};
export type CreatedField = { id: number; fieldTypeCode: string; options: { id: string; name: string }[] };
export type TransferProgress = {
    groupId?: number;
    personIds: number[];
    fieldIds: number[];
    memberIds: number[];
    message: string;
    finished: boolean;
};
export async function loadTransferSetup() {
    const [masterdata, config] = await Promise.all([
        churchtoolsClient.get<TransferMasterdata>('/person/masterdata'),
        churchtoolsClient.get<Record<string, unknown>>('/config'),
    ]);
    const enabled = (value: unknown) => value === true || value === 1 || value === '1';
    return {
        masterdata,
        privacyRequired:
            enabled(config.privacy_policy_fields_mandatory) || enabled(config.privacy_policy_fields_mandatory_api),
    };
}
export async function searchTransferPeople(query: string, email = false) {
    if (!query.trim()) return [];
    return churchtoolsClient.getAllPages<TransferPerson>('/persons', {
        [email ? 'email' : 'query']: query.trim(),
        is_archived: false,
    });
}
export async function fetchTransferPerson(id: number) {
    const person = await churchtoolsClient.get<TransferPerson>(`/persons/${id}`);
    if (!person?.id || person.isArchived) throw new Error(`Person #${id} ist nicht verfügbar oder archiviert.`);
    return person;
}
function positive(value: number) {
    return Number.isSafeInteger(value) && value > 0;
}
export function validateTransferSettings(
    plan: TransferPlan,
    settings: TransferSettings,
    masterdata: TransferMasterdata,
) {
    if (!masterdata.groupTypes.some(item => item.id === settings.groupTypeId))
        throw new Error('Bitte einen gültigen Gruppentyp wählen.');
    if (!masterdata.roles.some(item => item.id === settings.roleId && item.groupTypeId === settings.groupTypeId))
        throw new Error('Bitte eine Mitgliedsrolle des Gruppentyps wählen.');
    if (!Number.isSafeInteger(settings.securityLevel) || settings.securityLevel < 1)
        throw new Error('Ungültige Sicherheitsstufe für Mitgliedsfelder.');
    if (plan.members.some(member => member.create)) {
        const defaults = settings.personDefaults;
        if (!masterdata.statuses.some(item => item.id === defaults.statusId))
            throw new Error('Personenstatus für neue Personen fehlt.');
        if (!masterdata.campuses.some(item => item.id === defaults.campusId))
            throw new Error('Standort für neue Personen fehlt.');
        if (
            !defaults.departmentIds.length ||
            defaults.departmentIds.some(id => !masterdata.departments.some(item => item.id === id))
        )
            throw new Error('Mindestens ein gültiger Bereich für neue Personen ist erforderlich.');
    }
    if (!plan.name.trim() || plan.name.length > 255 || plan.description.length > 10000)
        throw new Error('Titel oder Beschreibung überschreitet die Gruppenlimits.');
    for (const field of plan.fields) {
        if (
            field.name.length > 100 ||
            field.name.trim().length < 2 ||
            field.options.some(option => !option.name.trim() || option.name.length > 500)
        )
            throw new Error('Ein automatisch erzeugtes Mitgliedsfeld überschreitet die Feldlimits.');
    }
}
export function mapMemberValues(plan: FieldPlan, created: CreatedField, value: TransferValue): TransferValue {
    if (plan.fieldTypeCode === 'number' || plan.fieldTypeCode === 'textarea') return value;
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    const mapped = ids.map(sourceId => {
        const name = plan.options.find(option => option.sourceId === sourceId)?.name;
        const matches = created.options.filter(option => option.name === name);
        if (matches.length !== 1) throw new Error(`Auswahlwert für „${plan.name}“ konnte nicht zugeordnet werden.`);
        return String(matches[0]!.id);
    });
    return plan.fieldTypeCode === 'multiselect' ? mapped : (mapped[0] ?? '');
}
// A run deliberately has no automatic retry: a failed request may already have reached ChurchTools.
export async function executeGroupTransfer(
    plan: TransferPlan,
    settings: TransferSettings,
    masterdata: TransferMasterdata,
    source: { moduleId: number; surveyId: number; fingerprint: string },
    progress: TransferProgress,
    notify: () => void = () => {},
) {
    validateTransferSettings(plan, settings, masterdata);
    if (progress.groupId || progress.personIds.length || progress.fieldIds.length || progress.memberIds.length)
        throw new Error('Dieser Lauf wurde bereits gestartet. Bitte den angezeigten Teilbestand prüfen.');
    const update = (message: string) => {
        progress.message = message;
        notify();
    };
    update('Umfrage und Personen werden erneut geprüft …');
    const survey = await fetchSurvey(source.moduleId, source.surveyId);
    const entries = await fetchEntries(source.moduleId, source.surveyId, survey);
    if (fingerprint({ survey, entries }) !== source.fingerprint)
        throw new Error('Die Umfrage oder Antworten wurden geändert. Bitte den Assistenten neu vorbereiten.');
    for (const member of plan.members) if (member.person) await fetchTransferPerson(member.person.id);
    // Recheck required privacy configuration immediately before the first write.
    const setup = await loadTransferSetup();
    validateTransferSettings(plan, settings, setup.masterdata);
    for (const member of plan.members)
        if (
            member.create &&
            setup.privacyRequired &&
            (!member.create.privacyPolicyAgreementDate ||
                !member.create.privacyPolicyAgreementTypeId ||
                !member.create.privacyPolicyAgreementWhoId)
        )
            throw new Error('Datenschutzangaben für eine neue Person fehlen. Bitte die Vorbereitung erneuern.');
    const personIds = new Map<number, number>();
    for (const member of plan.members) {
        if (member.person) personIds.set(member.entryId, member.person.id);
        else {
            update(`Person „${member.create!.firstName} ${member.create!.lastName}“ wird angelegt …`);
            const person = await churchtoolsClient.post<TransferPerson>('/persons', {
                ...member.create,
                ...settings.personDefaults,
            });
            if (!positive(person?.id))
                throw new Error('Personenanlage lieferte keine gültige ID. Bitte den Personenbestand prüfen.');
            personIds.set(member.entryId, person.id);
            progress.personIds.push(person.id);
            notify();
        }
    }
    update('Neue Gruppe wird angelegt …');
    const group = await churchtoolsClient.post<{ id: number }>('/groups', {
        name: plan.name,
        groupTypeId: settings.groupTypeId,
        groupStatusId: 1,
        visibility: 'restricted',
        force: true,
    });
    if (!positive(group?.id))
        throw new Error('Gruppenanlage lieferte keine gültige ID. Bitte den Gruppenbestand prüfen.');
    progress.groupId = group.id;
    notify();
    if (plan.description) {
        update('Umfragebeschreibung wird in die Gruppe übernommen …');
        // The current REST create/patch routes cannot write information.note. This is the
        // same legacy writer used by ChurchTools' GroupInfos editor (f_group / notiz).
        churchtoolsClient.setLoadCSRFForOldAPI();
        await churchtoolsClient.oldApi('churchdb', 'f_group', { id: group.id, notiz: plan.description });
        const saved = await churchtoolsClient.get<{ information: { note: string } }>(`/groups/${group.id}`);
        if (saved.information.note !== plan.description)
            throw new Error('Die Gruppenbeschreibung konnte nicht bestätigt werden. Bitte die neue Gruppe prüfen.');
    }
    const fields = new Map<string, CreatedField>();
    for (const [index, field] of plan.fields.entries()) {
        update(`Mitgliedsfeld „${field.name}“ wird angelegt …`);
        const created = await churchtoolsClient.post<CreatedField>(`/groups/${group.id}/memberfields/group`, {
            name: field.name,
            referenceName: `survey-${survey.id}-${field.key}`,
            fieldTypeCode: field.fieldTypeCode,
            options: ['select', 'multiselect'].includes(field.fieldTypeCode)
                ? field.options.map(option => ({ name: option.name }))
                : [],
            securityLevel: settings.securityLevel,
            requiredInRegistrationForm: false,
            useInRegistrationForm: false,
            sortKey: index,
        });
        if (!positive(created?.id)) throw new Error(`Mitgliedsfeld „${field.name}“ lieferte keine gültige ID.`);
        progress.fieldIds.push(created.id);
        notify();
        if (created.fieldTypeCode !== field.fieldTypeCode) throw new Error(`Unerwarteter Feldtyp für „${field.name}“.`);
        fields.set(field.key, created);
    }
    // Validate every returned option mapping before adding the first member.
    const memberships = plan.members.map(member => ({
        member,
        values: Object.fromEntries(
            plan.fields.map(field => {
                const created = fields.get(field.key)!;
                return [String(created.id), mapMemberValues(field, created, member.values[field.key]!)];
            }),
        ),
    }));
    for (const { member, values } of memberships) {
        const id = personIds.get(member.entryId)!;
        update(`Mitglied ${progress.memberIds.length + 1} von ${memberships.length} wird übernommen …`);
        await churchtoolsClient.put(`/groups/${group.id}/members/${id}`, {
            groupTypeRoleId: settings.roleId,
            groupMemberStatus: 'active',
            fields: values,
            only_add: true,
            informLeader: false,
        });
        progress.memberIds.push(id);
        notify();
    }
    progress.finished = true;
    update(`${progress.memberIds.length} Mitglieder mit ihren Umfragewerten übernommen.`);
}
