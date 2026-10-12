<script setup lang="ts">
import { focusFormError } from '../utils/form';
import { createId } from '../utils/helper';
import { computed, reactive, ref, watch } from 'vue';
import { clone, fingerprint, payloadError, surveyPayload } from '../utils/serialization';
import { useDraftGuard } from '../composables/useDraftGuard';
import { validateSurvey } from '../utils/validation';
import { typeDefinitions } from '../utils/helper';
import { SurveyType, type SurveyNew, type SurveyOptionNew } from '../utils/types';
const props = defineProps<{ initial?: SurveyNew; busy?: boolean }>();
const emit = defineEmits<{ save: [survey: SurveyNew, original: SurveyNew | undefined]; dirty: [value: boolean] }>();
const draft = reactive<SurveyNew>(
    structuredClone(
        props.initial
            ? JSON.parse(JSON.stringify(props.initial))
            : {
                  name: '',
                  type: 'best-option',
                  description: '',
                  surveyDescription: '',
                  isActive: true,
                  allowComments: true,
                  fields: [{ key: 'options', nameTranslated: 'Optionen', fieldTypeCode: 'multiselect', options: [] }],
              },
    ),
);
for (const field of draft.fields)
    for (const option of field.options) {
        if (option.maxCount === 0) option.maxCount = undefined;
        if (option.maxSelectable === 0) option.maxSelectable = undefined;
    }
const baseline = ref(fingerprint(draft));
const original = ref(props.initial ? clone(props.initial) : undefined);
const changedElsewhere = ref(false);
const dirty = computed(() => fingerprint(draft) !== baseline.value);
watch(dirty, value => emit('dirty', value), { immediate: true });
useDraftGuard(dirty, () => !!props.busy && dirty.value);
function acceptSaved(value?: SurveyNew) {
    if (value) {
        for (const key of Object.keys(draft)) delete (draft as unknown as Record<string, unknown>)[key];
        Object.assign(draft, clone(value));
    }
    baseline.value = fingerprint(draft);
    original.value = value ? clone(value) : undefined;
    changedElsewhere.value = false;
}
watch(
    () => props.initial,
    value => {
        if (!value || fingerprint(value) === fingerprint(original.value)) return;
        if (dirty.value) changedElsewhere.value = true;
        else acceptSaved(value);
    },
);
function discard() {
    if (props.initial) acceptSaved(props.initial);
}
defineExpose({ acceptSaved, dirty });
const dataSize = computed(() => Array.from(surveyPayload(draft).data).length);
const formErrors = computed(() => {
    const errors: { name: string; message: string }[] = [];
    if (!draft.name.trim()) errors.push({ name: 'name', message: 'Bitte einen Namen eingeben.' });
    if (draft.name.length > 100) errors.push({ name: 'name', message: 'Höchstens 100 Zeichen.' });
    if (draft.description && draft.description.length > 300)
        errors.push({ name: 'description', message: 'Höchstens 300 Zeichen.' });
    if (!draft.fields[0]?.options.some(o => !o.archived))
        errors.push({ name: 'options', message: 'Mindestens eine aktive Option ist erforderlich.' });
    if (draft.startDate && draft.endDate && new Date(draft.startDate) >= new Date(draft.endDate))
        errors.push({ name: 'endDate', message: 'Das Schließdatum muss nach dem Öffnungsdatum liegen.' });
    const size = payloadError(draft);
    if (size) errors.push({ name: 'surveyDescription', message: size });
    return errors;
});
const form = ref<{ setErrors: (errors: { name: string; message: string }[]) => void }>();

