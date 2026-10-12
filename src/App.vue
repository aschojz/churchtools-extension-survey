<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { startupPending, startupError } from './data/startup';
import { de } from '@nuxt/ui/locale';
import { usePlugin } from './composables/usePlugin';
import { confirmMessage, confirmOpen, resolveConfirm } from './composables/useConfirm';
function reload() {
    window.location.reload();
}
const renderingError = ref('');
onErrorCaptured(() => {
    renderingError.value =
        'Die Ansicht konnte nicht dargestellt werden. Bitte die Seite neu laden oder gespeicherte Daten prüfen.';
    return false;
});
const { isPending, error, refetch } = usePlugin();
</script>
<template>
    <UApp :locale="de" portal="#survey">
        <main class="survey-page survey-stack">
            <div
                v-if="startupPending || (isPending && !startupError)"
                role="status"
                class="survey:flex survey:items-center survey:gap-2"
            >
                <UIcon name="i-lucide-loader-circle" class="survey:animate-spin" />Umfragen werden geladen …
            </div>
            <UAlert
                v-else-if="startupError || renderingError"
                color="error"
                title="Die Extension konnte nicht gestartet werden"
                :description="startupError || renderingError"
                :actions="[{ label: 'Seite neu laden', onClick: reload }]"
            />
            <UAlert
                v-else-if="error"
                color="error"
                title="Die Extension konnte nicht geladen werden"
                :description="error.message"
                :actions="[{ label: 'Erneut versuchen', onClick: () => refetch() }]"
            />
            <RouterView v-else />
        </main>
        <UModal
            :open="confirmOpen"
            title="Bitte bestätigen"
            :description="confirmMessage"
            @update:open="!$event && resolveConfirm(false)"
        >
            <template #footer
                ><UButton color="neutral" variant="outline" @click="resolveConfirm(false)">Abbrechen</UButton
                ><UButton color="error" @click="resolveConfirm(true)">Bestätigen</UButton></template
            >
        </UModal>
    </UApp>
</template>
