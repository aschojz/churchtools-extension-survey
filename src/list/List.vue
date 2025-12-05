<script setup lang="ts">
import { ContentWrapper, SectionedCard, type LinkItem } from '@churchtools/styleguide';
import { CtColor } from '@churchtools/utils';
import { sortBy } from 'lodash-es';
import { computed } from 'vue';
import { useHelper } from '../composables/useHelper';
import { useSurveys } from '../composables/useSurveys';
import { encodeId } from '../utils/tokenHelper';

const { surveys } = useSurveys();
const { surveyIsOpen } = useHelper();

const listedSurveys = computed(() =>
    sortBy(surveys.value, ['sortKey'])
        .filter(survey => survey.isListed && survey.isActive)
        .map((survey): LinkItem => {
            const isOpen = surveyIsOpen(survey);
            return {
                type: 'link',
                value: survey.name,
                bold: true,
                description: survey.surveyDescription,
                to: isOpen ? `form/${encodeId(survey.id)}` : undefined,
                tags: [
                    {
                        label: isOpen
                            ? 'Offen'
                            : survey.startDate
                              ? `Öffnet am ${new Date(survey.startDate).toLocaleString()}`
                              : 'Geschlossen',
                        color: isOpen ? CtColor.GREEN : CtColor.WARNING,
                    },
                ],
            };
        }),
);
</script>
<template>
    <ContentWrapper :max-width="true" title="Gelistete Umfragen">
        <SectionedCard :items="listedSurveys" />
    </ContentWrapper>
</template>
