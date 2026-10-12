<script setup lang="ts">
import { computed, watch } from 'vue';
import { useCurrentUser, usePermissions } from '../composables/usePlatform';
import { useSurvey } from '../composables/useSurvey';
import { useSurveys } from '../composables/useSurveys';
import { useAction } from '../composables/useAction';
import { confirmAction } from '../composables/useConfirm';
import { changes, loadHistory, type Change } from '../data/history';
import { fetchEntries } from '../data/ccm';
import { clone, fingerprint } from '../utils/serialization';
import type { Survey, SurveyEntry } from '../utils/types';
import { changeDetails } from '../utils/changeDetails';
import { dateLabel } from '../utils/export';
const props = defineProps<{ id: number }>();
const { data: user } = useCurrentUser();
const { allowed } = usePermissions();
const { moduleId, survey, updateSurveyEntry } = useSurvey(
    computed(() => props.id),
    true,
);
const { updateSurvey } = useSurveys();
const { busy, error, run } = useAction();
watch(user, loadHistory, { immediate: true });
const items = computed(() =>
    changes.value.filter(change => change.module === moduleId.value && change.category === props.id),
);
function restore(change: Change) {
    return run(async () => {
        if (!(await confirmAction('Diese Änderung rückgängig machen? Neuere Änderungen werden vorher geprüft.')))
            return;
        if (change.entity === 'survey') {
            if (!allowed('edit custom category', props.id)) throw new Error('Keine Berechtigung.');
            await updateSurvey(clone(change.before) as Survey, change.after as Survey);
        } else {
            if (!allowed('edit custom data', props.id)) throw new Error('Keine Berechtigung.');
            const current = (await fetchEntries(moduleId.value, props.id)).find(entry => entry.id === change.after.id);
            if (!current || fingerprint(current) !== fingerprint(change.after))
                throw new Error('Der Eintrag wurde danach geändert. Bitte zuerst den aktuellen Stand prüfen.');
            await updateSurveyEntry({ ...(clone(change.before) as SurveyEntry), meta: current.meta });
        }
    });
}
</script>
<template>
    <section class="survey-stack">
        <h2 class="survey:text-xl survey:font-semibold">Verlauf</h2>
        <p class="survey:text-muted">
            Die letzten 20 Änderungen dieser Browser-Sitzung. Der Verlauf ist kein serverseitiges Protokoll und endet
            mit der Sitzung.
        </p>
        <UAlert v-if="error" color="error" :title="error" />
        <p v-if="!items.length">In dieser Sitzung wurden noch keine Änderungen aufgezeichnet.</p>
        <UCard v-for="change in items" :key="change.id"
            ><div class="survey:flex survey:flex-wrap survey:items-center survey:justify-between survey:gap-3">
                <div>
                    <p class="survey:font-medium">{{ change.title }}</p>
                    <p class="survey:text-sm survey:text-muted">{{ dateLabel(change.date) }}</p>
                </div>
                <UButton
                    v-if="allowed(change.entity === 'survey' ? 'edit custom category' : 'edit custom data', id)"
                    :disabled="busy"
                    variant="outline"
                    icon="i-lucide-undo-2"
                    @click="restore(change)"
                    >Rückgängig</UButton
                >
            </div>
            <details class="survey:mt-3">
                <summary class="survey:cursor-pointer survey:text-sm survey:font-medium">
                    Änderungen ansehen · Rückgängig stellt „Vorher“ wieder her
                </summary>
                <dl class="survey-stack survey:mt-3">
                    <div
                        v-for="detail in changeDetails(change, survey)"
                        :key="detail.field"
                        class="survey:grid survey:gap-2 survey:sm:grid-cols-3"
                    >
                        <dt class="survey:font-semibold">{{ detail.field }}</dt>
                        <dd class="survey:whitespace-pre-line survey:break-words">
                            <span class="survey:text-muted">Vorher: </span>{{ detail.before }}
                        </dd>
                        <dd class="survey:whitespace-pre-line survey:break-words">
                            <span class="survey:text-muted">Nachher: </span>{{ detail.after }}
                        </dd>
                    </div>
                </dl>
            </details></UCard
        >
    </section>
</template>
