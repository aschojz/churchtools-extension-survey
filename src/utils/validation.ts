import type { SurveyEntry, SurveyEntryNew, SurveyNew, SurveyOptionNew } from './types';
import { payloadError } from './serialization';
import { getEntryDataValue } from '../survey/helper';
export class EntryValidationError extends Error {
    constructor(
        message: string,
        public field: string,
    ) {
        super(message);
        this.name = 'EntryValidationError';
    }
}
export function optionCount(survey: SurveyNew, entries: SurveyEntry[], option: SurveyOptionNew): number {
    const key = survey.fields[0]?.key;
    return entries
        .filter(entry => entry.status !== 'cancelled')
        .reduce(
            (total, entry) =>
                total +
                (survey.type === 'max-options-multiple'
                    ? typeof entry.data[option.id] === 'number'
                        ? Number(entry.data[option.id])
                        : 0
                    : Number(getEntryDataValue(entry.data, key).includes(option.id))),
            0,
        );
}
export function validateSurvey(survey: SurveyNew) {
    const sizeError = payloadError(survey);
    if (sizeError) throw new Error(sizeError);
    if (!survey.name.trim()) throw new Error('Bitte einen Namen eingeben.');
    if (!survey.fields[0]?.options.some(option => !option.archived))
        throw new Error('Bitte mindestens eine Option hinzufügen.');
    if (new Set(survey.fields[0].options.map(o => o.id)).size !== survey.fields[0].options.length)
        throw new Error('Optionen müssen eindeutige IDs haben.');
    if (survey.startDate && survey.endDate && new Date(survey.startDate) >= new Date(survey.endDate))
        throw new Error('Das Schließdatum muss nach dem Öffnungsdatum liegen.');
    if (survey.sortKey !== undefined && !Number.isFinite(survey.sortKey))
        throw new Error('Bitte eine gültige Sortierreihenfolge eingeben.');
    for (const date of [survey.startDate, survey.endDate])
        if (date && !Number.isFinite(new Date(date).getTime())) throw new Error('Ungültiges Datum.');
    for (const option of survey.fields[0].options) {
        if (!option.nameTranslated.trim()) throw new Error('Optionen benötigen einen Titel.');
        if (survey.type === 'best-date' && !Number.isFinite(new Date(option.nameTranslated).getTime()))
            throw new Error('Alle Optionen müssen gültige Termine enthalten.');
        for (const limit of [option.maxCount, option.maxSelectable])
            if (limit != null && (!Number.isSafeInteger(limit) || limit < 1))
                throw new Error('Grenzen müssen positive ganze Zahlen sein.');
    }
}
export function validateEntry(
    survey: SurveyNew,
    entry: SurveyEntryNew,
    entries: SurveyEntry[],
    now = new Date(),
    mode: 'participate' | 'admin' | 'edit' = 'participate',
    cancelled = false,
) {
    if (
        mode !== 'admin' &&
        (!survey.isActive ||
            (survey.startDate && now < new Date(survey.startDate)) ||
            (survey.endDate && now >= new Date(survey.endDate)))
    )
        throw new Error('Die Umfrage ist inzwischen geschlossen.');
    if (!entry.name.trim()) throw new EntryValidationError('Bitte einen Namen eingeben.', 'name');
    if (!cancelled && survey.askForMail && (!entry.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)))
        throw new EntryValidationError('Bitte eine gültige E-Mail-Adresse eingeben.', 'email');
    if (
        !cancelled &&
        entries.some(
            e =>
                e.status !== 'cancelled' && e.name.trim().toLocaleLowerCase() === entry.name.trim().toLocaleLowerCase(),
        )
    )
        throw new EntryValidationError('Ein Eintrag mit diesem Namen existiert bereits.', 'name');
    const field = survey.fields[0];
    if (!field) throw new Error('Diese Umfrage hat keine Optionen.');
    if (survey.type === 'max-options-multiple') {
        let total = 0;
        for (const [key, count] of Object.entries(entry.data)) {
            const option = field.options.find(o => o.id === key);
            if (
                !option ||
                (option.archived && typeof count === 'number' && count > 0 && mode === 'participate') ||
                typeof count !== 'number' ||
                !Number.isSafeInteger(count) ||
                count < 0
            )
                throw new EntryValidationError('Bitte gültige ganze Mengen auswählen.', `data.${key}`);
            if (!cancelled && option.maxSelectable != null && option.maxSelectable > 0 && count > option.maxSelectable)
                throw new EntryValidationError(
                    `Für „${option.nameTranslated}“ sind höchstens ${option.maxSelectable} pro Person möglich.`,
                    `data.${key}`,
                );
            if (
                !cancelled &&
                option.maxCount != null &&
                option.maxCount > 0 &&
                optionCount(survey, entries, option) + count > option.maxCount
            )
                throw new EntryValidationError(
                    `Für „${option.nameTranslated}“ sind nicht mehr genügend Mengen verfügbar.`,
                    `data.${key}`,
                );
            total += count;
        }
        if (total < 1) throw new Error('Bitte mindestens eine Menge auswählen.');
    } else {
        const selection = getEntryDataValue(entry.data, field.key);
        if (
            !selection.length ||
            (field.fieldTypeCode === 'select' && selection.length !== 1) ||
            new Set(selection).size !== selection.length
        )
            throw new Error('Bitte eine gültige Auswahl treffen.');
        for (const id of selection) {
            const option = field.options.find(o => o.id === id);
            if (!option || (option.archived && mode === 'participate'))
                throw new Error('Die gewählte Option ist nicht mehr verfügbar.');
            if (
                !cancelled &&
                survey.type === 'max-options' &&
                option.maxCount != null &&
                option.maxCount > 0 &&
                optionCount(survey, entries, option) >= option.maxCount
            )
                throw new Error(`„${option.nameTranslated}“ ist inzwischen ausgebucht.`);
        }
    }
}
