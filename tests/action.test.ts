import { describe, expect, it, vi } from 'vitest';
import { useAction } from '../src/composables/useAction';
describe('Asynchrone Benutzeraktionen', () => {
    it('verhindert doppelte Speicherung während einer laufenden Anfrage', async () => {
        const action = useAction();
        let resolve!: () => void;
        const save = vi.fn(
            () =>
                new Promise<void>(done => {
                    resolve = done;
                }),
        );
        const first = action.run(save);
        expect(action.busy.value).toBe(true);
        await action.run(save);
        expect(save).toHaveBeenCalledTimes(1);
        resolve();
        await first;
        expect(action.busy.value).toBe(false);
    });
    it('zeigt Fehler und erlaubt einen erneuten Versuch', async () => {
        const action = useAction();
        await action.run(async () => {
            throw new Error('API nicht erreichbar');
        });
        expect(action.error.value).toBe('API nicht erreichbar');
        expect(action.busy.value).toBe(false);
        await action.run(async () => {});
        expect(action.error.value).toBe('');
    });
});