function moveOption(index: number, delta: number) {
    const other = index + delta;
    if (other < 0 || other >= options.value.length) return;
    [options.value[index], options.value[other]] = [options.value[other]!, options.value[index]!];
}
function removeOption(index: number) {
    if (initialOption(options.value[index]!.id)) options.value[index]!.archived = true;
    else options.value.splice(index, 1);
}
function initialOption(id: string) {
    return original.value?.fields[0]?.options.some(option => option.id === id);
}
const options = computed(() => draft.fields[0].options);
const types = Object.entries(typeDefinitions).map(([value, type]) => ({ value, label: type.nameTranslated }));
const limited = computed(() => draft.type === SurveyType.MAX_OPTIONS || draft.type === SurveyType.MAX_OPTIONS_MULTIPLE);
const optionOpen = ref(false);
const editingIndex = ref<number | null>(null);
const option = reactive<SurveyOptionNew>({ id: '', nameTranslated: '' });
const optionDate = ref('');
const localError = ref('');
const optionError = ref('');
const limitedTotal = ref(false);
const limitedPerson = ref(false);
function numberWidth(value?: number) {
    return { width: `calc(${Math.max(4, String(value ?? 0).length)}ch + 4.5rem)` };
}
const flags = [
    { key: 'allowComments', label: 'Kommentare erlauben' },
    { key: 'askForMail', label: 'E-Mail-Adresse abfragen' },
    { key: 'isListed', label: 'In der öffentlichen Liste anzeigen' },
    { key: 'hideDataFromParticipants', label: 'Teilnehmerdaten in der Oberfläche verbergen' },
] as const;
function localDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function setDate(key: 'startDate' | 'endDate', value: string | number) {
    draft[key] = value ? new Date(String(value)).toISOString() : '';
}
function editOption(index: number | null) {
    editingIndex.value = index;
    const current =
        index === null
            ? {
                  id: createId(),
                  nameTranslated: '',
                  description: '',
                  maxCount: undefined,
                  maxSelectable: undefined,
              }
            : options.value[index];
    Object.assign(option, { maxCount: undefined, maxSelectable: undefined, description: '', ...current });
    optionDate.value = localDate(current.nameTranslated);
    limitedTotal.value = current.maxCount != null;
    limitedPerson.value = current.maxSelectable != null;
    optionError.value = '';
    optionOpen.value = true;
}
function validateOption() {
    const errors: { name: string; message: string }[] = [];
    if (
        draft.type === SurveyType.BEST_DATE
            ? !optionDate.value || !Number.isFinite(Date.parse(optionDate.value))
            : !option.nameTranslated.trim()
    )
        errors.push({
            name: 'nameTranslated',
            message:
                draft.type === SurveyType.BEST_DATE
                    ? 'Bitte einen gültigen Termin eingeben.'
                    : 'Bitte einen Titel eingeben.',
        });
    for (const [key, enabled] of [
        ['maxCount', limitedTotal.value],
        ['maxSelectable', limitedPerson.value],
    ] as const)
        if (enabled && (!Number.isSafeInteger(option[key]) || Number(option[key]) < 1))
            errors.push({ name: key, message: 'Bitte eine positive ganze Zahl eingeben.' });
    return errors;
}
function saveOption() {
    if (draft.type === SurveyType.BEST_DATE) {
        if (!optionDate.value) {
            optionError.value = 'Bitte ein Datum eingeben.';
            return;
        }
        option.nameTranslated = new Date(optionDate.value).toISOString();
    }
    if (!option.nameTranslated.trim()) {
        optionError.value = 'Bitte einen Titel eingeben.';
        return;
    }
    if (!limitedTotal.value) option.maxCount = undefined;
    if (!limitedPerson.value) option.maxSelectable = undefined;
    for (const count of [option.maxCount, option.maxSelectable]) {
        if (count != null && (!Number.isSafeInteger(Number(count)) || Number(count) < 1)) {
            optionError.value = 'Grenzen müssen positive ganze Zahlen sein.';
            return;
        }
    }
    const saved = {
        ...option,
        nameTranslated: option.nameTranslated.trim(),
        maxCount: option.maxCount == null ? undefined : Number(option.maxCount),
        maxSelectable: option.maxSelectable == null ? undefined : Number(option.maxSelectable),
    };
    if (editingIndex.value === null) options.value.push(saved);
    else options.value[editingIndex.value] = saved;
    optionOpen.value = false;
}
function submit() {
    if (props.busy) return;
    try {
        validateSurvey(draft);
        localError.value = '';
        emit('save', clone(draft), original.value ? clone(original.value) : undefined);
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Bitte die Eingaben prüfen.';
        form.value?.setErrors([{ name: 'options', message: localError.value }]);
    }
}
</script>
<template>
    <UForm
        ref="form"
        :state="draft"
        :validate="() => formErrors"
        :disabled="busy"
        class="survey-stack survey-editor"
        @submit="submit"
        @error="focusFormError"
    >
        <fieldset :disabled="busy" class="survey-stack survey:min-w-0">
            <UAlert
                v-if="changedElsewhere"
                color="warning"
                title="Gespeicherter Stand wurde geändert"
                description="Dein Entwurf bleibt erhalten. Verwirf ihn nur, wenn du den aktuellen Stand übernehmen möchtest."
            />
            <UAlert v-if="localError" color="error" :title="localError" />
            <UCard class="survey-surface-card"
                ><template #header
                    ><div class="survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-2">
                        <h2 class="survey:font-semibold">Inhalt</h2>
                    </div></template
                >
                <div class="survey-stack">
                    <UFormField name="name" label="Name der Umfrage" required
                        ><UInput v-model="draft.name" :maxlength="100" required class="survey:w-full"
                    /></UFormField>
                    <UFormField name="description" label="Interne Beschreibung"
                        ><UTextarea v-model="draft.description" :maxlength="300" class="survey:w-full"
                    /></UFormField>
                    <UFormField name="surveyDescription" label="Beschreibung für Teilnehmer"
                        ><UTextarea v-model="draft.surveyDescription" class="survey:w-full"
                    /></UFormField>
                    <UFormField label="Umfragetyp" :help="typeDefinitions[draft.type].description"
                        ><USelect v-model="draft.type" :items="types" :disabled="!!initial" class="survey:w-full"
                    /></UFormField></div
            ></UCard>
            <UCard class="survey-surface-card survey-editor-options"
                ><template #header
                    ><div class="survey:flex survey:justify-between survey:items-center">
                        <h2 class="survey:font-semibold">Optionen</h2>
                        <UButton type="button" variant="outline" icon="i-lucide-plus" @click="editOption(null)"
                            >Option hinzufügen</UButton
                        >
                    </div></template
                >
                <UFormField name="options"
                    ><div class="survey:divide-y survey:divide-default">
                        <div
                            v-for="(item, index) in options"
                            :key="item.id"
                            class="survey-editor-option-row survey:flex survey:items-center survey:justify-between survey:gap-3"
                        >
                            <div>
                                <p class="survey:font-medium">
                                    {{
                                        draft.type === 'best-date'
                                            ? new Date(item.nameTranslated).toLocaleString('de-DE')
                                            : item.nameTranslated
                                    }}
                                </p>
                                <p class="survey:text-muted">{{ item.description }}</p>
                                <UBadge v-if="item.archived" color="neutral">Archiviert</UBadge>
                                <UBadge v-if="limited" variant="subtle"
                                    >Kapazität: {{ item.maxCount ?? '∞'
                                    }}<span v-if="draft.type === 'max-options-multiple'">
                                        · pro Person: {{ item.maxSelectable ?? '∞' }}</span
                                    ></UBadge
                                >
                            </div>
                            <div class="survey:flex survey:flex-wrap survey:gap-1">
                                <UTooltip text="Nach oben"
                                    ><UButton
                                        type="button"
                                        variant="ghost"
                                        icon="i-lucide-arrow-up"
                                        :aria-label="`${item.nameTranslated}: nach oben`"
                                        :disabled="index === 0"
                                        @click="moveOption(index, -1)"
                                /></UTooltip>
                                <UTooltip text="Nach unten"
                                    ><UButton
                                        type="button"
                                        variant="ghost"
                                        icon="i-lucide-arrow-down"
                                        :aria-label="`${item.nameTranslated}: nach unten`"
                                        :disabled="index === options.length - 1"
                                        @click="moveOption(index, 1)"
                                /></UTooltip>
                                <UTooltip text="Option bearbeiten"
                                    ><UButton
                                        type="button"
                                        variant="ghost"
                                        icon="i-lucide-pencil"
                                        :aria-label="`${item.nameTranslated}: bearbeiten`"
                                        @click="editOption(index)"
                                /></UTooltip>
                                <UTooltip
                                    :text="
                                        item.archived
                                            ? 'Wieder aktivieren'
                                            : initialOption(item.id)
                                              ? 'Archivieren; vorhandene Antworten bleiben erhalten'
                                              : 'Neue Option entfernen'
                                    "
                                >
                                    <UButton
                                        type="button"
                                        variant="ghost"
                                        :icon="item.archived ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                                        :aria-label="`${item.nameTranslated}: ${item.archived ? 'aktivieren' : 'entfernen oder archivieren'}`"
                                        @click="item.archived ? (item.archived = false) : removeOption(index)"
                                    />
                                </UTooltip>
                            </div>
                        </div>
                        <p v-if="!options.length" class="survey:text-muted">Füge mindestens eine Option hinzu.</p>
                    </div></UFormField
                >
            </UCard>
            <UCard class="survey-surface-card"
                ><template #header><h2 class="survey:font-semibold">Teilnahme und Termine</h2></template>
                <div class="survey-stack">
                    <USwitch
                        :model-value="draft.fields[0].fieldTypeCode === 'multiselect'"
                        label="Mehrfachauswahl"
                        :disabled="draft.type === 'max-options-multiple'"
                        @update:model-value="draft.fields[0].fieldTypeCode = $event ? 'multiselect' : 'select'"
                    />
                    <USwitch v-for="flag in flags" :key="flag.key" v-model="draft[flag.key]" :label="flag.label" />
                    <p v-if="draft.hideDataFromParticipants" class="survey:text-sm survey:text-muted">
                        Diese Einstellung blendet Teilnehmerdaten in der Oberfläche aus. API-Rechte werden in
                        ChurchTools vergeben.
                    </p>
                    <USwitch v-model="draft.isActive" label="Umfrage aktiv" />
                    <div class="survey:grid survey:gap-4 survey:sm:grid-cols-2">
                        <UFormField label="Öffnungsdatum"
                            ><UInput
                                type="datetime-local"
                                :model-value="localDate(draft.startDate)"
                                class="survey:w-full"
                                @update:model-value="setDate('startDate', $event)" /></UFormField
                        ><UFormField name="endDate" label="Schließdatum"
                            ><UInput
                                type="datetime-local"
                                :model-value="localDate(draft.endDate)"
                                class="survey:w-full"
                                @update:model-value="setDate('endDate', $event)"
                        /></UFormField>
                    </div></div
            ></UCard>
            <UCard class="survey-surface-card"
                ><details>
                    <summary class="survey:font-semibold survey:cursor-pointer">Erweitert</summary>
                    <div class="survey-stack survey:mt-4">
                        <UFormField label="Bild-URL"
                            ><UInput v-model="draft.imageUrl" type="url" class="survey:w-full" /></UFormField
                        ><UFormField
                            v-if="initial"
                            label="Sortierreihenfolge"
                            description="Kleinere Werte stehen weiter oben."
                            ><UInputNumber
                                v-model="draft.sortKey"
                                class="survey-compact-number"
                                :style="numberWidth(draft.sortKey)"
                        /></UFormField>
                    </div></details
            ></UCard>
            <div class="survey-editor-actions">
                <UButton v-if="initial && dirty" type="button" variant="link" :disabled="busy" @click="discard"
                    >Entwurf verwerfen</UButton
                >
                <p
                    class="survey:text-sm survey-editor-size"
                    :class="dataSize > 2000 ? 'survey:text-error' : 'survey:text-muted'"
                >
                    Speicherplatz: {{ dataSize }} / 2.000 Zeichen
                </p>
                <div class="survey-editor-save-group">
                    <UBadge role="status" :color="dirty ? 'warning' : 'neutral'" variant="subtle">{{
                        dirty ? 'Ungespeicherte Änderungen' : 'Keine ungespeicherten Änderungen'
                    }}</UBadge>
                    <UButton type="submit" :loading="busy" icon="i-lucide-check">{{
                        initial ? 'Änderungen speichern' : 'Umfrage erstellen'
                    }}</UButton>
                </div>
            </div>
        </fieldset>
    </UForm>
    <UModal
        v-model:open="optionOpen"
        :title="editingIndex === null ? 'Option hinzufügen' : 'Option bearbeiten'"
        description="Die Option wird im Entwurf übernommen. Erst die Umfrage speichern, um die Änderung zu veröffentlichen."
    >
        <template #body
            ><UForm
                id="survey-option-form"
                :state="option"
                :validate="validateOption"
                :disabled="busy"
                class="survey-stack survey-option-editor"
                @submit="saveOption"
                @error="focusFormError"
            >
                <UAlert v-if="optionError" color="error" :title="optionError" />
                <UFormField name="nameTranslated" :label="draft.type === 'best-date' ? 'Datum' : 'Titel'" required
                    ><UInput
                        v-if="draft.type === 'best-date'"
                        v-model="optionDate"
                        type="datetime-local"
                        required
                        class="survey:w-full" /><UInput
                        v-else
                        v-model="option.nameTranslated"
                        required
                        class="survey:w-full"
                /></UFormField>
                <UFormField label="Beschreibung"
                    ><UTextarea v-model="option.description" class="survey:w-full"
                /></UFormField>
                <template v-if="limited"
                    ><USwitch
                        v-model="limitedTotal"
                        label="Gesamtkapazität begrenzen"
                        @update:model-value="option.maxCount = $event ? (option.maxCount ?? 1) : undefined"
                    /><UFormField name="maxCount" v-if="limitedTotal" label="Maximale Anzahl"
                        ><UInputNumber
                            v-model="option.maxCount"
                            :min="1"
                            class="survey-compact-number"
                            :style="numberWidth(option.maxCount)"
                    /></UFormField>
                    <p v-else class="survey:text-muted">Unbegrenzte Kapazität</p></template
                >
                <template v-if="draft.type === 'max-options-multiple'"
                    ><USwitch
                        v-model="limitedPerson"
                        label="Menge pro Person begrenzen"
                        @update:model-value="option.maxSelectable = $event ? (option.maxSelectable ?? 1) : undefined"
                    /><UFormField name="maxSelectable" v-if="limitedPerson" label="Maximal pro Person auswählbar"
                        ><UInputNumber
                            v-model="option.maxSelectable"
                            :min="1"
                            class="survey-compact-number"
                            :style="numberWidth(option.maxSelectable)"
                    /></UFormField>
                    <p v-else class="survey:text-muted">Unbegrenzt pro Person</p></template
                >
            </UForm></template
        >
        <template #footer
            ><UButton color="neutral" variant="outline" @click="optionOpen = false">Abbrechen</UButton
            ><UButton type="submit" form="survey-option-form">In Entwurf übernehmen</UButton></template
        >
    </UModal>
</template>
