import { deleteConfirm } from '@churchtools/styleguide';
import {
    useCustomModuleDataCategoriesQuery,
    useCustomModuleDataCategoryMutations,
    useToasts,
} from '@churchtools/utils';
import { computed } from 'vue';
import type { Survey, SurveyNew } from '../utils/types';
import { usePlugin } from './usePlugin';

export function useSurveys() {
    const { successToast } = useToasts();
    const { moduleId } = usePlugin();
    const { createDataCategory, deleteDataCategory, updateDataCategory } =
        useCustomModuleDataCategoryMutations<Survey>(moduleId);

    const { data, isPending } = useCustomModuleDataCategoriesQuery<Survey>(moduleId);
    const surveys = computed(() => (data.value ?? []).filter(survey => survey.shorty?.startsWith('survey_')));
    const surveysMap = computed(() => Object.fromEntries(surveys.value.map(survey => [survey.id, survey])));

    const createSurvey = async (survey: SurveyNew) => {
        const lastId = surveys.value[surveys.value.length - 1]?.id ?? 0;
        await createDataCategory({
            ...survey,
            description: survey.description ?? '',
            customModuleId: moduleId.value!,
            shorty: `survey_${lastId + 3}`,
            meta: {
                createdDate: new Date().toISOString(),
                modifiedDate: undefined,
            },
        });
        successToast('Umfrage erstellt');
    };

    const updateSurvey = async (survey: Partial<Survey> & { id: number }) => {
        const originalSurvey = surveysMap.value[survey.id];
        updateDataCategory({ ...originalSurvey, ...survey });
    };

    const deleteSurvey = async (surveyId: number) => {
        await deleteConfirm(`Soll die Umfrage #${surveyId} wirklich gelöscht werden?`);
        await deleteDataCategory(surveyId);
        successToast('Umfrage gelöscht');
    };

    return { surveys, surveysMap, createSurvey, deleteSurvey, isPending, updateSurvey };
}
