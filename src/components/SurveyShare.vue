<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { basePath } from '../config';
import { encodeId } from '../utils/tokenHelper';
import { useAction } from '../composables/useAction';
const props = defineProps<{ id: number }>();
const token = computed(() => encodeId(props.id));
const link = computed(() => new URL(`${basePath}form/${token.value}`, window.location.origin).href);
const open = ref(false),
    image = ref(''),
    copied = ref(false);
const { run, error } = useAction();
watch(link, () => {
    copied.value = false;
    image.value = '';
});
async function copy() {
    return run(async () => {
        if (navigator.clipboard) await navigator.clipboard.writeText(link.value);
        else {
            const element = document.createElement('textarea');
            element.value = link.value;
            element.style.position = 'fixed';
            element.style.opacity = '0';
            document.body.append(element);
            element.select();
            const done = document.execCommand('copy');
            element.remove();
            if (!done) throw new Error('Bitte den Link im Feld markieren und kopieren.');
        }
        copied.value = true;
    });
}
async function show() {
    open.value = true;
    await run(async () => {
        image.value = await QRCode.toDataURL(link.value, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    });
}
</script>
<template>
    <div class="survey:flex survey:flex-wrap survey:gap-2">
        <UButton :to="link" external target="_blank" variant="outline" icon="i-lucide-external-link"
            >Teilnahmeformular</UButton
        >
        <UButton variant="outline" icon="i-lucide-share-2" @click="show">Teilen</UButton>
    </div>
    <UModal
        v-model:open="open"
        title="Umfrage teilen"
        description="Über diesen Link können Teilnehmer die Umfrage ausfüllen."
    >
        <template #body
            ><div class="survey-stack survey:items-center">
                <UAlert v-if="error" color="error" :title="error" />
                <img v-if="image" :src="image" width="256" height="256" alt="QR-Code zum Teilnahmeformular" />
                <UFormField label="Teilnahmelink" class="survey:w-full"
                    ><UInput
                        :model-value="link"
                        readonly
                        class="survey:w-full"
                        @focus="($event.target as HTMLInputElement).select()"
                /></UFormField>
                <p class="survey:text-sm survey:text-muted">Das Teilnahmeformular speichert echte Antworten.</p>
            </div></template
        >
        <template #footer
            ><UButton icon="i-lucide-copy" @click="copy">{{ copied ? 'Link kopiert' : 'Link kopieren' }}</UButton
            ><UButton v-if="image" :href="image" :download="`umfrage-${id}-qr.png`" variant="outline"
                >QR-Code herunterladen</UButton
            ></template
        >
    </UModal>
</template>
