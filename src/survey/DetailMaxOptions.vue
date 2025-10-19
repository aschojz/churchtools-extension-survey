<script setup lang="ts">
import { SectionedCard, type LinkItem } from '@churchtools/styleguide';
import { notNullish } from '@churchtools/utils';
import { computed } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import { getEntryDataValue } from './helper';
import { useSurveyHelper } from './useSurveyHelper';

const props = defineProps<{
    id: number;
}>();

const surveyId = computed(() => props.id);
const { survey, surveyEntries } = useSurvey(surveyId);
const { entryActions } = useSurveyHelper(surveyId);

const entries = computed(() => {
    if (!survey.value) {
        return [];
    }
    return surveyEntries.value.map((entry): LinkItem => {
        const ids = getEntryDataValue(entry.data, survey.value!.fields[0].key);
        return {
            type: 'link',
            bold: true,
            description: new Date(entry.meta.createdDate).toLocaleString(),
            value: entry.name,
            tags: ids
                .map(value => {
                    const option = survey.value!.fields[0].options.find(opt => opt.id.toString() === value);
                    if (!option) {
                        return null;
                    }
                    return {
                        label: option.nameTranslated,
                    };
                })
                .filter(notNullish),
            content: entry.comments?.length ? entry.comments[0].comment : undefined,
            actions: entryActions(entry),
        };
    });
});
</script>
<template>
    <SectionedCard
        :emptystate="{ icon: 'fas fa-list-check', title: 'Noch keine Einträge vorhanden.' }"
        :items="entries"
        title="Einträge"
    />
</template>
