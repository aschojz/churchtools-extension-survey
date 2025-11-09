<script setup lang="ts">
import { ContentWrapper, Grid, GridHeader, SectionedCard, type LinkItem } from '@churchtools/styleguide';
import { CtColor } from '@churchtools/utils';
import { computed } from 'vue';
import { useSurveys } from './composables/useSurveys';
import { typeDefinitions } from './utils/helper';
import { encodeId } from './utils/tokenHelper';

const { surveys, deleteSurvey } = useSurveys();
const items = computed((): LinkItem[] =>
    surveys.value.map(survey => ({
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
        actions: [
            {
                type: 'button',
                icon: 'fas fa-link',
                href: `${window.location.origin}/ccm/survey/form/${encodeId(survey.id)}`,
                target: '_blank',
            },
            { type: 'button', icon: 'fas fa-trash-alt', onClick: () => deleteSurvey(survey.id) },
            { type: 'button', icon: 'fas fa-chevron-right', to: { path: `/${survey.id}` } },
        ],
    })),
);
const actions = computed(() => ({
    label: 'Umfrage erstellen',
    icon: 'fas fa-plus' as const,
    to: { path: '/create' },
    color: CtColor.CONSTRUCTIVE,
}));
</script>
<template>
    <Grid icon="fas fa-list-checks" :storage-key="'survey-overview-grid'" style="--menu-height: 0px">
        <template #header>
            <GridHeader icon="fas fa-list-check" :menu="[]" title="Umfragen" />
        </template>
        <ContentWrapper
            :actions="[actions]"
            class="col-span-2"
            icon="fas fa-list-check"
            :max-width="true"
            title="Umfragen"
        >
            <SectionedCard :emptystate="{ icon: 'fas fa-list-check' }" :items="items" />
        </ContentWrapper>
    </Grid>
</template>
