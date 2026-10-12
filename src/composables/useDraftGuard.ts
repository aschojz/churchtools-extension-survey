import { onBeforeUnmount, onMounted, toValue, type MaybeRefOrGetter } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { confirmAction } from './useConfirm';
export function useDraftGuard(dirty: MaybeRefOrGetter<boolean>, busy: MaybeRefOrGetter<boolean> = false) {
    async function guard() {
        if (toValue(busy)) return false;
        return (
            !toValue(dirty) || (await confirmAction('Ungespeicherte Änderungen verwerfen und diese Seite verlassen?'))
        );
    }
    onBeforeRouteLeave(guard);
    onBeforeRouteUpdate((to, from) => (to.params.id !== from.params.id ? guard() : true));
    function beforeUnload(event: BeforeUnloadEvent) {
        if (toValue(dirty) || toValue(busy)) {
            event.preventDefault();
            event.returnValue = '';
        }
    }
    onMounted(() => window.addEventListener('beforeunload', beforeUnload));
    onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
}
