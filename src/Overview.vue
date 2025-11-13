<script setup lang="ts">
import { ContentWrapper, Grid, GridHeader, SectionedCard, type LinkItem } from '@churchtools/styleguide';
import { CtColor, usePermissions } from '@churchtools/utils';
import { computed } from 'vue';
import { useSurveys } from './composables/useSurveys';
import { typeDefinitions } from './utils/helper';
import { encodeId } from './utils/tokenHelper';

const { surveys, deleteSurvey } = useSurveys();
const items = computed(() =>
    surveys.value
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
                actions,
            };
            return item;
        }),
);
const actions = computed(() =>
    userAllowed('survey', 'create custom category')
        ? [
              {
                  label: 'Umfrage erstellen',
                  icon: 'fas fa-plus' as const,
                  to: { path: '/create' },
                  color: CtColor.CONSTRUCTIVE,
              },
          ]
        : [],
);
const { userAllowed } = usePermissions();
</script>
<template>
    <Grid icon="fas fa-list-checks" :storage-key="'survey-overview-grid'" style="--menu-height: 0px">
        <template #header>
            <GridHeader icon="fas fa-list-check" :menu="[]" title="Umfragen" />
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
