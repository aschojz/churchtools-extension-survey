<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useDraftGuard } from '../composables/useDraftGuard';
import { usePlugin } from '../composables/usePlugin';
import { fetchEntries, fetchSurvey } from '../data/ccm';
import {
    executeGroupTransfer,
    fetchTransferPerson,
    loadTransferSetup,
    searchTransferPeople,
    validateTransferSettings,
} from '../data/groupTransfer';
import type { TransferMasterdata, TransferProgress, TransferSettings } from '../data/groupTransfer';
import { buildTransferPlan, displayTransferValue, exactEmailMatches } from '../utils/groupTransfer';
import type { PersonResolution, TransferPerson, TransferPlan } from '../utils/groupTransfer';
import type { Survey, SurveyEntry } from '../utils/types';
import { fingerprint } from '../utils/serialization';
import { entryLabels } from '../utils/export';

const props = defineProps<{ survey: Survey }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const { moduleId } = usePlugin();
type Row = PersonResolution & { query: string; candidates: TransferPerson[]; searching: boolean; error: string };
const rows = ref<Row[]>([]);
const source = ref<{ survey: Survey; entries: SurveyEntry[]; fingerprint: string }>();
const masterdata = ref<TransferMasterdata>();
const privacyRequired = ref(false);
const step = ref<'start' | 'people' | 'preview' | 'result'>('start');
const busy = ref(false),
    error = ref(''),
    attempted = ref(false);
const plan = ref<TransferPlan>();
const settings = reactive<TransferSettings>({
    groupTypeId: 0,
    roleId: 0,
    personDefaults: { statusId: 0, campusId: 0, departmentIds: [] },
    securityLevel: 1,
});
const progress = reactive<TransferProgress>({
    personIds: [],
    fieldIds: [],
    memberIds: [],
    message: '',
    finished: false,
});
const availableRoles = computed(
    () => masterdata.value?.roles.filter(role => role.groupTypeId === settings.groupTypeId) ?? [],
);
const newCount = computed(() => rows.value.filter(row => row.mode === 'new').length);
const resolvedCount = computed(() => rows.value.filter(row => row.mode === 'existing' || row.mode === 'new').length);
useDraftGuard(() => step.value !== 'start' && !attempted.value, busy);
const label = (item: { name: string; nameTranslated?: string }) => item.nameTranslated || item.name;
const personLabel = (person: TransferPerson) =>
    `${person.firstName || ''} ${person.lastName || ''} (#${person.id})${person.email ? ` · ${person.email}` : ''}`;
