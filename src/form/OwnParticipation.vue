<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import { useCurrentUser, usePermissions } from '../composables/usePlatform';
import { useHelper } from '../composables/useHelper';
import { useAction } from '../composables/useAction';
import { useDraftGuard } from '../composables/useDraftGuard';
import { confirmAction } from '../composables/useConfirm';
import { clone, fingerprint } from '../utils/serialization';
import { entryLabels, entryStatusLabels, dateLabel } from '../utils/export';
import type { SurveyEntry } from '../utils/types';
import { focusFormError } from '../utils/form';
import { validateEntry, EntryValidationError } from '../utils/validation';
import SurveySelection from './SurveySelection.vue';
const props = defineProps<{ id: number }>();
const { survey, surveyEntries, entriesPending, entriesError, entriesIssues, updateSurveyEntry } = useSurvey(
    computed(() => props.id),
    false,
);
const { data: user } = useCurrentUser();
const { allowed } = usePermissions();
const { surveyIsOpen } = useHelper();
const { busy, error, run } = useAction();
const editing = ref<SurveyEntry>();
const editingSnapshot = ref<SurveyEntry>();
const baseline = ref('');
const dirty = computed(() => !!editing.value && fingerprint(editing.value) !== baseline.value);
defineExpose({ dirty });
const own = computed(() =>
    surveyEntries.value.filter(entry => user.value && user.value.id > 0 && entry.personId === user.value.id),
);
useDraftGuard(() => !!editing.value && fingerprint(editing.value) !== baseline.value, busy);
function labels(entry: SurveyEntry) {
    return survey.value ? entryLabels(survey.value, entry).join(', ') : '';
}
async function canDiscard() {
    return (
        !busy.value && (!dirty.value || (await confirmAction('Ungespeicherte Änderungen an deiner Antwort verwerfen?')))
    );
}
async function edit(entry: SurveyEntry) {
    if (!(await canDiscard())) return;
    editing.value = clone(entry);
    editingSnapshot.value = clone(entry);
    baseline.value = fingerprint(entry);
    error.value = '';
}
function validationErrors() {
    if (!editing.value || !survey.value) return [];
    try {
        validateEntry(
            survey.value,
            editing.value,
            surveyEntries.value.filter(entry => entry.id !== editing.value!.id),
            new Date(),
            'edit',
            editing.value.status === 'cancelled',
        );
        return [];
    } catch (error) {
        return [
            {
                name: error instanceof EntryValidationError ? error.field.replace(/^data/, 'selection') : 'selection',
                message: error instanceof Error ? error.message : 'Eingaben prüfen.',
            },
        ];
    }
}
function save() {
    return run(async () => {
        if (!editing.value) return;
        await updateSurveyEntry(clone(editing.value), 'edit', editingSnapshot.value);
        editing.value = undefined;
    });
}
function cancel(entry: SurveyEntry) {
    return run(async () => {
        if (
            !(await confirmAction(
                dirty.value
                    ? 'Ungespeicherte Änderungen verwerfen und die Teilnahme stornieren?'
                    : 'Deine Teilnahme stornieren? Die belegte Kapazität wird wieder frei.',
            ))
        )
            return;
        await updateSurveyEntry({ ...entry, status: 'cancelled' }, 'admin', clone(entry));
        editing.value = undefined;
    });
}
async function discard() {
    if (busy.value) return;
    if (
        editing.value &&
        fingerprint(editing.value) !== baseline.value &&
        !(await confirmAction('Ungespeicherte Änderungen verwerfen?'))
    )
        return;
    editing.value = undefined;
}
</script>
<template>
    <section class="survey-stack">
        <h2 class="survey:text-lg survey:font-semibold">Meine Teilnahme</h2>
        <p v-if="entriesPending" role="status">Eigene Einträge werden geladen …</p>
        <UAlert
            v-if="error || entriesError || entriesIssues.length"
            color="error"
            :title="error || entriesError?.message || 'Der Bestand enthält ungültige Einträge.'"
        />
        <p v-if="!entriesPending && !entriesError && !own.length">
            Keine Teilnahme mit deinem ChurchTools-Konto gefunden.
        </p>
        <UCard v-for="entry in own" :key="entry.id"
            ><div class="survey-stack">
                <div class="survey:flex survey:flex-wrap survey:gap-3 survey:justify-between">
                    <p class="survey:font-medium">
                        {{ entry.name }} · {{ entryStatusLabels(survey)[entry.status ?? 'new'] }}
                    </p>
                    <div v-if="allowed('edit custom data', id)" class="survey:flex survey:gap-2">
                        <UButton
                            :aria-label="`${entry.name}: bearbeiten`"
                            :disabled="busy || !surveyIsOpen(survey)"
                            variant="outline"
                            @click="edit(entry)"
                            >Bearbeiten</UButton
                        ><UButton
                            v-if="entry.status !== 'cancelled'"
                            :disabled="busy"
                            variant="outline"
                            color="warning"
                            @click="cancel(entry)"
                            >Stornieren</UButton
                        >
                    </div>
                </div>
                <p v-if="survey" class="survey:text-sm survey:text-muted">{{ labels(entry) }}</p>
                <p class="survey:text-sm survey:text-muted">{{ dateLabel(entry.meta.createdDate) }}</p>
            </div>
            <div v-if="editing?.id === entry.id && survey" class="survey:mt-5">
                <h3 class="survey:font-semibold survey:mb-3">Antwort von {{ entry.name }} bearbeiten</h3>
                <UBadge v-if="dirty" color="warning" variant="subtle">Ungespeicherte Änderungen</UBadge
                ><UForm
                    v-if="editing && survey"
                    :state="editing"
                    :validate="validationErrors"
                    :disabled="busy"
                    @error="focusFormError"
                    class="survey-stack"
                    @submit="save"
                    ><UFormField name="name" label="Name" required
                        ><UInput v-model="editing.name" required /></UFormField
                    ><UFormField v-if="survey.askForMail" name="email" label="E-Mail-Adresse" required
                        ><UInput v-model="editing.email" required type="email" /></UFormField
                    ><UFormField name="selection" label="Auswahl"
                        ><SurveySelection
                            v-model="editing.data"
                            :survey="survey"
                            :original-data="editingSnapshot?.data"
                            :entries="surveyEntries.filter(entry => entry.id !== editing!.id)"
                            :hide-data="true"
                            :disabled="busy"
                            :availability-known="!entriesIssues.length"
                    /></UFormField>
                    <UFormField
                        v-for="(comment, index) in editing.comments ?? []"
                        :key="index"
                        :label="`Kommentar ${index + 1}`"
                        ><UTextarea v-model="comment.comment" class="survey:w-full"
                    /></UFormField>
                    <UButton
                        v-if="survey.allowComments"
                        variant="link"
                        :disabled="busy"
                        @click="(editing.comments ??= []).push({ comment: '', createdDate: new Date().toISOString() })"
                        >Kommentar hinzufügen</UButton
                    >
                    <div class="survey:flex survey:gap-2">
                        <UButton type="submit" :loading="busy">Änderungen speichern</UButton
                        ><UButton variant="outline" @click="discard">Verwerfen</UButton>
                    </div></UForm
                >
            </div></UCard
        >
        <p v-if="!allowed('edit custom data', id)" class="survey:text-sm survey:text-muted">
            Deine aktuellen ChurchTools-Rechte erlauben keine Änderung. Wende dich an die Verwaltung.
        </p>
    </section>
</template>
