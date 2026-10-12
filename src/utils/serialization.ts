import type { Survey, SurveyNew } from './types';
export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
export function fingerprint(value: unknown): string {
    function sorted(input: unknown): unknown {
        if (Array.isArray(input)) return input.map(sorted);
        if (input && typeof input === 'object')
            return Object.fromEntries(
                Object.entries(input)
                    .filter(([, v]) => v !== undefined)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => [k, sorted(v)]),
            );
        return input;
    }
    return JSON.stringify(sorted(value)) ?? 'undefined';
}
export function surveyPayload(survey: SurveyNew & Partial<Survey>, modified = new Date().toISOString()) {
    const { id, name, shorty, description, customModuleId, meta, ...data } = survey;
    return {
        ...(id ? { id } : {}),
        name: name.trim(),
        description: description ?? '',
        shorty,
        customModuleId,
        data: JSON.stringify({
            ...data,
            schemaVersion: 1,
            meta: { createdDate: meta?.createdDate ?? modified, ...(id ? { modifiedDate: modified } : {}) },
        }),
    };
}
export function payloadError(survey: SurveyNew & Partial<Survey>): string | undefined {
    const body = surveyPayload(survey);
    if (body.name.length > 100) return 'Der Name darf höchstens 100 Zeichen enthalten.';
    if (body.description.length > 300) return 'Die interne Beschreibung darf höchstens 300 Zeichen enthalten.';
    if (Array.from(body.data).length > 2000)
        return `Die Umfrage ist zu groß (${Array.from(body.data).length}/2.000 Zeichen). Kürze Beschreibungen oder entferne ungenutzte Optionen.`;
}