const groupUrl = computed(
    () =>
        `${(churchtoolsClient.getBaseUrl() || window.location.origin).replace(/\/$/, '')}/?q=churchdb#/GroupView/${progress.groupId}`,
);
const entry = (row: Row) => source.value!.entries.find(item => item.id === row.entryId)!;
function setBusy(value: boolean) {
    busy.value = value;
    emit('busy', value);
}
function resetRole() {
    settings.roleId = availableRoles.value.find(role => role.isDefault)?.id ?? 0;
}
async function prepare() {
    setBusy(true);
    error.value = '';
    try {
        const survey = await fetchSurvey(moduleId.value, props.survey.id);
        if (survey.isActive && (!survey.endDate || new Date(survey.endDate).getTime() > Date.now()))
            throw new Error('Bitte die Umfrage zuerst beenden oder deaktivieren.');
        const [entries, setup] = await Promise.all([
            fetchEntries(moduleId.value, survey.id, survey),
            loadTransferSetup(),
        ]);
        masterdata.value = setup.masterdata;
        privacyRequired.value = setup.privacyRequired;
        source.value = { survey, entries, fingerprint: fingerprint({ survey, entries }) };
        rows.value = entries
            .filter(item => item.status !== 'cancelled')
            .map(item => ({
                entryId: item.id,
                mode: 'unresolved',
                create: { firstName: '', lastName: '', email: item.email ?? '' },
                query: item.email || item.name,
                candidates: [],
                searching: false,
                error: '',
            }));
        step.value = 'people';
        for (const row of rows.value) {
            const answer = entry(row);
            if (answer.personId) {
                try {
                    row.person = await fetchTransferPerson(answer.personId);
                    row.mode = 'existing';
                } catch (cause) {
                    row.error = cause instanceof Error ? cause.message : 'Person konnte nicht geladen werden.';
                }
            } else if (answer.email) {
                try {
                    row.candidates = exactEmailMatches(await searchTransferPeople(answer.email, true), answer.email);
                } catch {
                    row.error = 'Personensuche fehlgeschlagen. Bitte erneut suchen.';
                }
            }
        }
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Vorbereitung fehlgeschlagen.';
    } finally {
        setBusy(false);
    }
}
async function search(row: Row) {
    row.searching = true;
    row.error = '';
    row.candidates = [];
    try {
        row.candidates = (await searchTransferPeople(row.query, row.query.includes('@'))).filter(
            person => !person.isArchived,
        );
    } catch (cause) {
        row.error = cause instanceof Error ? cause.message : 'Suche fehlgeschlagen.';
    } finally {
        row.searching = false;
    }
}
function choose(row: Row, person: TransferPerson) {
    row.person = person;
    row.mode = 'existing';
    row.error = '';
}
function preview() {
    error.value = '';
    try {
        const prepared = buildTransferPlan(
            source.value!.survey,
            source.value!.entries,
            rows.value,
            privacyRequired.value,
        );
        validateTransferSettings(prepared, settings, masterdata.value!);
        plan.value = prepared;
        step.value = 'preview';
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Vorbereitung unvollständig.';
    }
}
async function transfer() {
    if (attempted.value || busy.value || !plan.value) return;
    attempted.value = true;
    error.value = '';
    step.value = 'result';
    setBusy(true);
    // Freeze the exact preview. The executor also reloads the source before writing.
    const prepared = structuredClone(JSON.parse(JSON.stringify(plan.value))) as TransferPlan;
    const config = structuredClone(JSON.parse(JSON.stringify(settings))) as TransferSettings;
    try {
        await executeGroupTransfer(
            prepared,
            config,
            masterdata.value!,
            { moduleId: moduleId.value, surveyId: source.value!.survey.id, fingerprint: source.value!.fingerprint },
            progress,
        );
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'Übertragung fehlgeschlagen.';
        progress.message = 'Übertragung angehalten. Es erfolgt keine automatische Wiederholung.';
    } finally {
        setBusy(false);
    }
}
</script>

