import type { Survey, SurveyEntry } from './types';
import { optionLabel, entryStatusLabels } from './export';

export type TransferPerson = {
    id: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    emails?: { email: string }[];
    isArchived?: boolean;
};
export type NewPerson = {
    firstName: string;
    lastName: string;
    email: string;
    privacyPolicyAgreementDate?: string;
    privacyPolicyAgreementTypeId?: number;
    privacyPolicyAgreementWhoId?: number;
};
export type PersonResolution = {
    entryId: number;
    mode: 'unresolved' | 'existing' | 'new' | 'skip';
    person?: TransferPerson;
    create: NewPerson;
};
export type FieldPlan = {
    key: string;
    name: string;
    fieldTypeCode: 'select' | 'multiselect' | 'number' | 'textarea';
    options: { sourceId: string; name: string }[];
};
export type TransferValue = string | number | string[];
export type TransferMember = {
    entryId: number;
    person?: TransferPerson;
    create?: NewPerson;
    values: Record<string, TransferValue>;
};
export type TransferPlan = {
    name: string;
    description: string;
    fields: FieldPlan[];
    members: TransferMember[];
    skipped: number;
};

// Names are made unique before sending them: ChurchTools deduplicates equal option names.
export function planFields(survey: Survey): FieldPlan[] {
    const field = survey.fields[0]!;
    const usedLabels = new Set<string>();
    const options = field.options.map((option, index) => {
        const base = `${optionLabel(survey, option).trim().slice(0, 460)}${option.archived ? ' (archiviert)' : ''}`;
        let name = base;
        while (usedLabels.has(name)) name += ` [${index + 1}]`;
        usedLabels.add(name);
        return { sourceId: option.id, name };
    });
    const result: FieldPlan[] =
        survey.type === 'max-options-multiple'
            ? options.map((option, index) => ({
                  key: `quantity-${index}`,
                  name: `${option.name.slice(0, 80)} – Menge`,
                  fieldTypeCode: 'number',
                  options: [{ ...option }],
              }))
            : [
                  {
                      key: 'selection',
                      name: (field.nameTranslated?.trim() || 'Auswahl').slice(0, 100),
                      fieldTypeCode: field.fieldTypeCode,
                      options,
                  },
              ];
    if (survey.allowComments)
        result.push({ key: 'comments', name: 'Umfrage – Kommentare', fieldTypeCode: 'textarea', options: [] });
    if (survey.type.startsWith('max-options'))
        result.push({
            key: 'status',
            name: 'Umfrage – Ausgabestatus',
            fieldTypeCode: 'select',
            options: ['new', 'completed'].map(status => ({
                sourceId: status,
                name: entryStatusLabels(survey)[status as 'new' | 'completed'],
            })),
        });
    // Prefixes also avoid collisions with a survey field called "Umfrage – Kommentare".
    return result.map((item, index) => ({ ...item, name: `${index + 1}. ${item.name}`.trim().slice(0, 100) }));
}
export function valuesForEntry(survey: Survey, entry: SurveyEntry, fields: FieldPlan[]): Record<string, TransferValue> {
    const result: Record<string, TransferValue> = {};
    for (const field of fields) {
        if (field.key.startsWith('quantity-')) result[field.key] = Number(entry.data[field.options[0]!.sourceId] ?? 0);
        else if (field.key === 'comments')
            result[field.key] = (entry.comments ?? []).map(item => item.comment).join('\n');
        else if (field.key === 'status') result[field.key] = entry.status;
        else {
            const selected = entry.data[survey.fields[0]!.key];
            if (!Array.isArray(selected)) throw new Error(`Eintrag #${entry.id}: Ungültige Auswahl.`);
            if (field.fieldTypeCode === 'select' && selected.length > 1)
                throw new Error(`Eintrag #${entry.id}: Mehrere Antworten in einer Einfachauswahl.`);
            result[field.key] = field.fieldTypeCode === 'select' ? (selected[0] ?? '') : selected;
        }
        const value = result[field.key];
        if (typeof value === 'string' && value.length > 4000)
            throw new Error(`Eintrag #${entry.id}: Kommentar überschreitet 4.000 Zeichen.`);
        if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0))
            throw new Error(`Eintrag #${entry.id}: Ungültige Menge.`);
        if (field.options.length && field.fieldTypeCode !== 'number') {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            if (ids.some(id => !field.options.some(option => option.sourceId === id)))
                throw new Error(`Eintrag #${entry.id}: Unbekannte Auswahl.`);
        }
    }
    return result;
}
export function buildTransferPlan(
    survey: Survey,
    entries: SurveyEntry[],
    resolutions: PersonResolution[],
    privacyRequired: boolean,
): TransferPlan {
    if (survey.isActive && (!survey.endDate || new Date(survey.endDate).getTime() > Date.now()))
        throw new Error('Die Umfrage muss zuerst beendet oder deaktiviert werden.');
    const fields = planFields(survey);
    const active = entries.filter(entry => entry.status !== 'cancelled');
    const seen = new Set<string>();
    const members: TransferMember[] = [];
    for (const entry of active) {
        const resolution = resolutions.find(item => item.entryId === entry.id);
        if (resolution?.mode === 'skip') continue;
        if (!resolution || resolution.mode === 'unresolved')
            throw new Error(`Person für „${entry.name}“ bitte zuordnen oder überspringen.`);
        if (resolution.mode === 'existing' && (!resolution.person?.id || resolution.person.isArchived))
            throw new Error(`Person für „${entry.name}“ ist nicht verfügbar.`);
        const create = {
            ...resolution.create,
            firstName: resolution.create.firstName.trim(),
            lastName: resolution.create.lastName.trim(),
            email: resolution.create.email.trim(),
        };
        if (resolution.mode === 'new') {
            if (!create.firstName || !create.lastName) throw new Error(`Vor- und Nachname für „${entry.name}“ fehlen.`);
            if (create.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(create.email))
                throw new Error(`E-Mail-Adresse für „${entry.name}“ ist ungültig.`);
            const agreement = [
                create.privacyPolicyAgreementDate,
                create.privacyPolicyAgreementTypeId,
                create.privacyPolicyAgreementWhoId,
            ];
            if ((privacyRequired || agreement.some(Boolean)) && !agreement.every(Boolean))
                throw new Error(`Datenschutzangaben für „${entry.name}“ sind unvollständig.`);
        }
        const identities =
            resolution.mode === 'existing'
                ? [`id:${resolution.person!.id}`]
                : [
                      `name:${create.firstName.toLocaleLowerCase()} ${create.lastName.toLocaleLowerCase()}`,
                      ...(create.email ? [`email:${create.email.toLocaleLowerCase()}`] : []),
                  ];
        if (identities.some(key => seen.has(key)))
            throw new Error(
                `Mehrere Antworten derselben Person („${entry.name}“): Bitte einen Eintrag auswählen und die übrigen überspringen.`,
            );
        identities.forEach(key => seen.add(key));
        members.push({
            entryId: entry.id,
            ...(resolution.mode === 'existing' ? { person: { ...resolution.person! } } : { create }),
            values: valuesForEntry(survey, entry, fields),
        });
    }
    if (!members.length) throw new Error('Mindestens eine Antwort muss übernommen werden.');
    // Existing comments must survive even if comments were disabled after participation.
    if (
        !survey.allowComments &&
        members.some(member => entries.find(entry => entry.id === member.entryId)?.comments?.length)
    ) {
        const comments: FieldPlan = {
            key: 'comments',
            name: `${fields.length + 1}. Umfrage – Kommentare`,
            fieldTypeCode: 'textarea',
            options: [],
        };
        fields.push(comments);
        for (const member of members)
            Object.assign(
                member.values,
                valuesForEntry(
                    survey,
                    entries.find(entry => entry.id === member.entryId)!,
                    [comments],
                ),
            );
    }
    return {
        name: survey.name,
        description: survey.surveyDescription || survey.description || '',
        fields,
        members,
        skipped: entries.length - members.length,
    };
}
export function exactEmailMatches(people: TransferPerson[], email?: string) {
    const normalized = email?.trim().toLowerCase();
    return normalized
        ? people.filter(
              person =>
                  !person.isArchived &&
                  [person.email, ...(person.emails ?? []).map(item => item.email)].some(
                      address => address?.trim().toLowerCase() === normalized,
                  ),
          )
        : [];
}
export function displayTransferValue(field: FieldPlan, value: TransferValue) {
    if (field.fieldTypeCode === 'number' || field.fieldTypeCode === 'textarea') return String(value);
    return (Array.isArray(value) ? value : value ? [value] : [])
        .map(id => field.options.find(option => option.sourceId === id)?.name ?? String(id))
        .join(', ');
}
