<script setup lang="ts">
import { SectionedCard, Tabs, type LinkItem } from '@churchtools/styleguide';
import { notNullish } from '@churchtools/utils';
import { computed, ref } from 'vue';
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
    return surveyEntries.value.map((entry): LinkItem & { searchText: string } => {
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
            searchText: ids.join(' '),
            content: entry.comments ? entry.comments[0]?.comment : undefined,
            actions: entryActions(entry),
        };
    });
});
const filteredEntries = computed(() => {
    if (activeTab.value === 'all') {
        return entries.value;
    }
    return entries.value.filter(entry => entry.searchText?.split(' ').includes(activeTab.value) ?? false);
});

const activeTab = ref('all');
const options = computed(() => {
    if (!survey.value) {
        return [];
    }
    const options = [...(survey.value?.fields[0].options ?? [])].map(o => ({
        ...o,
        key: o.id.toString(),
        label: o.nameTranslated,
        count: 0,
        active: activeTab.value === o.id.toString(),
    }));
    surveyEntries.value.forEach(entry => {
        getEntryDataValue(entry.data, survey.value!.fields[0].key).forEach(selectedOptionId => {
            const option = options.find(opt => opt.id.toString() === selectedOptionId.toString());
            if (option) {
                option.count = (option.count || 0) + 1;
            }
        });
    });
    const sorted = options.sort((a, b) => b.count! - a.count!);
    sorted.unshift({
        key: 'all',
        label: 'Alle Einträge',
        count: surveyEntries.value.length,
        active: activeTab.value === 'all',
    } as any);
    return sorted;
});
</script>
<template>
    <Tabs :tabs="options" @click="activeTab = $event.key" />
    <SectionedCard
        :emptystate="{ icon: 'fas fa-list-check', title: 'Noch keine Einträge vorhanden.' }"
        :items="filteredEntries"
    />
</template>
