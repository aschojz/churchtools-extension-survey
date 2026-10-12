import { ref, shallowRef } from 'vue';
export const confirmMessage = ref('');
export const confirmOpen = ref(false);
const resolver = shallowRef<((answer: boolean) => void) | undefined>();
export function confirmAction(message: string) {
    if (resolver.value) resolver.value(false);
    confirmMessage.value = message;
    confirmOpen.value = true;
    return new Promise<boolean>(resolve => {
        resolver.value = resolve;
    });
}
export function resolveConfirm(answer: boolean) {
    resolver.value?.(answer);
    resolver.value = undefined;
    confirmOpen.value = false;
}
