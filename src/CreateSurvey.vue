<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import SurveyEditor from './components/SurveyEditor.vue';
import { useAction } from './composables/useAction';
import { usePermissions } from './composables/usePlatform';
import { useSurveys } from './composables/useSurveys';
import type { SurveyNew } from './utils/types';
const editor = ref<InstanceType<typeof SurveyEditor>>();
const router = useRouter();
const { createSurvey } = useSurveys();
const { allowed, isPending, error: permissionError } = usePermissions();
const { busy, error, run } = useAction();
const save = (survey: SurveyNew) =>
    run(async () => {
        await createSurvey(survey);
        editor.value?.acceptSaved();
        await router.push('/');
    });
</script>
<template>
    <UButton to="/" variant="link" icon="i-lucide-arrow-left" class="survey:self-start">Umfragen</UButton>
    <h1 class="survey:text-2xl survey:font-bold">Umfrage erstellen</h1>
    <UAlert v-if="error || permissionError" color="error" :title="error || permissionError?.message" />
    <p v-if="isPending" role="status">Berechtigungen werden geladen …</p>
    <SurveyEditor ref="editor" v-else-if="allowed('create custom category')" :busy="busy" @save="save" />
    <UAlert v-else title="Keine Berechtigung zum Erstellen von Umfragen" color="warning" />
</template>
