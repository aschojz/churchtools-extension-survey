import type { SurveyType } from './types';
export const typeDefinitions: Record<SurveyType, { nameTranslated: string; description: string; icon: string }> = {
    'best-date': {
        nameTranslated: 'Datum finden',
        description: 'Den besten Termin finden.',
        icon: 'i-lucide-calendar',
    },
    'best-option': {
        nameTranslated: 'Beste Option finden',
        description: 'Die beste Option wählen.',
        icon: 'i-lucide-star',
    },
    'max-options': {
        nameTranslated: 'Optionen mit Kapazität',
        description:
            'Zum Beispiel Plätze in Workshops: Jede Option lässt sich einmal pro Antwort wählen. Mehrere Optionen sind mit Mehrfachauswahl möglich.',
        icon: 'i-lucide-list-checks',
    },
    'max-options-multiple': {
        nameTranslated: 'Mengen reservieren',
        description:
            'Zum Beispiel Material ausleihen: Teilnehmer reservieren eine Stückzahl pro Option. Gesamtkapazität und Menge pro Person lassen sich begrenzen.',
        icon: 'i-lucide-hash',
    },
};

// getRandomValues also works on local HTTP ChurchTools installations.
export function createId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
