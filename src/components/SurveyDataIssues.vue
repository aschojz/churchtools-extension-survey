<script setup lang="ts">
import { ref } from 'vue';
import type { DataIssue } from '../data/ccm';
import { usePermissions } from '../composables/usePlatform';
import { useSurveys } from '../composables/useSurveys';
import { useAction } from '../composables/useAction';
const props = defineProps<{ issues: DataIssue[] }>();
const { allowed } = usePermissions();
const { repairSurvey, deleteSurvey } = useSurveys();
const { busy, error, run } = useAction();
const selected = ref<DataIssue>();
const json = ref('');
const open = ref(false);
function inspect(issue: DataIssue) {
    selected.value = issue;
    const raw = issue.category?.data ?? '';
    try {
        json.value = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        json.value = raw;
    }
    error.value = '';
    open.value = true;
}
async function save() {
    const issue = selected.value;
    const snapshot = json.value;
    if (!issue?.category) return;
    await run(async () => {
        await repairSurvey(issue.category!, snapshot);
        open.value = false;
    });
}
function download() {
    if (!selected.value?.category) return;
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(selected.value.category, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `umfrage-${selected.value.id}-original.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
<template>
    <section
        v-if="
            props.issues.some(
                issue => allowed('edit custom category', issue.id) || allowed('delete custom category', issue.id),
            )
        "
        class="survey-data-issues survey-stack"
        aria-label="Umfragen mit Datenfehlern"
    >
        <h2 class="survey:font-semibold">Diese Umfragen brauchen eine Korrektur</h2>
        <template v-for="issue in issues" :key="issue.id">
            <div
                v-if="allowed('edit custom category', issue.id) || allowed('delete custom category', issue.id)"
                class="survey-issue-row"
            >
                <div>
                    <h3 class="survey:font-semibold">
                        {{ issue.name }} <span class="survey:text-sm">#{{ issue.id }}</span>
                    </h3>
                    <p class="survey:text-sm">{{ issue.message }}</p>
                    <p v-if="!issue.category?.data?.trim()" class="survey:text-sm survey:mt-1">
                        Ohne gespeicherte Optionen ist keine automatische Migration möglich. Stelle die Daten aus einer
                        Sicherung wieder her oder lösche die ungenutzte Umfrage.
                    </p>
                </div>
                <div class="survey:flex survey:flex-wrap survey:gap-2">
                    <UButton
                        v-if="issue.category && allowed('edit custom category', issue.id)"
                        variant="outline"
                        icon="i-lucide-wrench"
                        @click="inspect(issue)"
                        >Daten prüfen / korrigieren</UButton
                    >
                    <UButton
                        v-if="allowed('delete custom category', issue.id)"
                        color="error"
                        variant="outline"
                        :disabled="busy"
                        icon="i-lucide-trash-2"
                        @click="run(() => deleteSurvey(issue.id))"
                        >Löschen</UButton
                    >
                </div>
            </div>
        </template>
        <UAlert v-if="error && !open" color="error" :title="error" />
    </section>
    <UModal
        v-model:open="open"
        :dismissible="!busy"
        :title="`Daten korrigieren: ${selected?.name ?? ''}`"
        description="Korrigiere die gespeicherten Umfragedaten oder füge den Inhalt einer Sicherung ein. Vorhandene Antworten werden auf passende Optionen geprüft."
    >
        <template #body>
            <div class="survey-stack">
                <UAlert v-if="error" color="error" :title="error" />
                <p class="survey:text-sm">{{ selected?.message }}</p>
                <p class="survey:text-sm survey:text-muted">
                    Erforderlich sind „type“ und ein „fields“-Auswahlfeld mit „key“, „fieldTypeCode“ (select /
                    multiselect) und „options“. Jede Option braucht eine eindeutige „id“ und „nameTranslated“.
                    Bestehende Options-IDs beibehalten.
                </p>
                <UFormField label="Gespeichertes JSON"
                    ><UTextarea
                        v-model="json"
                        :rows="12"
                        :disabled="busy"
                        class="survey:w-full"
                        :ui="{ base: 'survey:font-mono' }"
                /></UFormField>
            </div>
        </template>
        <template #footer>
            <UButton variant="outline" :disabled="busy" icon="i-lucide-download" @click="download"
                >Original sichern</UButton
            >
            <UButton :loading="busy" icon="i-lucide-check" @click="save">Korrektur speichern</UButton>
        </template>
    </UModal>
</template>
