import { describe, it, expect, vi } from 'vitest';
import { focusFormError } from '../src/utils/form';
describe('Validierungsfokus', () => {
    it('fokussiert das ungültige Eingabefeld statt des nicht fokussierbaren Field-Wrappers', async () => {
        document.body.innerHTML =
            '<div id="group"><input id="quantity" aria-invalid="true"></div><button id="save">Speichern</button>';
        const input = document.getElementById('quantity')!;
        vi.spyOn(input, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
        input.scrollIntoView = vi.fn();
        document.getElementById('save')!.focus();
        await focusFormError({ errors: [{ id: 'group' }] });
        expect(document.activeElement).toBe(input);
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });
});
