<script setup lang="ts">
import { computed } from 'vue';
import { useHelper } from '../composables/useHelper';
import { useSurveys } from '../composables/useSurveys';
import { encodeId } from '../utils/tokenHelper';
const { surveys, isPending, error, refetch } = useSurveys();
const { surveyIsOpen, surveyStatus } = useHelper();
const items = computed(() =>
    [...surveys.value].filter(s => s.isListed && s.isActive).sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0)),
);
</script>
<template>
    <h1 class="survey:text-2xl survey:font-bold">Gelistete Umfragen</h1>
    <p v-if="isPending" role="status">Umfragen werden geladen …</p>
    <UAlert
        v-else-if="error"
        color="error"
        title="Umfragen konnten nicht geladen werden"
        :description="error.message"
        :actions="[{ label: 'Erneut versuchen', onClick: () => refetch() }]"
    />
    <UCard v-for="survey in items" :key="survey.id">
        <div class="survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-3">
            <div>
                <h2 class="survey:text-lg survey:font-semibold">{{ survey.name }}</h2>
                <p class="survey:text-muted survey:whitespace-pre-line">{{ survey.surveyDescription }}</p>
            </div>
            <UButton v-if="surveyIsOpen(survey)" :to="`/form/${encodeId(survey.id)}`">Teilnehmen</UButton
            ><UBadge v-else :color="surveyStatus(survey).color" variant="subtle">{{
                surveyStatus(survey).description
            }}</UBadge>
        </div>
    </UCard>
    <UCard v-if="!isPending && !error && !items.length" class="survey-empty-card"
        ><p>Derzeit sind keine Umfragen gelistet.</p></UCard
    >
</template>
