import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { Survey, SurveyEntry } from '../utils/types';
import { SurveyType } from '../utils/types';
export type StoredCategory = {
    id: number;
    customModuleId: number;
    shorty: string;
    name: string;
    description?: string;
    data?: string;
};
export type StoredValue = { id: number; dataCategoryId: number; value: string };
export type DataIssue = { id: number; name: string; message: string; category?: StoredCategory };
export function decode<T extends object>(json: string | undefined, metadata: object): T {
    const value: unknown = json ? JSON.parse(json) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Gespeicherte Daten sind ungültig.');
    return { ...value, ...metadata } as T;
}
function object(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function readSurvey(row: StoredCategory): Survey {
    const { data, ...metadata } = row;
    if (!data?.trim())
        throw new Error('Das Feld „data“ ist leer. Umfragetyp („type“) und Auswahloptionen („fields“) fehlen.');
    const survey = decode<Survey>(data, metadata);
    if (!Object.values(SurveyType).includes(survey.type))
        throw new Error(
            `„type“ muss ${Object.values(SurveyType).join(', ')} sein; gespeichert: ${JSON.stringify(survey.type) ?? 'fehlt'}.`,
        );
    if (!Array.isArray(survey.fields) || survey.fields.length !== 1)
        throw new Error('„fields“ muss genau ein Auswahlfeld enthalten.');
    if (typeof survey.name !== 'string' || !survey.name.trim()) throw new Error('Der Umfragename ist ungültig.');
    if (survey.sortKey !== undefined && (typeof survey.sortKey !== 'number' || !Number.isFinite(survey.sortKey)))
        throw new Error('Die Sortierreihenfolge ist ungültig.');
    if (survey.schemaVersion !== undefined && survey.schemaVersion !== 1)
        throw new Error('Diese Datenversion wird nicht unterstützt.');
    const field = survey.fields[0]!;
    if (
        !object(field) ||
        typeof field.key !== 'string' ||
        !field.key ||
        !['select', 'multiselect'].includes(field.fieldTypeCode) ||
        !Array.isArray(field.options)
    )
        throw new Error('Das Auswahlfeld ist ungültig.');
    const ids = new Set<string>();
    for (const option of field.options) {
        if (
            !object(option) ||
            typeof option.id !== 'string' ||
            !option.id ||
            ids.has(option.id) ||
            typeof option.nameTranslated !== 'string' ||
            !option.nameTranslated.trim()
        )
            throw new Error('Eine Option ist ungültig.');
        ids.add(option.id);
        for (const key of ['maxCount', 'maxSelectable'] as const) {
            if (option[key] === 0) delete option[key];
            if (option[key] !== undefined && (!Number.isSafeInteger(option[key]) || Number(option[key]) < 1))
                throw new Error('Eine Mengenbegrenzung ist ungültig.');
        }
        if (option.archived !== undefined && typeof option.archived !== 'boolean')
            throw new Error('Archivstatus ist ungültig.');
        if (option.description !== undefined && typeof option.description !== 'string')
            throw new Error('Optionsbeschreibung ist ungültig.');
        if (survey.type === 'best-date' && !Number.isFinite(Date.parse(option.nameTranslated)))
            throw new Error('Ein Optionstermin ist ungültig.');
    }
    for (const key of ['isActive', 'isListed', 'allowComments', 'askForMail', 'hideDataFromParticipants'] as const)
        if (survey[key] !== undefined && typeof survey[key] !== 'boolean')
            throw new Error('Eine Einstellung ist ungültig.');
    for (const key of ['startDate', 'endDate', 'surveyDescription', 'imageUrl'] as const)
        if (survey[key] !== undefined && typeof survey[key] !== 'string') throw new Error('Ein Textfeld ist ungültig.');
    for (const date of [survey.startDate, survey.endDate])
        if (date && !Number.isFinite(Date.parse(date))) throw new Error('Ein Datum ist ungültig.');
    if (!object(survey.meta)) survey.meta = { createdDate: '' };
    if (
        typeof survey.meta.createdDate !== 'string' ||
        (survey.meta.modifiedDate !== undefined && typeof survey.meta.modifiedDate !== 'string')
    )
        throw new Error('Die Metadaten sind ungültig.');
    return survey;
}
export function readEntry(row: StoredValue): SurveyEntry {
    const { value, ...metadata } = row;
    const entry = decode<SurveyEntry>(value, metadata);
    if (typeof entry.name !== 'string' || !entry.name.trim() || !object(entry.data))
        throw new Error('Name oder Auswahl ist ungültig.');
    for (const selected of Object.values(entry.data))
        if (
            !(typeof selected === 'number' && Number.isSafeInteger(selected) && selected >= 0) &&
            !(Array.isArray(selected) && selected.every(id => typeof id === 'string'))
        )
            throw new Error('Eine gespeicherte Auswahl ist ungültig.');
    if (entry.email !== undefined && typeof entry.email !== 'string') throw new Error('E-Mail-Adresse ist ungültig.');
    if (entry.personId !== undefined && !Number.isSafeInteger(entry.personId))
        throw new Error('Personen-ID ist ungültig.');
    if (!entry.status) entry.status = 'new';
    if (!['new', 'completed', 'cancelled'].includes(entry.status)) throw new Error('Status ist ungültig.');
    if (
        entry.comments !== undefined &&
        (!Array.isArray(entry.comments) ||
            entry.comments.some(
                comment =>
                    !object(comment) || typeof comment.comment !== 'string' || typeof comment.createdDate !== 'string',
            ))
    )
        throw new Error('Kommentare sind ungültig.');
    if (!object(entry.meta)) entry.meta = { createdDate: '' };
    if (
        typeof entry.meta.createdDate !== 'string' ||
        (entry.meta.modifiedDate !== undefined && typeof entry.meta.modifiedDate !== 'string')
    )
        throw new Error('Die Metadaten sind ungültig.');
    return entry;
}
export const categoryPath = (moduleId: number) => {
    if (!Number.isSafeInteger(moduleId) || moduleId <= 0) throw new Error('Ungültiges Modul.');
    return `/custommodules/${moduleId}/customdatacategories`;
};
export const valuePath = (moduleId: number, id: number | null) => {
    if (!Number.isSafeInteger(id) || Number(id) <= 0) throw new Error('Ungültige Umfrage.');
    return `${categoryPath(moduleId)}/${id}/customdatavalues`;
};
export const keys = {
    categories: (id: number) => ['survey', id, 'categories'] as const,
    category: (id: number, category: number | null) => ['survey', id, 'category', category] as const,
    entries: (id: number, category: number | null) => ['survey', id, 'entries', category] as const,
};
export async function fetchCatalog(module: number) {
    const rows = await churchtoolsClient.get<StoredCategory[]>(categoryPath(module));
    const surveys: Survey[] = [],
        issues: DataIssue[] = [];
    for (const row of rows.filter(row => /^survey[_-]/.test(row.shorty))) {
        try {
            surveys.push(readSurvey(row));
        } catch (error) {
            issues.push({
                id: row.id,
                name: row.name,
                message: error instanceof Error ? error.message : 'Ungültige Daten',
                category: row,
            });
        }
    }
    return { surveys, issues };
}
export async function fetchSurveys(module: number) {
    return (await fetchCatalog(module)).surveys;
}
export async function fetchEntryCatalog(module: number, id: number | null, survey?: Survey) {
    const rows = await churchtoolsClient.get<StoredValue[]>(valuePath(module, id));
    const entries: SurveyEntry[] = [],
        issues: DataIssue[] = [];
    for (const row of rows) {
        try {
            const entry = readEntry(row);
            if (entry.dataCategoryId !== id) throw new Error('Der Eintrag gehört zu einer anderen Umfrage.');
            if (survey) {
                const field = survey.fields[0]!;
                if (survey.type === 'max-options-multiple') {
                    if (
                        Object.entries(entry.data).some(
                            ([key, value]) =>
                                typeof value !== 'number' || !field.options.some(option => option.id === key),
                        )
                    )
                        throw new Error('Der Eintrag verweist auf unbekannte Mengenoptionen.');
                } else {
                    const selected = entry.data[field.key];
                    if (
                        !Array.isArray(selected) ||
                        Object.keys(entry.data).some(key => key !== field.key) ||
                        selected.some(id => !field.options.some(option => option.id === id))
                    )
                        throw new Error('Der Eintrag verweist auf unbekannte Auswahloptionen.');
                }
            }
            entries.push(entry);
        } catch (error) {
            issues.push({
                id: row.id,
                name: `Eintrag #${row.id}`,
                message: error instanceof Error ? error.message : 'Ungültige Daten',
            });
        }
    }
    return { entries, issues };
}
export async function fetchEntries(module: number, id: number | null, survey?: Survey) {
    const catalog = await fetchEntryCatalog(module, id, survey ?? (await fetchSurvey(module, id)));
    if (catalog.issues.length)
        throw new Error('Der Bestand enthält ungültige Einträge. Bitte zuerst in der Verwaltung prüfen.');
    return catalog.entries;
}
export async function fetchSurvey(module: number, id: number | null) {
    if (!Number.isSafeInteger(id) || Number(id) <= 0) throw new Error('Ungültige Umfrage.');
    const catalog = await fetchCatalog(module);
    const survey = catalog.surveys.find(row => row.id === id);
    if (!survey)
        throw new Error(
            catalog.issues.find(row => row.id === id)?.message ?? 'Umfrage nicht gefunden oder nicht freigegeben.',
        );
    return survey;
}
