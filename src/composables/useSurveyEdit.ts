import { editFormData } from '@churchtools/styleguide';
import type { UniformedField } from '@churchtools/utils';
import { SurveyType, type Survey, type SurveyOptionNew } from '../utils/types';

export function useSurveyEdit() {
    const createOrEditOption = async (survey: Survey, option?: SurveyOptionNew) => {
        const fields: UniformedField[] = [];
        if (survey.type === SurveyType.BEST_DATE) {
            fields.push({
                key: 'nameTranslated',
                fieldTypeCode: 'datetime',
                nameTranslated: 'Datum',
                required: true,
                validatorId: 'datetime',
            });
        } else {
            fields.push({ key: 'nameTranslated', fieldTypeCode: 'text', nameTranslated: 'Titel', required: true });
        }
        fields.push({ key: 'description', fieldTypeCode: 'textarea', nameTranslated: 'Beschreibung' });
        if (survey.type === SurveyType.MAX_OPTIONS || survey.type === SurveyType.MAX_OPTIONS_MULTIPLE) {
            fields.push({
                key: 'maxCount',
                fieldTypeCode: 'number',
                nameTranslated: 'Maximale Anzahl',
                validatorId: 'integer',
            });
        }
        if (survey.type === SurveyType.MAX_OPTIONS_MULTIPLE) {
            fields.push({
                key: 'maxSelectable',
                fieldTypeCode: 'number',
                nameTranslated: 'Maximal auswählbar',
                validatorId: 'integer',
            });
        }
        const result = await editFormData({
            context: 'Umfrage erstellen',
            headline: { title: 'Option hinzufügen' },
            fields,
            formData: option,
        });
        if (result) {
            return {
                ...result,
                id: result.nameTranslated.toString().replace(/\W/g, '_'),
            } as SurveyOptionNew;
        }
    };

    return { createOrEditOption };
}
