import type { LinkItem } from '@churchtools/styleguide';
import type { MaybeRef } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import type { SurveyEntry } from '../utils/types';

export function useSurveyHelper(id: MaybeRef<number | null>) {
    const { deleteSurveyEntry } = useSurvey(id);

    const entryActions = (entry: SurveyEntry & { id: number }): LinkItem['actions'] => [
        {
            type: 'dropdown',
            sections: [
                {
                    items: [
                        {
                            id: 'delete',
                            icon: 'fas fa-trash-alt',
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

    return { entryActions };
}
