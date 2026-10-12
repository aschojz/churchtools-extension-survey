import { createId } from '../utils/helper';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import {
    categoryPath,
    fetchCatalog,
    fetchEntryCatalog,
    fetchSurvey,
    keys,
    readSurvey,
    type StoredCategory,
} from '../data/ccm';
import { queryClient } from '../data/queryClient';
import { recordChange } from '../data/history';
import { clone, fingerprint, payloadError, surveyPayload } from '../utils/serialization';
import { validateSurvey } from '../utils/validation';
import type { Survey, SurveyNew } from '../utils/types';
import { confirmAction } from './useConfirm';
import { usePlugin } from './usePlugin';
export function useSurveys() {
    const { moduleId } = usePlugin();
    const query = useQuery({
        queryKey: computed(() => keys.categories(moduleId.value)),
        enabled: () => moduleId.value > 0,
        queryFn: () => fetchCatalog(moduleId.value),
    });
    const surveys = computed(() => query.data.value?.surveys ?? []);
    const issues = computed(() => query.data.value?.issues ?? []);
    async function invalidate(module: number) {
        await queryClient.invalidateQueries({ queryKey: ['survey-permissions'] });
        await queryClient.invalidateQueries({ queryKey: keys.categories(module) });
    }
    async function write(survey: SurveyNew & Partial<Survey>) {
        const module = moduleId.value;
        if (!survey.id && survey.sortKey === undefined) {
            const current = await fetchCatalog(module);
            const maximum = current.surveys.length ? Math.max(...current.surveys.map(item => item.sortKey ?? 0)) : 0;
            survey = { ...survey, sortKey: maximum + 1 };
        }
        validateSurvey(survey);
        const body = surveyPayload({
            ...survey,
            shorty: survey.shorty ?? `survey_${createId()}`,
            customModuleId: module,
        });
        const sizeError = payloadError(survey);
        if (sizeError) throw new Error(sizeError);
        const result = survey.id
            ? await churchtoolsClient.put(`${categoryPath(module)}/${survey.id}`, body)
            : await churchtoolsClient.post(categoryPath(module), body);
        await invalidate(module);
        return result;
    }
    async function updateSurvey(change: Partial<Survey> & { id: number }, expected?: Survey) {
        const module = moduleId.value;
        const original = await fetchSurvey(module, change.id);
        if (expected && fingerprint(original) !== fingerprint(expected)) {
            await invalidate(module);
            throw new Error(
                'Die Umfrage wurde inzwischen geändert. Dein Entwurf bleibt erhalten. Lade den aktuellen Stand und übernimm deine Änderungen erneut.',
            );
        }
        // Never replace the fresh JSON with stale list-cache fields.
        const next = { ...original, ...clone(change) };
        for (const field of original.fields)
            for (const option of field.options) {
                if (!next.fields.some(candidate => candidate.options.some(item => item.id === option.id)))
                    throw new Error(
                        'Bestehende Optionen können nur archiviert werden, damit Antworten erhalten bleiben.',
                    );
            }
        const result = await write(next);
        const after = surveys.value.find(item => item.id === change.id) ?? (await fetchSurvey(module, change.id));
        recordChange({
            module,
            category: change.id,
            entity: 'survey',
            title: `Umfrage „${after.name}“ geändert`,
            before: original,
            after,
        });
        return result;
    }
    async function deleteSurvey(id: number) {
        const module = moduleId.value;
        const name = surveys.value.find(row => row.id === id)?.name ?? issues.value.find(row => row.id === id)?.name;
        if (!(await confirmAction(`Umfrage „${name ?? `#${id}`}“ und alle ihre Einträge endgültig löschen?`))) return;
        await churchtoolsClient.deleteApi(`${categoryPath(module)}/${id}?dry_run=false`);
        await invalidate(module);
        queryClient.removeQueries({ queryKey: keys.entries(module, id) });
    }
    async function repairSurvey(expected: StoredCategory, data: string) {
        const module = moduleId.value;
        const rows = await churchtoolsClient.get<StoredCategory[]>(categoryPath(module));
        const current = rows.find(row => row.id === expected.id);
        if (!current || fingerprint(current) !== fingerprint(expected))
            throw new Error('Die gespeicherten Daten wurden inzwischen geändert. Bitte die Übersicht neu laden.');
        const repaired = readSurvey({ ...current, data });
        validateSurvey(repaired);
        const entries = await fetchEntryCatalog(module, current.id, repaired);
        if (entries.issues.length)
            throw new Error(`Die Korrektur passt nicht zu vorhandenen Antworten: ${entries.issues[0]!.message}`);
        await write(repaired);
    }
    return { ...query, surveys, issues, createSurvey: write, updateSurvey, deleteSurvey, repairSurvey };
}
