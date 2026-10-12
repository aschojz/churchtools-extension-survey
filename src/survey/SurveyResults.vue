<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import { optionCount } from '../utils/validation';
import { downloadCsv, optionLabel, entryStatusLabels } from '../utils/export';
const matrix = ref(false);
const chronological = ref(false);
const props = defineProps<{ id: number }>();
const { survey, surveyEntries, entriesPending, entriesError, entriesIssues, refetchEntries } = useSurvey(
    computed(() => props.id),
    false,
);
const active = computed(() => surveyEntries.value.filter(entry => entry.status !== 'cancelled'));
const limited = computed(() => survey.value?.type.startsWith('max-options'));
const results = computed(() => {
    if (!survey.value) return [];
    const current = survey.value;
    return current.fields[0]!.options.map(option => ({
        ...option,
        label: optionLabel(current, option),
        count: optionCount(current, surveyEntries.value, option),
    })).sort((a, b) =>
        chronological.value && current.type === 'best-date'
            ? Date.parse(a.nameTranslated) - Date.parse(b.nameTranslated)
            : b.count - a.count || a.label.localeCompare(b.label, 'de'),
    );
});
const dateOptions = computed(() =>
    [...(survey.value?.fields[0]?.options ?? [])].sort(
        (a, b) => Date.parse(a.nameTranslated) - Date.parse(b.nameTranslated),
    ),
);
const matrixRows = computed(() => surveyEntries.value.filter(entry => entry.status !== 'cancelled'));
function voted(entry: (typeof surveyEntries.value)[number], option: string) {
    return (
        Array.isArray(entry.data[survey.value!.fields[0].key]) &&
        (entry.data[survey.value!.fields[0].key] as string[]).includes(option)
    );
}
</script>
<template>
    <section class="survey-stack survey-results">
        <header class="survey:flex survey:flex-wrap survey:justify-between survey:items-center survey:gap-3">
            <h2 class="survey:text-xl survey:font-semibold">Ergebnisse</h2>
            <div class="survey-results-exports">
                <UButton
                    v-if="survey"
                    :disabled="entriesPending || !!entriesError || !!entriesIssues.length"
                    variant="outline"
                    icon="i-lucide-download"
                    @click="downloadCsv(survey, surveyEntries, 'results')"
                    >Auswertung als CSV</UButton
                ><UButton
                    v-if="survey"
                    :disabled="entriesPending || !!entriesError || !!entriesIssues.length"
                    variant="outline"
                    @click="downloadCsv(survey, surveyEntries)"
                    >Einzelantworten als CSV</UButton
                >
            </div>
        </header>
        <p v-if="entriesPending" role="status">Ergebnisse werden geladen …</p>
        <UAlert
            v-else-if="entriesError"
            color="error"
            title="Ergebnisse konnten nicht geladen werden"
            :description="entriesError.message"
            :actions="[{ label: 'Erneut laden', onClick: () => refetchEntries() }]"
        />
        <UAlert
            v-if="entriesIssues.length"
            color="error"
            title="Ergebnisse unvollständig"
            description="Ungültige Einträge müssen zuerst in der Eintragsverwaltung geprüft werden."
        />
        <template v-if="!entriesPending && !entriesError && survey">
            <div v-if="survey.type === 'best-date'" class="survey:flex survey:flex-wrap survey:gap-3">
                <USwitch v-model="chronological" label="Termine chronologisch anzeigen" /><USwitch
                    v-model="matrix"
                    label="Antworten als Terminmatrix anzeigen"
                />
            </div>
            <UCard v-if="matrix && survey.type === 'best-date'"
                ><div class="survey:overflow-x-auto" tabindex="0" aria-label="Terminvergleich, horizontal scrollbar">
                    <table class="survey:w-full survey:text-sm">
                        <caption class="survey:sr-only">
                            Aktive Antworten nach Termin, chronologisch
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" class="survey:p-3 survey:text-left">Teilnehmer</th>
                                <th
                                    v-for="option in dateOptions"
                                    :key="option.id"
                                    scope="col"
                                    class="survey:p-3 survey:text-left survey:min-w-36"
                                >
                                    {{ optionLabel(survey, option) }} {{ option.archived ? '(archiviert)' : '' }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="entry in matrixRows"
                                :key="entry.id"
                                class="survey:border-t survey:border-default"
                            >
                                <th scope="row" class="survey:p-3 survey:text-left">{{ entry.name }}</th>
                                <td v-for="option in dateOptions" :key="option.id" class="survey:p-3">
                                    {{ voted(entry, option.id) ? 'Ja' : '–' }}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr class="survey:border-t survey:border-default">
                                <th scope="row" class="survey:p-3 survey:text-left">Stimmen</th>
                                <td v-for="option in dateOptions" :key="option.id" class="survey:p-3">
                                    {{ optionCount(survey, surveyEntries, option) }}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div></UCard
            >
            <div class="survey:grid survey:gap-3 survey:sm:grid-cols-3">
                <UCard
                    ><p class="survey:text-muted">Aktive Teilnehmer</p>
                    <p class="survey:text-3xl survey:font-bold">{{ active.length }}</p></UCard
                ><UCard
                    ><p class="survey:text-muted">{{ limited ? 'Belegte Mengen / Plätze' : 'Stimmen insgesamt' }}</p>
                    <p class="survey:text-3xl survey:font-bold">
                        {{ results.reduce((sum, option) => sum + option.count, 0) }}
                    </p></UCard
                ><UCard
                    ><p class="survey:text-muted">{{ entryStatusLabels(survey).cancelled }} (Antworten)</p>
                    <p class="survey:text-3xl survey:font-bold">{{ surveyEntries.length - active.length }}</p></UCard
                >
            </div>
            <p v-if="!surveyEntries.length" class="survey:text-muted">
                Noch keine Antworten. Teile die Umfrage, um Teilnehmer einzuladen.
            </p>
            <UCard v-for="(option, index) in results" :key="option.id" class="survey-result-card"
                ><div class="survey-stack survey:gap-2">
                    <div class="survey:flex survey:flex-wrap survey:justify-between survey:gap-2">
                        <div class="survey:min-w-0">
                            <p class="survey:font-semibold survey:break-words">
                                {{ index + 1 }}. {{ option.label }}
                                <UBadge v-if="option.archived" color="neutral" variant="subtle">Archiviert</UBadge>
                            </p>
                            <p class="survey:text-muted survey:break-words">{{ option.description }}</p>
                        </div>
                        <div class="survey-result-numbers">
                            <p class="survey-result-meta survey:text-sm survey:text-muted">
                                {{
                                    limited
                                        ? option.maxCount
                                            ? `${Math.max(0, option.maxCount - option.count)} verfügbar von ${option.maxCount}`
                                            : 'Unbegrenzte Kapazität'
                                    : `${active.length ? Math.round((option.count / active.length) * 100) : 0} %`
                                }}
                            </p>
                            <UBadge :color="option.maxCount && option.count > option.maxCount ? 'error' : 'primary'"
                                >{{ option.count }}
                                {{ limited ? 'belegt' : option.count === 1 ? 'Stimme' : 'Stimmen' }}</UBadge
                            >
                        </div>
                    </div>
                    <UProgress
                        :model-value="option.count"
                        :max="
                            limited && option.maxCount
                                ? Math.max(option.maxCount, option.count)
                                : Math.max(active.length, option.count, 1)
                        "
                        :color="option.maxCount && option.count > option.maxCount ? 'error' : 'primary'"
                        :aria-label="`${option.label}: ${option.count}`"
                    /></div
            ></UCard>
            <p class="survey:text-sm survey:text-muted">
                {{
                    limited
                        ? 'Rückgaben und Stornierungen geben Kapazität wieder frei.'
                        : survey.fields[0].fieldTypeCode === 'multiselect'
                          ? 'Bei Mehrfachauswahl kann die Summe der Prozentwerte über 100 % liegen.'
                          : 'Jede aktive Antwort zählt einmal.'
                }}
            </p>
        </template>
    </section>
</template>
