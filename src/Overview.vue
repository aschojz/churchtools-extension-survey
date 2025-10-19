<script setup lang="ts">
import { ContentWrapper, SectionedCard, type LinkItem } from '@churchtools/styleguide';
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
        to: { path: `/${survey.id}` },
        actions: [
            {
                type: 'button',
                icon: 'fas fa-link',
                href: `${window.location.origin}/ccm/survey/form/${encodeId(survey.id)}`,
                target: '_blank',
            },
            { type: 'button', icon: 'fas fa-trash-alt', onClick: () => deleteSurvey(survey.id) },
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
    <ContentWrapper :actions="[actions]" icon="fas fa-list-check" :max-width="true" title="Umfragen">
        <SectionedCard :emptystate="{ icon: 'fas fa-list-check' }" :items="items" />
    </ContentWrapper>
</template>
