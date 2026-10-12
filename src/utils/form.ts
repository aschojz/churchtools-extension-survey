import { nextTick } from 'vue';
export async function focusFormError(event?: { errors: { id?: string }[] }) {
    await nextTick();
    // UForm releases its submitting state after emitting the error event.
    // Wait for that task to finish before focusing a temporarily disabled input.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const registered = document.getElementById(event?.errors[0]?.id ?? '');
    const invalid = Array.from(
        document.querySelectorAll<HTMLElement>(
            'input[aria-invalid="true"],textarea[aria-invalid="true"],button[aria-invalid="true"],[tabindex][aria-invalid="true"]',
        ),
    ).find(element => element.getClientRects().length > 0 && !element.matches(':disabled'));
    // Form errors can identify a non-focusable FormField wrapper rather than its input.
    const target =
        invalid ??
        (registered?.matches('input,textarea,select,button,[tabindex]')
            ? registered
            : registered?.querySelector<HTMLElement>('input,textarea,select,button,[tabindex]'));
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
}
