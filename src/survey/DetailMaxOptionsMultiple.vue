<script setup lang="ts">
import { SectionedCard, type LinkItem } from '@churchtools/styleguide';
import { notNullish } from '@churchtools/utils';
import { computed } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import { useSurveyHelper } from './useSurveyHelper';

const props = defineProps<{
    id: number;
}>();

const surveyId = computed(() => props.id);
const { survey, surveyEntries } = useSurvey(surveyId);
const { entryActions } = useSurveyHelper(surveyId);

const entries = computed(() => {
    return surveyEntries.value.map(
        (entry): LinkItem => ({
            type: 'link',
            bold: true,
            description: new Date(entry.meta.createdDate).toLocaleString(),
            value: entry.name,
            tags: survey.value?.fields[0].options
                .map(option => {
                    if (entry.data[option.id]) {
                        return {
                            label: `${entry.data[option.id]}x ${option.nameTranslated}`,
                        };
                    }
                    return null;
                })
                .filter(notNullish),
            content: entry.comments?.length ? entry.comments[0].comment : undefined,
            actions: entryActions(entry),
        }),
    );
});
</script>
<template>
    <SectionedCard
        :emptystate="{ icon: 'fas fa-list-check', title: 'Noch keine Einträge vorhanden.' }"
        :items="entries"
        title="Einträge"
    />
</template>
