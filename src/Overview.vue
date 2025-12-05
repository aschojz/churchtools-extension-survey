<script setup lang="ts">
import {
    ContentWrapper,
    editFormData,
    Grid,
    GridHeader,
    SectionedCard,
    sortItems,
    type LinkItem,
} from '@churchtools/styleguide';
import { CtColor, omit, usePermissions } from '@churchtools/utils';
import { sortBy } from 'lodash-es';
import { computed } from 'vue';
import { useSurveys } from './composables/useSurveys';
import { typeDefinitions } from './utils/helper';
import { encodeId } from './utils/tokenHelper';

const { surveys, deleteSurvey, createSurvey, updateSurvey } = useSurveys();
const items = computed(() =>
    sortBy(surveys.value, ['sortKey'])
        .filter(survey => userAllowed('survey', 'edit custom category', survey.id))
        .map(survey => {
            const actions: LinkItem['actions'] = [
                {
                    type: 'button',
                    icon: 'fas fa-eye',
                    label: 'Vorschau',
                    href: `${window.location.origin}/ccm/survey/form/${encodeId(survey.id)}`,
                    target: '_blank',
                },
            ];
            if (userAllowed('survey', 'delete custom category')) {
                actions.push({
                    type: 'dropdown',
                    sections: [
                        {
                            items: [
                                {
                                    id: 'duplicate',
                                    icon: { icon: 'fas fa-copy' },
                                    nameTranslated: 'Duplizieren',
                                    callback: async () => {
                                        await editFormData({
                                            context: 'Umfragen',
                                            fields: [
                                                {
                                                    key: 'name',
                                                    nameTranslated: 'Name',
                                                    fieldTypeCode: 'text',
                                                    required: true,
                                                },
                                            ],
                                            formData: {
                                                name: `${survey.name} (Kopie)`,
                                            },
                                            saveFunction: async data => {
                                                await createSurvey({
                                                    ...survey,
                                                    id: undefined,
                                                    name: data.name,
                                                });
                                            },
                                        });
                                    },
                                },
                                {
                                    id: 'delete',
                                    icon: { icon: 'fas fa-trash-alt', class: 'text-red-bright' },
                                    nameTranslated: 'Löschen',
                                    callback: () => deleteSurvey(survey.id),
                                },
                            ],
                        },
                    ],
                });
            }
            actions.push({ type: 'button', icon: 'fas fa-chevron-right', to: { path: `/${survey.id}` } });

            const item: LinkItem = {
                type: 'link',
                bold: true,
                value: survey.name,
                primaryObject: {
                    domainObject: {
                        ...typeDefinitions[survey.type],
                    },
                },
                size: 'L',
                description: survey.description,
                tags: survey.isListed ? [{ label: 'Gelistet', color: CtColor.GREEN }] : undefined,
                actions,
            };
            return item;
        }),
);
const actions = computed(() => {
    const actions = [];
    if (userAllowed('survey', 'edit custom category')) {
        actions.push({
            label: 'Sortieren',
            icon: 'fas fa-sort' as const,
            color: CtColor.ACCENT,
            text: true,
            onClick: async () => {
                const result = await sortItems({
                    context: 'Umfragen',
                    items: surveys.value.map(survey => ({
                        ...survey,
                        label: survey.name,
                        sortKey: survey.sortKey || 0,
                    })),
                });
                if (result) {
                    for (const item of surveys.value) {
                        const updatedItem = result.updatedItems.find(updated => updated.id === item.id);
                        if (updatedItem) {
                            await updateSurvey(omit(updatedItem, ['label']));
                        }
                    }
                }
            },
        });
    }
    if (userAllowed('survey', 'create custom category')) {
        actions.push({
            label: 'Umfrage erstellen',
            icon: 'fas fa-plus' as const,
            to: { path: '/create' },
            color: CtColor.CONSTRUCTIVE,
        });
    }
    return actions;
});
const { userAllowed } = usePermissions();
</script>
<template>
    <Grid icon="fas fa-list-checks" :storage-key="'survey-overview-grid'" style="--menu-height: 0px">
        <template #header>
            <GridHeader icon="fas fa-list-check" :menu="[{ name: 'Liste', to: { path: '/list' } }]" title="Umfragen" />
        </template>
        <ContentWrapper
            :actions="actions"
            class="col-span-2"
            icon="fas fa-list-check"
            :max-width="true"
            :restricted="!userAllowed('survey', 'edit custom category')"
            title="Umfragen"
        >
            <SectionedCard :emptystate="{ icon: 'fas fa-list-check' }" :items="items" />
        </ContentWrapper>
    </Grid>
</template>
