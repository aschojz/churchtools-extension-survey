<script setup lang="ts">
import { focusFormError } from '../utils/form';
import { computed, ref, watch } from 'vue';
import { useAction } from '../composables/useAction';
import { usePermissions } from '../composables/usePlatform';
import { useSurvey } from '../composables/useSurvey';
import type { SurveyEntry } from '../utils/types';
import { useDraftGuard } from '../composables/useDraftGuard';
import { clone, fingerprint } from '../utils/serialization';
import { dateLabel, optionLabel, downloadCsv, entryStatusLabels } from '../utils/export';
import { EntryValidationError, validateEntry } from '../utils/validation';
import { getEntryDataValue } from './helper';
const props = defineProps<{ id: number }>();
const id = computed(() => props.id);
const {
    survey,
    surveyEntries,
    entriesPending,
    entriesError,
    entriesIssues,
    refetchEntries,
    updateSurveyEntry,
    deleteSurveyEntry,
} = useSurvey(id, false);
const { allowed } = usePermissions();
const { busy, error, run } = useAction();
const query = ref('');
const filter = ref('all');
const editing = ref<SurveyEntry>();
const editingOriginal = ref('');
const editingSnapshot = ref<SurveyEntry>();
const selectedIds = ref<number[]>([]);
const statusFilter = ref('all');
const batchProgress = ref('');
const dirty = computed(() => editOpen.value && !!editing.value && fingerprint(editing.value) !== editingOriginal.value);
useDraftGuard(dirty, busy);
watch(id, () => {
    editing.value = undefined;
    editOpen.value = false;
    selectedIds.value = [];
    filter.value = 'all';
    statusFilter.value = 'all';
});
const editOpen = ref(false);
const statuses = computed(() =>
    Object.entries(entryStatusLabels(survey.value))
        .filter(([value]) => survey.value?.type.startsWith('max-options') || value !== 'completed')
        .map(([value, label]) => ({ value, label })),
);
watch(
    [query, filter, statusFilter],
    () => {
        selectedIds.value = [];
    },
    { flush: 'sync' },
);
const quantityMode = computed(() => survey.value?.type === 'max-options-multiple');
const options = computed(() => survey.value?.fields[0]?.options ?? []);
const fieldKey = computed(() => survey.value?.fields[0]?.key ?? 'options');
const filters = computed(() => [
    { value: 'all', label: `Alle Einträge (${surveyEntries.value.length})` },
    ...options.value.map(option => ({
        value: option.id,
        label: `${survey.value ? optionLabel(survey.value, option) : option.nameTranslated} (${surveyEntries.value.filter(entry => (quantityMode.value ? Number(entry.data[option.id]) > 0 : getEntryDataValue(entry.data, fieldKey.value).includes(option.id))).length} Antworten)`,
    })),
]);
const entries = computed(() =>
    surveyEntries.value
        .filter(
            entry =>
                `${entry.name} ${entry.email ?? ''}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()) &&
                (statusFilter.value === 'all' ||
                    entry.status === statusFilter.value ||
                    (statusFilter.value === 'new' &&
                        !survey.value?.type.startsWith('max-options') &&
                        entry.status === 'completed')) &&
                (filter.value === 'all' ||
                    (quantityMode.value
                        ? Number(entry.data[filter.value]) > 0
                        : getEntryDataValue(entry.data, fieldKey.value).includes(filter.value))),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
);
const totals = computed(() =>
    statuses.value.map(status => ({
        ...status,
        count: surveyEntries.value
            .filter(e => (e.status ?? 'new') === status.value)
            .reduce(
                (sum, entry) =>
                    sum +
                    options.value.reduce(
                        (count, o) => count + (typeof entry.data[o.id] === 'number' ? Number(entry.data[o.id]) : 0),
                        0,
                    ),
                0,
            ),
    })),
);
function labels(entry: SurveyEntry) {
    return options.value
        .filter(o =>
            quantityMode.value
                ? Number(entry.data[o.id]) > 0
                : getEntryDataValue(entry.data, fieldKey.value).includes(o.id),
        )
        .map(o =>
            quantityMode.value
                ? `${entry.data[o.id]} × ${o.nameTranslated}`
                : survey.value?.type === 'best-date'
                  ? new Date(o.nameTranslated).toLocaleString('de-DE')
                  : o.nameTranslated,
        );
}
function edit(entry: SurveyEntry) {
    editing.value = clone(entry);
    editingSnapshot.value = clone(entry);
    editingOriginal.value = fingerprint(entry);
    error.value = '';
    editOpen.value = true;
}
function setSelection(value: string | string[]) {
    if (editing.value) editing.value.data = { [fieldKey.value]: Array.isArray(value) ? value : [value] };
}
const form = ref<{ setErrors: (errors: { name: string; message: string }[]) => void }>();
function validationErrors() {
    if (!editing.value || !survey.value) return [];
    const errors: { name: string; message: string }[] = [];
    if (!editing.value.name.trim()) errors.push({ name: 'name', message: 'Bitte einen Namen eingeben.' });
    try {
        validateEntry(
            survey.value,
            editing.value,
            surveyEntries.value.filter(entry => entry.id !== editing.value!.id),
            new Date(),
            'admin',
            editing.value.status === 'cancelled',
        );
    } catch (error) {
        errors.push({
            name: error instanceof EntryValidationError ? error.field : 'data',
            message: error instanceof Error ? error.message : 'Auswahl prüfen.',
        });
    }
    return errors;
}

function save() {
    return run(async () => {
        if (!editing.value) return;
        try {
            await updateSurveyEntry(clone(editing.value), 'admin', editingSnapshot.value);
        } catch (error) {
            form.value?.setErrors([
                {
                    name: error instanceof EntryValidationError ? error.field : 'data',
                    message: error instanceof Error ? error.message : 'Auswahl prüfen.',
                },
            ]);
            void focusFormError();
            throw error;
        }
        editingOriginal.value = fingerprint(editing.value);
        editOpen.value = false;
    });
}
function selection(id: number, checked: boolean) {
    selectedIds.value = checked
        ? [...new Set([...selectedIds.value, id])]
        : selectedIds.value.filter(value => value !== id);
}
const allSelected = computed(
    () => entries.value.length > 0 && entries.value.every(entry => selectedIds.value.includes(entry.id)),
);
function selectAll(value: boolean) {
    selectedIds.value = value ? entries.value.map(entry => entry.id) : [];
}
function bulkStatus(status: SurveyEntry['status']) {
    return run(async () => {
        const selected = entries.value.filter(entry => selectedIds.value.includes(entry.id));
        if (!selected.length) return;
        const { confirmAction } = await import('../composables/useConfirm');
        if (
            !(await confirmAction(
                `${selected.length} angezeigte ${selected.length === 1 ? 'Antwort' : 'Antworten'} auf „${entryStatusLabels(survey.value)[status]}“ setzen? Betroffen: ${selected
                    .slice(0, 10)
                    .map(entry => entry.name)
                    .join(', ')}${selected.length > 10 ? ` und ${selected.length - 10} weitere` : ''}`,
            ))
        )
            return;
        batchProgress.value = '';
        let done = 0;
        try {
            for (const entry of selected) {
                await updateSurveyEntry({ ...entry, status }, 'admin', clone(entry));
                selectedIds.value = selectedIds.value.filter(id => id !== entry.id);
                batchProgress.value = `${++done} von ${selected.length} Einträgen aktualisiert.`;
            }
        } catch (error) {
            throw new Error(
                `${done} von ${selected.length} aktualisiert. ${error instanceof Error ? error.message : 'Bitte erneut versuchen.'}`,
                { cause: error },
            );
        }
    });
}
async function closeEdit() {
    if (busy.value) return;
    if (dirty.value) {
        const { confirmAction } = await import('../composables/useConfirm');
        if (!(await confirmAction('Ungespeicherte Änderungen am Eintrag verwerfen?'))) return;
    }
    editOpen.value = false;
}
</script>
<template>
    <section v-if="allowed('view custom data', id)" class="survey-stack">
        <div class="survey:flex survey:flex-wrap survey:justify-between survey:gap-3">
            <h2 class="survey:text-xl survey:font-bold">Einträge</h2>
            <UButton
                v-if="survey"
                :disabled="entriesPending || !!entriesError || !!entriesIssues.length"
                variant="outline"
                icon="i-lucide-download"
                @click="downloadCsv(survey, entries)"
                >Gefilterte Einträge exportieren</UButton
            >
            <div v-if="quantityMode" class="survey:flex survey:flex-wrap survey:gap-2">
                <UBadge
                    v-for="total in totals"
                    :key="total.value"
                    :color="total.value === 'completed' ? 'success' : total.value === 'cancelled' ? 'warning' : 'info'"
                    variant="subtle"
                    >{{ total.label }}: {{ total.count }} {{ total.count === 1 ? 'Einheit' : 'Einheiten' }}</UBadge
                >
            </div>
        </div>
        <UAlert
            v-if="error || entriesError"
            color="error"
            title="Einträge konnten nicht verarbeitet werden"
            :description="error || entriesError?.message"
        />
        <p v-if="entriesPending" role="status">Einträge werden geladen …</p>
        <UAlert
            v-if="entriesIssues.length"
            color="error"
            title="Ungültige Einträge"
            :description="entriesIssues.map(issue => `${issue.name}: ${issue.message}`).join(' · ')"
        />
        <UCard v-for="issue in entriesIssues" :key="`invalid-${issue.id}`"
            ><div class="survey:flex survey:flex-wrap survey:gap-2 survey:justify-between">
                <p>{{ issue.name }}: {{ issue.message }}</p>
                <UButton
                    v-if="allowed('delete custom data', id)"
                    :disabled="busy"
                    color="error"
                    variant="outline"
                    @click="run(() => deleteSurveyEntry(issue.id))"
                    >Fehlerhaften Eintrag löschen</UButton
                >
            </div></UCard
        >
        <UButton v-if="entriesError" variant="outline" @click="refetchEntries()">Einträge erneut laden</UButton>
        <div class="survey:grid survey:gap-3 survey:sm:grid-cols-3">
            <UInput
                :disabled="busy"
                v-model="query"
                placeholder="Name oder E-Mail suchen"
                aria-label="Einträge durchsuchen"
                icon="i-lucide-search"
            /><USelect :disabled="busy" v-model="filter" :items="filters" aria-label="Nach Option filtern" /><USelect
                :disabled="busy"
                v-model="statusFilter"
                :items="[{ value: 'all', label: 'Alle Status' }, ...statuses]"
                aria-label="Nach Status filtern"
            />
        </div>
        <div
            v-if="allowed('edit custom data', id) && (entries.length || selectedIds.length)"
            class="survey:flex survey:flex-wrap survey:gap-2 survey:items-center"
        >
            <UCheckbox
                :model-value="allSelected"
                label="Alle angezeigten Einträge auswählen"
                :disabled="busy"
                @update:model-value="selectAll($event === true)"
            /><span>{{ selectedIds.length }} ausgewählt</span
            ><UButton v-if="selectedIds.length" variant="link" :disabled="busy" @click="selectedIds = []"
                >Auswahl aufheben</UButton
            ><UButton
                v-if="survey?.type.startsWith('max-options')"
                :disabled="busy || !selectedIds.length"
                variant="outline"
                @click="bulkStatus('completed')"
                >Als ausgegeben markieren</UButton
            ><UButton :disabled="busy || !selectedIds.length" variant="outline" @click="bulkStatus('cancelled')">{{
                survey?.type.startsWith('max-options') ? 'Zurücknehmen / stornieren' : 'Antworten zurückziehen'
            }}</UButton
            ><UButton :disabled="busy || !selectedIds.length" variant="outline" @click="bulkStatus('new')">{{
                survey?.type.startsWith('max-options') ? 'Als reserviert markieren' : 'Antworten aktivieren'
            }}</UButton>
        </div>
        <p v-if="batchProgress" role="status">{{ batchProgress }}</p>
        <UCard v-for="entry in entries" :key="entry.id" class="survey-entry-card"
            ><div class="survey:flex survey:flex-wrap survey:items-start survey:justify-between survey:gap-4">
                <div class="survey:min-w-0">
                    <div class="survey-entry-byline">
                        <h3 class="survey:font-semibold">
                            {{ entry.name
                            }}<span v-if="entry.personId" class="survey:text-muted survey:font-normal">
                                (#{{ entry.personId }})</span
                            >
                        </h3>
                        <p class="survey:text-sm survey:text-muted">
                            <span v-if="entry.email">{{ entry.email }} · </span>{{ dateLabel(entry.meta.createdDate) }}
                        </p>
                    </div>
                    <div class="survey:mt-2 survey:flex survey:flex-wrap survey:gap-2">
                        <UBadge v-for="label in labels(entry)" :key="label" color="neutral" variant="subtle">{{
                            label
                        }}</UBadge>
                    </div>
                    <p
                        v-for="(comment, index) in entry.comments ?? []"
                        :key="index"
                        class="survey:mt-2 survey:whitespace-pre-line"
                    >
                        {{ comment.comment }}
                    </p>
                </div>
                <div class="survey-entry-actions">
                    <UBadge
                        :color="
                            entry.status === 'completed' ? 'success' : entry.status === 'cancelled' ? 'warning' : 'info'
                        "
                        >{{ statuses.find(s => s.value === (entry.status ?? 'new'))?.label }}</UBadge
                    >
                    <div class="survey-entry-controls" :class="{ 'is-selected': selectedIds.includes(entry.id) }">
                        <template v-if="allowed('edit custom data', id)"
                            ><UButton
                                v-if="quantityMode && (entry.status === 'new' || !entry.status)"
                                :disabled="busy"
                                color="success"
                                variant="outline"
                                icon="i-lucide-hand"
                                @click="
                                    run(() =>
                                        updateSurveyEntry({ ...entry, status: 'completed' }, 'admin', clone(entry)),
                                    )
                                "
                                >Ausgeben</UButton
                            ><UButton
                                v-if="quantityMode && entry.status === 'completed'"
                                :disabled="busy"
                                color="warning"
                                variant="outline"
                                icon="i-lucide-undo-2"
                                @click="
                                    run(() =>
                                        updateSurveyEntry({ ...entry, status: 'cancelled' }, 'admin', clone(entry)),
                                    )
                                "
                                >Zurücknehmen</UButton
                            ><UTooltip text="Teilnehmerdaten und Auswahl bearbeiten"
                                ><UButton
                                    :disabled="busy"
                                    variant="ghost"
                                    icon="i-lucide-pencil"
                                    :aria-label="`${entry.name}: bearbeiten`"
                                    @click="edit(entry)" /></UTooltip></template
                        ><UTooltip v-if="allowed('delete custom data', id)" text="Eintrag endgültig löschen"
                            ><UButton
                                :disabled="busy"
                                color="error"
                                variant="ghost"
                                icon="i-lucide-trash-2"
                                :aria-label="`${entry.name}: löschen`"
                                @click="run(() => deleteSurveyEntry(entry.id))"
                        /></UTooltip>
                        <UCheckbox
                            v-if="allowed('edit custom data', id)"
                            :model-value="selectedIds.includes(entry.id)"
                            :aria-label="`${entry.name} auswählen`"
                            :disabled="busy"
                            @update:model-value="selection(entry.id, $event === true)"
                        />
                    </div>
                </div></div
        ></UCard>
        <p v-if="!entriesPending && !entries.length && !entriesError" class="survey:text-muted">
            Keine passenden Einträge vorhanden.
        </p>
    </section>
    <UModal
        :open="editOpen"
        @update:open="!$event && closeEdit()"
        title="Eintrag bearbeiten"
        description="Teilnehmerdaten und Auswahl bearbeiten."
        ><template #body
            ><UForm
                v-if="editing"
                id="survey-entry-form"
                ref="form"
                :state="editing"
                :validate="validationErrors"
                :disabled="busy"
                class="survey-stack"
                @submit="save"
                @error="focusFormError"
            >
                <UAlert v-if="error" color="error" :title="error" />
                <UFormField name="name" label="Name" required
                    ><UInput v-model="editing.name" required class="survey:w-full" /></UFormField
                ><UFormField label="E-Mail-Adresse"
                    ><UInput v-model="editing.email" type="email" class="survey:w-full"
                /></UFormField>
                <UFormField name="data" label="Auswahl"
                    ><template v-if="quantityMode"
                        ><UFormField
                            v-for="option in options"
                            :key="option.id"
                            :name="`data.${option.id}`"
                            :label="survey ? optionLabel(survey, option) : option.nameTranslated"
                            ><UInputNumber
                                :model-value="Number(editing.data[option.id] ?? 0)"
                                :min="0"
                                @update:model-value="editing!.data[option.id] = $event ?? 0" /></UFormField
                        ><UFormField label="Status"
                            ><USelect v-model="editing.status" :items="statuses" class="survey:w-full" /></UFormField
                    ></template>
                    <div v-else>
                        <USelect
                            :model-value="
                                survey?.fields[0].fieldTypeCode === 'multiselect'
                                    ? getEntryDataValue(editing.data, fieldKey)
                                    : getEntryDataValue(editing.data, fieldKey)[0]
                            "
                            :multiple="survey?.fields[0].fieldTypeCode === 'multiselect'"
                            :items="
                                options.map(o => ({
                                    value: o.id,
                                    label: survey
                                        ? optionLabel(survey, o) + (o.archived ? ' (archiviert)' : '')
                                        : o.nameTranslated,
                                }))
                            "
                            class="survey:w-full"
                            @update:model-value="setSelection($event as string | string[])"
                        /></div></UFormField></UForm></template
        ><template #footer
            ><UButton color="neutral" variant="outline" @click="closeEdit">Abbrechen</UButton
            ><UButton type="submit" form="survey-entry-form" :loading="busy">Speichern</UButton></template
        ></UModal
    >
</template>
