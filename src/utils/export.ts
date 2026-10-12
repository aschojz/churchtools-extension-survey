import type { Survey, SurveyEntry } from './types';
import { optionCount } from './validation';
import { getEntryDataValue } from '../survey/helper';
export function optionLabel(survey: Pick<Survey, 'type'>, option: { nameTranslated: string }) {
    return survey.type === 'best-date'
        ? new Date(option.nameTranslated).toLocaleString('de-DE', {
              weekday: 'short',
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : option.nameTranslated;
}
export function dateLabel(value?: string) {
    return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('de-DE') : 'Datum unbekannt';
}
export const statusLabels = { new: 'Neu', completed: 'Ausgegeben', cancelled: 'Zurückgebracht / storniert' };
export function entryStatusLabels(survey?: Pick<Survey, 'type'>) {
    return survey?.type.startsWith('max-options')
        ? { new: 'Reserviert', completed: 'Ausgegeben', cancelled: 'Zurückgebracht / storniert' }
        : { new: 'Aktiv', completed: 'Aktiv', cancelled: 'Zurückgezogen' };
}
export function entryLabels(survey: Pick<Survey, 'type' | 'fields'>, entry: Pick<SurveyEntry, 'data'>) {
    const field = survey.fields[0]!;
    return field.options
        .filter(option =>
            survey.type === 'max-options-multiple'
                ? Number(entry.data[option.id]) > 0
                : getEntryDataValue(entry.data, field.key).includes(option.id),
        )
        .map(
            option =>
                `${survey.type === 'max-options-multiple' ? `${entry.data[option.id]} × ` : ''}${optionLabel(survey, option)}${option.archived ? ' (archiviert)' : ''}`,
        );
}
export function resultsCsv(survey: Survey, entries: SurveyEntry[]) {
    const active = entries.filter(entry => entry.status !== 'cancelled');
    const limited = survey.type.startsWith('max-options');
    const options = survey.fields[0]!.options.map(option => ({
        option,
        count: optionCount(survey, entries, option),
    })).sort(
        (a, b) => b.count - a.count || optionLabel(survey, a.option).localeCompare(optionLabel(survey, b.option), 'de'),
    );
    return csvRows([
        [
            'Rang',
            'Option',
            'Archiviert',
            limited ? 'Belegte Einheiten' : 'Stimmen',
            'Aktive Antworten',
            'Anteil in %',
            'Kapazität',
            'Verfügbar',
        ],
        ...options.map(({ option, count }, index) => [
            index + 1,
            optionLabel(survey, option),
            option.archived ? 'Ja' : 'Nein',
            count,
            active.length,
            limited ? '' : active.length ? Math.round((count / active.length) * 100) : 0,
            limited ? (option.maxCount ?? 'Unbegrenzt') : '',
            limited && option.maxCount ? Math.max(0, option.maxCount - count) : '',
        ]),
    ]);
}
export function surveyCsv(survey: Survey, entries: SurveyEntry[]): string {
    const field = survey.fields[0]!;
    const rows: (string | number)[][] = [
        [
            'Eintrag-ID',
            'Name',
            'E-Mail',
            'Person-ID',
            'Status',
            'Erstellt',
            ...field.options.map(option => optionLabel(survey, option) + (option.archived ? ' (archiviert)' : '')),
            'Kommentare',
        ],
    ];
    for (const entry of entries)
        rows.push([
            entry.id,
            entry.name,
            entry.email ?? '',
            entry.personId ?? '',
            entryStatusLabels(survey)[entry.status ?? 'new'],
            dateLabel(entry.meta.createdDate),
            ...field.options.map(option =>
                survey.type === 'max-options-multiple'
                    ? Number(entry.data[option.id] ?? 0)
                    : Number(getEntryDataValue(entry.data, field.key).includes(option.id)),
            ),
            (entry.comments ?? []).map(comment => comment.comment).join('\n'),
        ]);
    return csvRows(rows);
}
function csvRows(rows: (string | number)[][]) {
    return (
        '\ufeff' +
        rows
            .map(row =>
                row
                    .map(value => {
                        // Prevent spreadsheet formulas in participant-controlled text.
                        const text = String(value);
                        const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
                        return `"${safe.replaceAll('"', '""')}"`;
                    })
                    .join(';'),
            )
            .join('\r\n')
    );
}
export function downloadCsv(survey: Survey, entries: SurveyEntry[], mode: 'answers' | 'results' = 'answers') {
    const url = URL.createObjectURL(
        new Blob([mode === 'results' ? resultsCsv(survey, entries) : surveyCsv(survey, entries)], {
            type: 'text/csv;charset=utf-8',
        }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `umfrage-${mode === 'results' ? 'ergebnisse' : 'antworten'}-${survey.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
