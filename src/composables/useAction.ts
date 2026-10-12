import { ref } from 'vue';
export function useAction() {
    const busy = ref(false);
    const error = ref('');
    async function run(action: () => Promise<unknown>) {
        if (busy.value) return;
        busy.value = true;
        error.value = '';
        try {
            await action();
        } catch (cause) {
            error.value = cause instanceof Error ? cause.message : 'Die Aktion konnte nicht ausgeführt werden.';
        } finally {
            busy.value = false;
        }
    }
    return { busy, error, run };
}
