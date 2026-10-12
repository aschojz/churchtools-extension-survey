import { ref } from 'vue';
import type { Survey, SurveyEntry } from '../utils/types';
import { clone } from '../utils/serialization';
import { queryClient } from './queryClient';
export type Change = {
    id: string;
    module: number;
    category: number;
    entity: 'survey' | 'entry';
    title: string;
    date: string;
    before: Survey | SurveyEntry;
    after: Survey | SurveyEntry;
};
export const changes = ref<Change[]>([]);
let loadedKey = '';
function key() {
    const user = queryClient.getQueryData<{ id: number }>(['survey-current-user']);
    return `survey-history:${user?.id ?? 'guest'}`;
}
export function loadHistory() {
    const next = key();
    if (loadedKey === next) return;
    loadedKey = next;
    try {
        changes.value = JSON.parse(sessionStorage.getItem(next) ?? '[]');
    } catch {
        changes.value = [];
    }
}
export function recordChange(change: Omit<Change, 'id' | 'date'>) {
    loadHistory();
    changes.value = [
        { ...clone(change), id: `${Date.now()}-${Math.random()}`, date: new Date().toISOString() },
        ...changes.value,
    ].slice(0, 20);
    try {
        sessionStorage.setItem(loadedKey, JSON.stringify(changes.value));
    } catch {
        /* History remains available in memory. */
    }
}
