import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRef } from 'vue';
import { fetchCatalog, fetchEntryCatalog, fetchEntries, fetchSurvey, keys, valuePath } from '../data/ccm';
import { queryClient } from '../data/queryClient';
import { recordChange } from '../data/history';
import { clone, fingerprint } from '../utils/serialization';
import { validateEntry } from '../utils/validation';
import type { SurveyEntry, SurveyEntryNew } from '../utils/types';
import { confirmAction } from './useConfirm';
import { usePlugin } from './usePlugin';
export function useSurvey(id: MaybeRef<number | null>, hideData?: boolean) {
    const { moduleId } = usePlugin();
    const validId = () => Number.isSafeInteger(toValue(id)) && Number(toValue(id)) > 0;
    const query = useQuery({
        queryKey: computed(() => keys.categories(moduleId.value)),
        enabled: () => moduleId.value > 0 && validId(),
        queryFn: () => fetchCatalog(moduleId.value),
    });
    const survey = computed(() =>
        validId() ? query.data.value?.surveys.find(item => item.id === toValue(id)) : undefined,
    );
    const error = computed(() =>
        !validId()
            ? new Error('Ungültige Umfrage.')
            : (query.error.value ??
              (!query.isPending.value && !survey.value
                  ? new Error(
                        query.data.value?.issues.find(item => item.id === toValue(id))?.message ??
                            'Umfrage nicht gefunden oder nicht freigegeben.',
                    )
                  : null)),
    );
    const isPending = computed(() => validId() && query.isPending.value);
    const hidden = () => hideData ?? survey.value?.hideDataFromParticipants ?? false;
    const entriesQuery = useQuery({
        queryKey: computed(() => keys.entries(moduleId.value, toValue(id))),
        enabled: () => moduleId.value > 0 && !!survey.value && !hidden(),
        queryFn: () => fetchEntryCatalog(moduleId.value, toValue(id), survey.value),
    });
    // Hide cached personal data too when an observer explicitly requests privacy.
    const surveyEntries = computed(() => (hidden() ? [] : (entriesQuery.data.value?.entries ?? [])));
    const invalidateEntries = () =>
        queryClient.invalidateQueries({ queryKey: keys.entries(moduleId.value, toValue(id)) });
    async function save(
        entry: SurveyEntryNew & Partial<Pick<SurveyEntry, 'id' | 'status' | 'meta' | 'dataCategoryId'>>,
        mode: 'participate' | 'admin' | 'edit' = 'admin',
        expected?: SurveyEntry,
    ) {
        const module = moduleId.value,
            category = toValue(id);
        const snapshot = clone(entry);
        const current = await fetchSurvey(module, category);
        const entries = await fetchEntries(module, category, current);
        const original = snapshot.id ? entries.find(item => item.id === snapshot.id) : undefined;
        const cachedOriginal = expected ?? entriesQuery.data.value?.entries.find(item => item.id === snapshot.id);
        if (
            snapshot.id &&
            (!original ||
                (cachedOriginal
                    ? fingerprint(original) !== fingerprint(cachedOriginal)
                    : fingerprint(original.meta) !== fingerprint(snapshot.meta)))
        )
            throw new Error('Dieser Eintrag wurde inzwischen geändert. Lade ihn erneut, bevor du speicherst.');
        validateEntry(
            current,
            snapshot,
            entries.filter(item => item.id !== snapshot.id),
            new Date(),
            mode,
            snapshot.status === 'cancelled',
        );
        const { id: entryId, dataCategoryId, meta, ...value } = snapshot;
        void dataCategoryId;
        const serialized = JSON.stringify({
            ...value,
            status: value.status ?? 'new',
            meta: {
                createdDate: meta?.createdDate ?? new Date().toISOString(),
                ...(entryId ? { modifiedDate: new Date().toISOString() } : {}),
            },
        });
        if (Array.from(serialized).length > 10000)
            throw new Error('Der Eintrag ist zu lang. Bitte den Kommentar kürzen.');
        const body = { ...(entryId ? { id: entryId } : {}), dataCategoryId: category, value: serialized };
        const path = valuePath(module, category);
        const result = entryId
            ? await churchtoolsClient.put(`${path}/${entryId}`, body)
            : await churchtoolsClient.post(path, body);
        await queryClient.invalidateQueries({ queryKey: keys.entries(module, category) });
        if (original)
            recordChange({
                module,
                category: Number(category),
                entity: 'entry',
                title: `Eintrag „${value.name}“ geändert`,
                before: original,
                after: { ...JSON.parse(serialized), id: entryId, dataCategoryId: category } as SurveyEntry,
            });
        return result;
    }
    async function deleteSurveyEntry(entryId: number) {
        const module = moduleId.value,
            category = toValue(id);
        if (!(await confirmAction(`Eintrag #${entryId} endgültig löschen?`))) return;
        await churchtoolsClient.deleteApi(`${valuePath(module, category)}/${entryId}`);
        await queryClient.invalidateQueries({ queryKey: keys.entries(module, category) });
    }
    return {
        ...query,
        survey,
        error,
        isPending,
        moduleId,
        surveyEntries,
        entriesPending: computed(() => !hidden() && entriesQuery.isPending.value),
        entriesError: entriesQuery.error,
        entriesIssues: computed(() => (hidden() ? [] : (entriesQuery.data.value?.issues ?? []))),
        refetchEntries: entriesQuery.refetch,
        createSurveyEntry: (entry: SurveyEntryNew) => save(entry, 'participate'),
        updateSurveyEntry: save,
        deleteSurveyEntry,
        invalidateEntries,
    };
}
