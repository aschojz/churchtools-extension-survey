<script setup lang="ts">
import type { SurveyNew } from '../utils/types';
import { typeDefinitions } from '../utils/helper';
import { dateLabel } from '../utils/export';
defineProps<{ survey: SurveyNew; preview?: boolean }>();
</script>
<template>
    <header class="survey-form-hero">
        <div class="survey-form-hero-copy">
            <p class="survey-eyebrow">
                <UIcon :name="typeDefinitions[survey.type].icon" />
                {{ preview ? 'Dein Entwurf' : typeDefinitions[survey.type].nameTranslated }}
            </p>
            <h1 v-if="!preview">{{ survey.name }}</h1>
            <h2 v-else>{{ survey.name || 'Deine nächste Umfrage' }}</h2>
            <p class="survey-form-intro">
                {{ survey.surveyDescription || 'Wähle, was für dich passt. Wir freuen uns auf deine Antwort.' }}
            </p>
            <div class="survey-hero-facts">
                <span
                    ><UIcon name="i-lucide-list-checks" />{{
                        survey.type === 'max-options-multiple'
                            ? 'Mengen frei zusammenstellen'
                            : survey.fields[0]?.fieldTypeCode === 'select'
                              ? 'Eine Option auswählen'
                              : 'Mehrere Optionen möglich'
                    }}</span
                ><span v-if="survey.endDate"
                    ><UIcon name="i-lucide-calendar-clock" />Bis {{ dateLabel(survey.endDate) }}</span
                >
            </div>
        </div>
        <img v-if="survey.imageUrl" :src="survey.imageUrl" alt="Bild zur Umfrage" class="survey-form-hero-image" />
        <div v-else class="survey-form-hero-art" aria-hidden="true">
            <UIcon :name="typeDefinitions[survey.type].icon" /><span class="survey-art-spark"
                ><UIcon name="i-lucide-sparkles"
            /></span>
        </div>
    </header>
</template>
