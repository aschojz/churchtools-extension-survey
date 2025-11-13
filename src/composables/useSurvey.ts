import { deleteConfirm } from '@churchtools/styleguide';
import {
    useCustomModuleDataCategoryQuery,
    useCustomModuleDataValuesMutations,
    useCustomModuleDataValuesQuery,
} from '@churchtools/utils';
import { computed, ref, toValue, type MaybeRef } from 'vue';
import type { Survey, SurveyEntry, SurveyEntryNew } from '../utils/types';
import { usePlugin } from './usePlugin';

export function useSurvey(id: MaybeRef<number | null>) {
    const { moduleId } = usePlugin();

    const { createCustomDataValue, deleteCustomDataValue, updateCustomDataValue } =
        toValue(id) !== null
            ? useCustomModuleDataValuesMutations<SurveyEntry>(moduleId, id as MaybeRef<number>)
            : {
                  createCustomDataValue: async () => {},
                  deleteCustomDataValue: async () => {},
                  updateCustomDataValue: async () => {},
              };

    const createSurveyEntry = async (surveyEntry: SurveyEntryNew) => {
        await createCustomDataValue({
            ...surveyEntry,
            dataCategoryId: toValue(id)!,
            meta: {
                createdDate: new Date().toISOString(),
                modifiedDate: undefined,
            },
        });
    };
    const updateSurveyEntry = async (surveyEntry: SurveyEntry & { id: number }) => {
        await updateCustomDataValue({
            dataCategoryId: toValue(id)!,
            ...surveyEntry,
            meta: {
                ...surveyEntry.meta,
                modifiedDate: new Date().toISOString(),
            },
        });
    };

    const { category: survey, isPending } =
        toValue(id) !== null
            ? useCustomModuleDataCategoryQuery<Survey>(moduleId, id as MaybeRef<number>)
            : { category: ref(undefined), isPending: ref(true) };

    const deleteSurveyEntry = async (entryId: number) => {
        const result = await deleteConfirm(`Soll der Eintrag #${entryId} wirklich gelöscht werden?`);
        if (result === 'ok') {
            await deleteCustomDataValue({ dataCategoryId: toValue(id)!, id: entryId });
        }
    };

    const { data } =
        toValue(id) !== null
            ? useCustomModuleDataValuesQuery<SurveyEntry>(moduleId, id as MaybeRef<number>)
            : { data: ref(undefined) };
    const surveyEntries = computed(() => data.value ?? []);

    return { survey, createSurveyEntry, surveyEntries, isPending, deleteSurveyEntry, updateSurveyEntry };
}
