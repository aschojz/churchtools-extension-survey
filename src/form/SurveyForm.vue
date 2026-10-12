<script setup lang="ts">
import { focusFormError } from '../utils/form';
import { computed, ref, watch } from 'vue';
import { useAction } from '../composables/useAction';
import { useHelper } from '../composables/useHelper';
import { useDraftGuard } from '../composables/useDraftGuard';
import OwnParticipation from './OwnParticipation.vue';
import SurveyFormHeader from '../components/SurveyFormHeader.vue';
import { entryLabels } from '../utils/export';
import { clone } from '../utils/serialization';
import { useCurrentUser, usePermissions } from '../composables/usePlatform';
import { useSurvey } from '../composables/useSurvey';
import { fetchSurvey, fetchEntries } from '../data/ccm';
import { decodeId } from '../utils/tokenHelper';
import type { SurveyEntryNew } from '../utils/types';
import { EntryValidationError, validateEntry } from '../utils/validation';
import SurveySelection from './SurveySelection.vue';
const props = defineProps<{ id: string }>();
const id = computed(() => decodeId(props.id));
const {
    survey,
    createSurveyEntry,
    surveyEntries,
    isPending,
    moduleId,
    error: loadError,
    entriesError,
    entriesPending,
    entriesIssues,
    invalidateEntries,
    refetch,
} = useSurvey(id);
const { data: currentUser } = useCurrentUser();
const { allowed } = usePermissions();
const mineOpen = ref(false);
const ownEditor = ref<InstanceType<typeof OwnParticipation>>();
const form = ref<{ setErrors: (errors: { name: string; message: string }[]) => void }>();
const { surveyIsOpen, surveyClosesInFiveMinutes } = useHelper();
const { busy, error, run } = useAction();
const params = new URLSearchParams(window.location.search);
const name = ref(params.get('name') ?? '');
const email = ref(params.get('email') ?? '');
const comment = ref('');
const data = ref<Record<string, string[] | number>>({});
const submitted = ref(false);
const receipt = ref<{ name: string; data: Record<string, string[] | number>; comment: string }>();
function anotherResponse() {
    submitted.value = false;
    receipt.value = undefined;
    error.value = '';
}
watch(
    currentUser,
    user => {
        if (!user || user.id <= 0) return;
        if (!name.value) name.value = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
        if (!email.value) email.value = user.email ?? '';
    },
    { immediate: true },
);
watch(survey, value => {
    if (value) document.title = `Umfrage – ${value.name}`;
});
watch(
    () => props.id,
    () => {
        data.value = {};
        comment.value = '';
        submitted.value = false;
        error.value = '';
    },
);
useDraftGuard(() => !submitted.value && (hasSelection.value || !!comment.value.trim()), busy);
function errors() {
    const result: { name: string; message: string }[] = [];
    if (!name.value.trim()) result.push({ name: 'name', message: 'Bitte deinen Namen eingeben.' });
    if (survey.value?.askForMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
        result.push({ name: 'email', message: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
    if (!hasSelection.value) result.push({ name: 'selection', message: 'Bitte eine Option oder Menge wählen.' });
    return result;
}

const comments = computed(() =>
    surveyEntries.value.flatMap(entry => (entry.comments ?? []).map(c => ({ ...c, name: entry.name }))).reverse(),
);
const selectionLabels = computed(() => (survey.value ? entryLabels(survey.value, { data: data.value }) : []));
const selectedUnits = computed(() =>
    Object.values(data.value).reduce<number>(
        (sum, value) => sum + (Array.isArray(value) ? value.length : Math.max(0, value)),
        0,
    ),
);
const hasSelection = computed(() =>
    Object.values(data.value).some(value => (Array.isArray(value) ? value.length > 0 : value > 0)),
);
function submit() {
    return run(async () => {
        const submittingId = id.value;
        const submittingModule = moduleId.value;
        const snapshot = {
            name: name.value.trim(),
            email: email.value.trim().toLocaleLowerCase(),
            data: clone(data.value),
            comment: comment.value.trim(),
            personId: currentUser.value?.id,
        };
        const currentSurvey = await fetchSurvey(submittingModule, submittingId);
        const entries = await fetchEntries(submittingModule, submittingId, currentSurvey);
        await invalidateEntries();
        const entry: SurveyEntryNew = {
            name: snapshot.name,
            email: currentSurvey.askForMail ? snapshot.email || undefined : undefined,
            personId: snapshot.personId && snapshot.personId > 0 ? snapshot.personId : undefined,
            data: snapshot.data,
            comments: snapshot.comment ? [{ comment: snapshot.comment, createdDate: new Date().toISOString() }] : [],
        };
        try {
            validateEntry(currentSurvey, entry, entries);
        } catch (error) {
            form.value?.setErrors([
                {
                    name:
                        error instanceof EntryValidationError ? error.field.replace(/^data/, 'selection') : 'selection',
                    message: error instanceof Error ? error.message : 'Auswahl prüfen.',
                },
            ]);
            void focusFormError();
            throw error;
        }
        if (id.value !== submittingId || moduleId.value !== submittingModule)
            throw new Error('Die Umfrage wurde während des Speicherns gewechselt.');
        await createSurveyEntry(entry);
        if (id.value !== submittingId) return;
        receipt.value = snapshot;
        submitted.value = true;
        data.value = {};
        comment.value = '';
    });
}
</script>
<template>
    <UAlert v-if="id === null" color="warning" title="Ungültiger Umfragelink" />
    <p v-else-if="isPending" role="status">Umfrage wird geladen …</p>
    <UAlert
        v-else-if="loadError"
        color="error"
        title="Umfrage konnte nicht geladen werden"
        :description="loadError.message"
        :actions="[{ label: 'Erneut versuchen', onClick: () => refetch() }]"
    />
    <template v-else-if="survey">
        <SurveyFormHeader :survey="survey" />
        <UAlert
            v-if="error || entriesError"
            color="error"
            title="Eintrag konnte nicht verarbeitet werden"
            :description="error || entriesError?.message"
        />
        <div v-if="submitted && receipt" class="survey-stack survey-receipt">
            <UAlert
                color="success"
                variant="soft"
                title="Vielen Dank"
                description="Deine Antwort ist erfolgreich eingegangen."
            /><UCard
                ><h2 class="survey:font-semibold">Deine Antwort: {{ receipt.name }}</h2>
                <ul class="survey:mt-3 survey:list-disc survey:pl-5">
                    <li v-for="label in entryLabels(survey, receipt)" :key="label">{{ label }}</li>
                </ul>
                <p v-if="receipt.comment" class="survey:mt-3 survey:whitespace-pre-line">
                    {{ receipt.comment }}
                </p></UCard
            ><UButton variant="outline" class="survey:self-start" @click="anotherResponse"
                >Weitere Antwort abgeben</UButton
            >
        </div>
        <UAlert
            v-if="!submitted && !surveyIsOpen(survey)"
            color="warning"
            title="Umfrage geschlossen"
            :description="
                survey.startDate && new Date(survey.startDate) > new Date()
                    ? `Die Umfrage startet am ${new Date(survey.startDate).toLocaleString('de-DE')}.`
                    : 'Diese Umfrage kann derzeit nicht ausgefüllt werden.'
            "
        />
        <template v-else-if="!submitted && survey.fields[0]">
            <UAlert
                v-if="surveyClosesInFiveMinutes(survey)"
                color="warning"
                title="Umfrage wird in Kürze geschlossen"
                :description="`Schließdatum: ${new Date(survey.endDate!).toLocaleString('de-DE')}`"
            />
            <UForm
                ref="form"
                :state="{ name, email, selection: data }"
                :validate="errors"
                :disabled="busy"
                class="survey-participation-form"
                @submit="submit"
                @error="focusFormError"
            >
                <div class="survey-form-main">
                    <section class="survey-form-section">
                        <div class="survey-section-heading">
                            <span class="survey-step-number">01</span>
                            <div>
                                <h2>Was passt für dich?</h2>
                                <p>
                                    {{
                                        survey.type === 'max-options-multiple'
                                            ? 'Stelle deine Mengen zusammen.'
                                            : survey.fields[0].fieldTypeCode === 'select'
                                              ? 'Wähle deinen Favoriten.'
                                              : 'Wähle alle Optionen, die für dich passen.'
                                    }}
                                </p>
                            </div>
                        </div>
                        <p v-if="entriesPending && !survey.hideDataFromParticipants" role="status">
                            Verfügbarkeit wird geladen …
                        </p>
                        <UFormField name="selection" class="survey-selection-field"
                            ><SurveySelection
                                v-model="data"
                                :survey="survey"
                                :entries="surveyEntries"
                                :hide-data="survey.hideDataFromParticipants"
                                :disabled="busy"
                                :availability-known="
                                    !survey.hideDataFromParticipants &&
                                    !entriesPending &&
                                    !entriesError &&
                                    !entriesIssues.length
                                "
                        /></UFormField>
                    </section>
                    <section class="survey-form-section">
                        <div class="survey-section-heading">
                            <span class="survey-step-number">02</span>
                            <div>
                                <h2>Und wer bist du?</h2>
                                <p>Damit wir deine Antwort zuordnen können.</p>
                            </div>
                        </div>
                        <div class="survey-identity-grid">
                            <UFormField name="name" label="Vor- und Nachname" required
                                ><UInput
                                    v-model="name"
                                    required
                                    size="xl"
                                    icon="i-lucide-user-round"
                                    placeholder="Dein Vor- und Nachname"
                                    autocomplete="name"
                                    class="survey:w-full"
                            /></UFormField>
                            <UFormField name="email" v-if="survey.askForMail" label="E-Mail-Adresse" required
                                ><UInput
                                    v-model="email"
                                    required
                                    size="xl"
                                    icon="i-lucide-mail"
                                    placeholder="name@beispiel.de"
                                    type="email"
                                    autocomplete="email"
                                    class="survey:w-full"
                            /></UFormField>
                        </div>
                        <UFormField v-if="survey.allowComments" label="Möchtest du etwas ergänzen?" hint="Optional"
                            ><UTextarea
                                v-model="comment"
                                :rows="3"
                                size="xl"
                                placeholder="Dein Kommentar …"
                                class="survey:w-full"
                        /></UFormField>
                    </section>
                </div>
                <aside class="survey-form-summary" aria-label="Deine Auswahl">
                    <div class="survey-summary-top">
                        <span class="survey-summary-icon"><UIcon name="i-lucide-list-checks" /></span>
                        <p class="survey-eyebrow">Fast geschafft</p>
                        <h2>Deine Auswahl</h2>
                    </div>
                    <ul v-if="selectionLabels.length" class="survey-summary-list" aria-live="polite">
                        <li v-for="label in selectionLabels" :key="label">
                            <UIcon name="i-lucide-check" /><span>{{ label }}</span>
                        </li>
                    </ul>
                    <p v-else class="survey-summary-empty">Hier siehst du gleich, was du ausgewählt hast.</p>
                    <p class="survey-summary-count" role="status" aria-live="polite">
                        {{ selectedUnits }}
                        {{
                            survey.type === 'max-options-multiple'
                                ? selectedUnits === 1
                                    ? 'Einheit ausgewählt'
                                    : 'Einheiten ausgewählt'
                                : selectedUnits === 1
                                  ? 'Option ausgewählt'
                                  : 'Optionen ausgewählt'
                        }}
                    </p>
                    <UButton
                        type="submit"
                        size="xl"
                        :loading="busy"
                        :disabled="!hasSelection || busy"
                        trailing-icon="i-lucide-arrow-right"
                        class="survey-submit-button"
                        >{{ busy ? 'Wird gesendet …' : 'Antwort absenden' }}</UButton
                    >
                    <p class="survey-summary-note">
                        <UIcon name="i-lucide-check-circle-2" />Du erhältst direkt eine Bestätigung.
                    </p>
                </aside>
            </UForm>
        </template>
        <UButton
            v-if="currentUser && currentUser.id > 0 && allowed('view custom data', id ?? undefined)"
            variant="outline"
            class="survey:self-start"
            :disabled="busy || ownEditor?.dirty"
            @click="mineOpen = !mineOpen"
            >{{ mineOpen ? 'Meine Teilnahme schließen' : 'Meine Teilnahme verwalten' }}</UButton
        >
        <OwnParticipation ref="ownEditor" v-if="mineOpen && id" :id="id" />
        <section
            class="survey-community"
            v-if="survey.allowComments && !survey.hideDataFromParticipants && comments.length"
        >
            <h2 class="survey:text-lg survey:font-semibold">Kommentare</h2>
            <UCard v-for="(item, index) in comments" :key="index"
                ><p class="survey:text-sm survey:text-muted">
                    <strong>{{ item.name }}</strong> · {{ new Date(item.createdDate).toLocaleString('de-DE') }}
                </p>
                <p class="survey:whitespace-pre-line">{{ item.comment }}</p></UCard
            >
        </section>
    </template>
</template>
