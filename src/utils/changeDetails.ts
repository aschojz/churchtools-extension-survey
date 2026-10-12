import type { Change } from '../data/history';
import type { Survey, SurveyEntry } from './types';
import { fingerprint } from './serialization';
import { entryLabels, entryStatusLabels, dateLabel } from './export';
const names: Record<string, string> = {
    name: 'Name',
    description: 'Interne Beschreibung',
    surveyDescription: 'Teilnehmerbeschreibung',
    isActive: 'Teilnahme aktiv',
    isListed: 'Öffentlich gelistet',
    allowComments: 'Kommentare',
    askForMail: 'E-Mail abfragen',
    hideDataFromParticipants: 'Teilnehmerdaten verbergen',
    startDate: 'Öffnung',
    endDate: 'Schließung',
    fields: 'Optionen',
    sortKey: 'Sortierreihenfolge',
    imageUrl: 'Bild',
    data: 'Auswahl',
    status: 'Status',
    email: 'E-Mail',
    comments: 'Kommentare',
    personId: 'ChurchTools-Person',
};
export function changeDetails(change: Change, survey?: Survey) {
    const before = change.before as unknown as Record<string, unknown>,
        after = change.after as unknown as Record<string, unknown>;
    function text(key: string, value: unknown, snapshot: Record<string, unknown>): string {
        if (value === undefined || value === null || value === '') return '–';
        if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
        if (key === 'startDate' || key === 'endDate') return dateLabel(String(value));
        if (key === 'status') return entryStatusLabels(survey)[value as SurveyEntry['status']] ?? String(value);
        if (key === 'data' && survey)
            return entryLabels(survey, snapshot as unknown as SurveyEntry).join(', ') || 'Keine Auswahl';
        if (key === 'fields') {
            const field = (snapshot as unknown as Survey).fields[0]!;
            return (
                `${field.fieldTypeCode === 'multiselect' ? 'Mehrfachauswahl' : 'Einfachauswahl'} · ` +
                field.options
                    .map(
                        option =>
                            `${option.nameTranslated}${option.description ? `: ${option.description}` : ''}${option.archived ? ' (archiviert)' : ''} · Kapazität ${option.maxCount ?? 'unbegrenzt'} · pro Person ${option.maxSelectable ?? 'unbegrenzt'}`,
                    )
                    .join('; ')
            );
        }
        if (key === 'comments') return (value as SurveyEntry['comments'])?.map(item => item.comment).join('\n') || '–';
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(key => names[key] && fingerprint(before[key]) !== fingerprint(after[key]))
        .map(key => ({
            field: names[key]!,
            before: text(key, before[key], before),
            after: text(key, after[key], after),
        }));
}