<template>
    <section class="survey-transfer survey:space-y-5" aria-labelledby="transfer-title">
        <div>
            <h2 id="transfer-title" class="survey:text-xl survey:font-bold">In neue Gruppe übernehmen</h2>
            <p>Personen zuordnen, neue Personen vorbereiten und die Antworten als Gruppenmitgliedsfelder übernehmen.</p>
        </div>
        <UAlert v-if="error" color="error" title="Übertragung nicht abgeschlossen" :description="error" />
        <template v-if="step === 'start'">
            <p>
                Die Gruppe erhält Titel und Beschreibung der Umfrage. Mitgliedsfelder werden automatisch erzeugt.
                Stornierte Antworten werden ausgelassen.
            </p>
            <p>
                Benötigt werden Rechte zum Anlegen von Gruppen, Bearbeiten der Mitgliedsfelder und Hinzufügen von
                Mitgliedern sowie gegebenenfalls zum Anlegen von Personen.
            </p>
            <UButton :loading="busy" :disabled="busy" icon="i-lucide-users" @click="prepare"
                >Übernahme vorbereiten</UButton
            >
        </template>
        <p v-if="busy" role="status">
            {{ step === 'result' ? progress.message : 'Umfrage, Stammdaten und Personen werden geprüft …' }}
        </p>
        <template v-if="step === 'people' && source && masterdata">
            <fieldset :disabled="busy" class="survey:space-y-5">
                <legend class="survey:font-bold">1. Gruppe und Mitgliedsrolle</legend>
                <p>
                    <strong>{{ source.survey.name }}</strong> · Es wird eine neue Gruppe angelegt, auch wenn bereits
                    eine gleichnamige Gruppe existiert.
                </p>
                <div class="survey:grid survey:gap-4 survey:sm:grid-cols-2">
                    <label
                        >Gruppentyp
                        <select v-model.number="settings.groupTypeId" @change="resetRole">
                            <option :value="0">Bitte wählen</option>
                            <option v-for="item in masterdata.groupTypes" :key="item.id" :value="item.id">
                                {{ label(item) }}
                            </option>
                        </select>
                    </label>
                    <label
                        >Mitgliedsrolle
                        <select v-model.number="settings.roleId">
                            <option :value="0">Bitte wählen</option>
                            <option v-for="item in availableRoles" :key="item.id" :value="item.id">
                                {{ label(item) }}
                            </option>
                        </select>
                    </label>
                </div>
                <h3 class="survey:font-bold">
                    2. Personen zuordnen · {{ resolvedCount }} von {{ rows.length }} Antworten ausgewählt
                </h3>
                <p>
                    Eine vorhandene Personen-ID wird geprüft und übernommen. E-Mail-Treffer müssen bestätigt werden. Bei
                    mehreren Antworten derselben Person bitte einen Eintrag wählen und die übrigen überspringen.
                </p>
                <p v-if="!rows.length">Es gibt keine übertragbaren Antworten.</p>
                <article
                    v-for="row in rows"
                    :key="row.entryId"
                    class="survey:rounded-lg survey:border survey:border-default survey:p-4 survey:space-y-3"
                >
                    <div>
                        <strong>{{ entry(row).name }}</strong> · Eintrag #{{ row.entryId }}
                        <p>{{ entry(row).email }}</p>
                        <p>{{ entryLabels(source.survey, entry(row)).join(', ') }}</p>
                    </div>
                    <label
                        >Aktion
                        <select v-model="row.mode">
                            <option value="unresolved">Person zuordnen</option>
                            <option v-if="row.person" value="existing">{{ personLabel(row.person) }}</option>
                            <option value="new">Neue Person anlegen</option>
                            <option value="skip">Antwort überspringen</option>
                        </select>
                    </label>
                    <template v-if="row.mode !== 'skip' && row.mode !== 'new'">
                        <div class="survey:flex survey:flex-wrap survey:items-end survey:gap-2">
                            <label class="survey:grow"
                                >Name oder E-Mail suchen<input
                                    v-model="row.query"
                                    type="search"
                                    @keydown.enter.prevent="search(row)"
                            /></label>
                            <UButton
                                variant="outline"
                                :loading="row.searching"
                                :disabled="row.searching || !row.query.trim() || busy"
                                @click="search(row)"
                                >Suchen</UButton
                            >
                        </div>
                        <p v-if="row.person && row.mode === 'existing'">Zugeordnet: {{ personLabel(row.person) }}</p>
                        <ul v-if="row.candidates.length" class="survey:space-y-2">
                            <li v-for="person in row.candidates" :key="person.id">
                                <UButton variant="outline" :disabled="busy" @click="choose(row, person)"
                                    >{{ personLabel(person) }} auswählen</UButton
                                >
                            </li>
                        </ul>
                        <p v-else-if="!row.searching">
                            Keine Vorschläge vorhanden. Suche anpassen oder eine neue Person vorbereiten.
                        </p>
                    </template>
                    <template v-if="row.mode === 'new'">
                        <div class="survey:grid survey:gap-3 survey:sm:grid-cols-3">
                            <label>Vorname<input v-model="row.create.firstName" autocomplete="off" /></label>
                            <label>Nachname<input v-model="row.create.lastName" autocomplete="off" /></label>
                            <label>E-Mail<input v-model="row.create.email" type="email" autocomplete="off" /></label>
                        </div>
                        <p>
                            Datenschutzangaben
                            {{ privacyRequired ? '(in dieser Installation erforderlich)' : '(optional)' }}: Nur eine
                            tatsächlich vorliegende Zustimmung eintragen.
                        </p>
                        <div class="survey:grid survey:gap-3 survey:sm:grid-cols-3">
                            <label
                                >Zustimmung am<input v-model="row.create.privacyPolicyAgreementDate" type="date"
                            /></label>
                            <label
                                >Art der Zustimmung<select v-model.number="row.create.privacyPolicyAgreementTypeId">
                                    <option :value="undefined">Bitte wählen</option>
                                    <option :value="1">Gruppenanmeldung</option>
                                    <option :value="2">Selbst bestätigt</option>
                                    <option :value="3">Außerhalb von ChurchTools</option>
                                    <option :value="4">Check-in</option>
                                </select></label
                            >
                            <label
                                >Zustimmung durch<select v-model.number="row.create.privacyPolicyAgreementWhoId">
                                    <option :value="undefined">Bitte wählen</option>
                                    <option :value="1">Die Person selbst</option>
                                    <option :value="2">Elternteil</option>
                                    <option :value="10000">Verantwortliche Person der Gruppenanmeldung</option>
                                </select></label
                            >
                        </div>
                    </template>
                    <p v-if="row.error" role="alert" class="survey:text-error">{{ row.error }}</p>
                </article>
                <template v-if="newCount">
                    <h3 class="survey:font-bold">Vorgaben für {{ newCount }} neue Personen</h3>
                    <div class="survey:grid survey:gap-3 survey:sm:grid-cols-2">
                        <label
                            >Personenstatus<select v-model.number="settings.personDefaults.statusId">
                                <option :value="0">Bitte wählen</option>
                                <option v-for="item in masterdata.statuses" :key="item.id" :value="item.id">
                                    {{ label(item) }}
                                </option>
                            </select></label
                        >
                        <label
                            >Standort<select v-model.number="settings.personDefaults.campusId">
                                <option :value="0">Bitte wählen</option>
                                <option v-for="item in masterdata.campuses" :key="item.id" :value="item.id">
                                    {{ label(item) }}
                                </option>
                            </select></label
                        >
                    </div>
                    <fieldset>
                        <legend>Bereiche (mindestens einer)</legend>
                        <label
                            v-for="item in masterdata.departments"
                            :key="item.id"
                            class="survey:flex survey:items-center survey:gap-2"
                            ><input
                                v-model="settings.personDefaults.departmentIds"
                                type="checkbox"
                                :value="item.id"
                            />{{ label(item) }}</label
                        >
                    </fieldset>
                </template>
                <UButton :disabled="busy || !rows.length || rows.some(row => row.searching)" @click="preview"
                    >Vorschau anzeigen</UButton
                >
            </fieldset>
        </template>
        <template v-if="step === 'preview' && plan && masterdata">
            <h3 class="survey:font-bold">3. Vorschau</h3>
            <p><strong>Neue Gruppe:</strong> {{ plan.name }}</p>
            <p class="survey:whitespace-pre-wrap">{{ plan.description || 'Keine Beschreibung vorhanden.' }}</p>
            <p>
                Gruppentyp: {{ label(masterdata.groupTypes.find(item => item.id === settings.groupTypeId)!) }} · Rolle:
                {{ label(masterdata.roles.find(item => item.id === settings.roleId)!) }}
            </p>
            <p>
                {{ plan.members.filter(member => member.create).length }} neue Personen ·
                {{ plan.members.filter(member => member.person).length }} vorhandene Personen ·
                {{ plan.skipped }} Antworten ausgelassen
            </p>
            <p>
                Die neue Gruppe hat eingeschränkte Sichtbarkeit. Alle Mitgliedsfelder werden automatisch mit
                Sicherheitsstufe 1 angelegt und nicht für das Anmeldeformular freigeschaltet.
            </p>
            <ul>
                <li v-for="field in plan.fields" :key="field.key">
                    {{ field.name }} · {{ field.fieldTypeCode
                    }}<span v-if="field.options.length && field.fieldTypeCode !== 'number'">
                        · {{ field.options.map(option => option.name).join(', ') }}</span
                    >
                </li>
            </ul>
            <div v-if="newCount">
                <strong>Neue Personen:</strong> Status
                {{ label(masterdata.statuses.find(item => item.id === settings.personDefaults.statusId)!) }}, Standort
                {{ label(masterdata.campuses.find(item => item.id === settings.personDefaults.campusId)!) }}, Bereiche
                {{
                    settings.personDefaults.departmentIds
                        .map(id => label(masterdata!.departments.find(item => item.id === id)!))
                        .join(', ')
                }}
            </div>
            <article
                v-for="member in plan.members"
                :key="member.entryId"
                class="survey:rounded-lg survey:border survey:border-default survey:p-4"
            >
                <strong>{{
                    member.person
                        ? personLabel(member.person)
                        : `${member.create!.firstName} ${member.create!.lastName} · neu`
                }}</strong>
                <p v-if="member.create">
                    {{ member.create.email
                    }}<span v-if="member.create.privacyPolicyAgreementDate">
                        · Datenschutz: {{ member.create.privacyPolicyAgreementDate }}, Art #{{
                            member.create.privacyPolicyAgreementTypeId
                        }}, durch #{{ member.create.privacyPolicyAgreementWhoId }}</span
                    >
                </p>
                <dl>
                    <template v-for="field in plan.fields" :key="field.key"
                        ><dt class="survey:font-semibold">{{ field.name }}</dt>
                        <dd class="survey:whitespace-pre-wrap">
                            {{ displayTransferValue(field, member.values[field.key]!) || '—' }}
                        </dd></template
                    >
                </dl>
            </article>
            <p>
                Mit „Jetzt übernehmen“ werden neue Personen, die neue Gruppe, Mitgliedsfelder und Mitgliedschaften
                angelegt. Bei einem Fehler können bereits Daten angelegt sein. Ein erneuter Lauf erzeugt eine weitere
                Gruppe.
            </p>
            <div class="survey:flex survey:flex-wrap survey:gap-3">
                <UButton variant="outline" :disabled="busy" @click="step = 'people'">Zurück</UButton
                ><UButton :disabled="busy || attempted" @click="transfer">Jetzt übernehmen</UButton>
            </div>
        </template>
        <template v-if="step === 'result'">
            <UAlert v-if="progress.finished" color="success" title="Gruppe angelegt" :description="progress.message" />
            <p v-else-if="!busy" role="status">{{ progress.message }}</p>
            <p v-if="progress.groupId">
                <strong>Neue Gruppe #{{ progress.groupId }}</strong> ·
                <a :href="groupUrl" target="_blank" rel="noopener">Gruppe öffnen</a>
            </p>
            <p>
                Bestätigt: {{ progress.personIds.length }} neue Personen, {{ progress.fieldIds.length }} Felder,
                {{ progress.memberIds.length }} Mitgliedschaften.
            </p>
            <p v-if="progress.personIds.length">Neue Personen-IDs: {{ progress.personIds.join(', ') }}</p>
            <p v-if="progress.fieldIds.length">Neue Mitgliedsfeld-IDs: {{ progress.fieldIds.join(', ') }}</p>
            <p v-if="progress.memberIds.length">Übernommene Personen-IDs: {{ progress.memberIds.join(', ') }}</p>
            <p v-if="!busy && !progress.finished">
                Bitte den Bestand in ChurchTools prüfen. Der fehlgeschlagene Aufruf kann trotz fehlender Bestätigung
                angekommen sein. Bereits angelegte Daten bleiben erhalten.
            </p>
        </template>
    </section>
</template>

<style scoped>
.survey-transfer label {
    display: block;
}
.survey-transfer input:not([type='checkbox']),
.survey-transfer select {
    display: block;
    width: 100%;
    padding: 0.65rem;
    border: 1px solid var(--survey-ui-border, #94a3b8);
    border-radius: 0.5rem;
    background: white;
    color: #172d23;
}
.survey-transfer :is(input, select):focus-visible {
    outline: 2px solid #166534;
    outline-offset: 2px;
}
.survey-transfer :disabled {
    opacity: 0.6;
}
.survey-transfer a {
    text-decoration: underline;
}
</style>
