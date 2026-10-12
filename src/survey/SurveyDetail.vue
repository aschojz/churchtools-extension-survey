<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables';
import { computed, ref, watch } from 'vue';
import SurveyEditor from '../components/SurveyEditor.vue';
import SurveyShare from '../components/SurveyShare.vue';
import { useAction } from '../composables/useAction';
import { useHelper } from '../composables/useHelper';
import { useCurrentUser, usePermissions } from '../composables/usePlatform';
import { useSurvey } from '../composables/useSurvey';
import { useSurveys } from '../composables/useSurveys';
import type { Survey, SurveyNew } from '../utils/types';
import SurveyEntries from './SurveyEntries.vue';
import SurveyResults from './SurveyResults.vue';
import SurveyHistory from './SurveyHistory.vue';
const props = defineProps<{ id: string }>();
const id = computed(() => Number(props.id));
const { survey, isPending, error: loadError, refetch } = useSurvey(id, true);
const {
    allowed,
    error: permissionError,
    isPending: permissionsPending,
    refetch: refetchPermissions,
} = usePermissions();
useCurrentUser();
const { updateSurvey } = useSurveys();
const { surveyStatus } = useHelper();
const { busy, error, run } = useAction();
const toast = useToast();
const tab = ref('results'),
    dirty = ref(false);
const editor = ref<InstanceType<typeof SurveyEditor>>();
const status = computed(() => (survey.value ? surveyStatus(survey.value) : undefined));
const tabs = computed(() => [
    ...(allowed('view custom data', id.value)
        ? [
              { value: 'results', label: 'Ergebnisse', icon: 'i-lucide-chart-no-axes-combined' },
              { value: 'entries', label: 'Einträge', icon: 'i-lucide-users' },
          ]
        : []),
    { value: 'settings', label: 'Einstellungen', icon: 'i-lucide-settings' },
    { value: 'history', label: 'Verlauf', icon: 'i-lucide-history' },
]);
watch(
    tabs,
    items => {
        if (permissionsPending.value) return;
        if (!items.some(item => item.value === tab.value)) tab.value = items[0]?.value ?? 'settings';
    },
    { immediate: true },
);
async function retry() {
    await Promise.all([refetch(), refetchPermissions()]);
}
const save = (data: SurveyNew, original?: SurveyNew) =>
    run(async () => {
        await updateSurvey({ ...data, id: id.value }, original as Survey | undefined);
        editor.value?.acceptSaved(survey.value);
        toast.add({ title: 'Umfrage gespeichert', color: 'success' });
    });
function statusAction() {
    return run(async () => {
        if (!survey.value) return;
        const current = survey.value;
        const changes: Partial<Survey> =
            status.value?.label === 'Offen'
                ? { isActive: false }
                : {
                      isActive: true,
                      ...(current.startDate && new Date(current.startDate) > new Date() ? { startDate: '' } : {}),
                      ...(current.endDate && new Date(current.endDate) <= new Date() ? { endDate: '' } : {}),
                  };
        await updateSurvey({ id: id.value, ...changes }, current);
    });
}
</script>
<template>
    <UButton to="/" variant="link" icon="i-lucide-arrow-left" class="survey:self-start">Umfragen</UButton>
    <p v-if="isPending || permissionsPending" role="status">Umfrage wird geladen …</p>
    <UAlert
        v-if="loadError || error || permissionError"
        color="error"
        title="Umfrage konnte nicht verarbeitet werden"
        :description="error || loadError?.message || permissionError?.message"
        :actions="[{ label: 'Erneut laden', onClick: retry }]"
    />
    <template v-if="survey && !permissionsPending && allowed('edit custom category', id)">
        <header
            class="survey-detail-header survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-4"
        >
            <div class="survey:min-w-0">
                <h1 class="survey:text-2xl survey:font-bold survey:break-words">{{ survey.name }}</h1>
                <p class="survey:text-muted">{{ survey.description }}</p>
            </div>
            <SurveyShare :id="id" />
        </header>
        <UAlert
            v-if="status"
            class="survey-status-alert"
            orientation="horizontal"
            variant="soft"
            :title="`Umfrage ${status.label.toLocaleLowerCase()}`"
            :color="status.color"
            :description="status.description"
            :actions="[
                {
                    label: status.label === 'Offen' ? 'Deaktivieren' : 'Jetzt öffnen',
                    disabled: busy || dirty,
                    onClick: statusAction,
                },
            ]"
        />
        <p v-if="dirty" role="status" class="survey:text-sm survey:text-warning">
            Ungespeicherte Einstellungen. Vor einer Statusänderung speichern oder den Entwurf verwerfen.
        </p>
        <UTabs
            v-model="tab"
            :items="tabs"
            :content="false"
            class="survey:w-full survey-detail-tabs"
            :ui="{ trigger: 'survey:justify-center' }"
        />
        <SurveyResults v-if="tab === 'results' && allowed('view custom data', id)" :id="id" />
        <div v-if="allowed('view custom data', id)" v-show="tab === 'entries'">
            <SurveyEntries :key="id" :id="id" />
        </div>
        <div v-show="tab === 'settings'">
            <SurveyEditor :key="id" ref="editor" :initial="survey" :busy="busy" @save="save" @dirty="dirty = $event" />
        </div>
        <SurveyHistory v-if="tab === 'history'" :id="id" />
    </template>
    <UAlert
        v-else-if="!isPending && !permissionsPending && !loadError"
        color="warning"
        title="Keine Berechtigung zum Bearbeiten dieser Umfrage"
    />
</template>
