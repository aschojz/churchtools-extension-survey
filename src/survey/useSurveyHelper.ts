import { editFormData, type LinkItem } from '@churchtools/styleguide';
import type { MaybeRef } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import type { SurveyEntry } from '../utils/types';

export function useSurveyHelper(id: MaybeRef<number | null>) {
    const { deleteSurveyEntry, updateSurveyEntry } = useSurvey(id);

    const entryActions = (entry: SurveyEntry & { id: number }): LinkItem['actions'] => [
        {
            type: 'dropdown',
            sections: [
                {
                    items: [
                        {
                            id: 'edit',
                            icon: 'fas fa-pen',
                            nameTranslated: 'Eintrag bearbeiten',
                            callback: () => {
                                editSurveyEntry(entry);
                            },
                        },
                        {
                            id: 'delete',
                            icon: { icon: 'fas fa-trash-alt', class: 'text-red-bright' },
                            nameTranslated: 'Eintrag löschen',
                            callback: () => {
                                deleteSurveyEntry(entry.id);
                            },
                        },
                    ],
                },
            ],
        },
    ];

    const editSurveyEntry = async (entry: SurveyEntry & { id: number }) => {
        const result = await editFormData({
            context: 'Bearbeiten',
            fields: [],
            formData: entry,
        });
        if (result) {
            updateSurveyEntry({ ...entry, ...result });
        }
    };

    return { entryActions, editSurveyEntry };
}
