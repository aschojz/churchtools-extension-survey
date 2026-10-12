<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAction } from './composables/useAction';
import { usePermissions } from './composables/usePlatform';
import { useSurveys } from './composables/useSurveys';
import SurveyShare from './components/SurveyShare.vue';
import SurveyDataIssues from './components/SurveyDataIssues.vue';
import { useHelper } from './composables/useHelper';
import { typeDefinitions } from './utils/helper';
import type { Survey } from './utils/types';
const {
    surveys,
    issues,
    error: loadError,
    isPending,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    refetch,
} = useSurveys();
const {
    allowed,
    error: permissionError,
    isPending: permissionsPending,
    refetch: refetchPermissions,
} = usePermissions();
const { busy, error, run } = useAction();
const { surveyStatus } = useHelper();
async function retry() {
    await Promise.all([refetch(), refetchPermissions()]);
}
const query = ref('');
const statusFilter = ref('all');
const statusItems = [
    { value: 'all', label: 'Alle Status' },
    ...['Offen', 'Geplant', 'Deaktiviert', 'Beendet'].map(label => ({ value: label, label })),
];
const items = computed(() =>
    [...surveys.value]
        .filter(
            s =>
                allowed('edit custom category', s.id) &&
                `${s.name} ${s.description ?? ''}`
                    .toLocaleLowerCase()
                    .includes(query.value.trim().toLocaleLowerCase()) &&
                (statusFilter.value === 'all' || surveyStatus(s).label === statusFilter.value),
        )
        .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0)),
);
async function duplicate(survey: Survey) {
    const { id, customModuleId, shorty, meta, sortKey, ...data } = survey;
    void id;
    void customModuleId;
    void shorty;
    void meta;
    void sortKey;
    await createSurvey({ ...data, name: `${survey.name.slice(0, 92)} (Kopie)`, isListed: false, isActive: false });
}
async function move(index: number, direction: number) {
    const left = items.value[index]!,
        right = items.value[index + direction]!;
    if (!right) return;
    const all = [...surveys.value].sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || a.id - b.id);
    const remaining = all.filter(item => item.id !== left.id);
    const targetIndex = remaining.findIndex(item => item.id === right.id) + (direction > 0 ? 1 : 0);
    const before = remaining[targetIndex - 1],
        after = remaining[targetIndex];
    const lower = before?.sortKey ?? 0,
        upper = after?.sortKey ?? 0;
    const sortKey = !before ? upper - 1024 : !after ? lower + 1024 : (lower + upper) / 2;
    if (before && after && (lower >= upper || sortKey === lower || sortKey === upper))
        throw new Error(
            'Die Reihenfolge ist nicht eindeutig. Bitte zuerst die Sortierreihenfolge in den Einstellungen bereinigen.',
        );
    await updateSurvey({ id: left.id, sortKey }, left);
}
function actions(survey: Survey, index: number) {
    return [
        {
            label: survey.isActive ? 'Teilnahme schließen' : 'Teilnahme aktivieren',
            icon: survey.isActive ? 'i-lucide-lock' : 'i-lucide-lock-open',
            disabled: busy.value,
            onSelect: () => run(() => updateSurvey({ id: survey.id, isActive: !survey.isActive }, survey)),
        },
        ...(allowed('create custom category')
            ? [
                  {
                      label: 'Duplizieren',
                      icon: 'i-lucide-copy',
                      onSelect: () => run(() => duplicate(survey)),
                      disabled: busy.value,
                  },
              ]
            : []),
        {
            label: 'Nach oben verschieben',
            icon: 'i-lucide-arrow-up',
            disabled: busy.value || index === 0,
            onSelect: () => run(() => move(index, -1)),
        },
        {
            label: 'Nach unten verschieben',
            icon: 'i-lucide-arrow-down',
            disabled: busy.value || index === items.value.length - 1,
            onSelect: () => run(() => move(index, 1)),
        },
        ...(allowed('delete custom category', survey.id)
            ? [
                  {
                      label: 'Endgültig löschen',
                      icon: 'i-lucide-trash-2',
                      color: 'error' as const,
                      disabled: busy.value,
                      onSelect: () => run(() => deleteSurvey(survey.id)),
                  },
              ]
            : []),
    ];
}
</script>
<template>
    <header
        class="survey-dashboard-header survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-3"
    >
        <div>
            <h1 class="survey:text-2xl survey:font-bold">Deine Umfragen.</h1>
        </div>
        <div class="survey:flex survey:flex-wrap survey:gap-2">
            <UButton to="/list" variant="outline" icon="i-lucide-list">Öffentliche Liste</UButton
            ><UButton v-if="allowed('create custom category')" to="/create" icon="i-lucide-plus"
                >Umfrage erstellen</UButton
            >
        </div>
    </header>
    <UAlert
        v-if="error || loadError || permissionError"
        color="error"
        title="Umfragen konnten nicht verarbeitet werden"
        :description="error || loadError?.message || permissionError?.message"
        :actions="[{ label: 'Erneut laden', onClick: retry }]"
    />
    <p v-if="isPending || permissionsPending" role="status">Umfragen werden geladen …</p>
    <SurveyDataIssues :issues="issues" />
    <div class="survey-overview-filters survey:grid survey:gap-3 survey:sm:grid-cols-2">
        <UInput
            v-model="query"
            aria-label="Umfragen durchsuchen"
            placeholder="Umfrage suchen"
            icon="i-lucide-search"
        /><USelect v-model="statusFilter" :items="statusItems" aria-label="Umfragen nach Status filtern" />
    </div>
    <UCard v-for="(survey, index) in items" :key="survey.id" class="survey-overview-card">
        <div class="survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-4">
            <div>
                <RouterLink :to="`/${survey.id}`" class="survey-overview-title"
                    ><UIcon :name="typeDefinitions[survey.type].icon" /> {{ survey.name }}</RouterLink
                >
                <p class="survey:text-muted">{{ survey.description }}</p>
                <p class="survey:text-sm survey:text-muted">{{ surveyStatus(survey).description }}</p>
            </div>
            <div class="survey-card-actions survey:flex survey:flex-wrap survey:gap-2">
                <UBadge :color="surveyStatus(survey).color" variant="subtle">{{ surveyStatus(survey).label }}</UBadge>
                <UBadge v-if="survey.isListed" color="success" variant="subtle">Gelistet</UBadge>
                <SurveyShare :id="survey.id" />
                <UDropdownMenu :items="actions(survey, index)"
                    ><UButton
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-ellipsis"
                        :aria-label="`${survey.name}: weitere Aktionen`"
                /></UDropdownMenu>
            </div>
        </div>
    </UCard>
    <UAlert
        v-if="!isPending && !permissionsPending && !items.length && !loadError && !permissionError"
        :title="query || statusFilter !== 'all' ? 'Keine passenden Umfragen' : 'Keine bearbeitbaren Umfragen'"
        description="Hier erscheinen Umfragen, für die du Bearbeitungsrechte hast."
        color="neutral"
    />
</template>
