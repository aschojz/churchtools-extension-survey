import { churchtoolsClient } from '@churchtools/churchtools-client';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { startupPending, startupError } from '../data/startup';
import { KEY } from '../config';
export function usePlugin() {
    const query = useQuery({
        enabled: () => !startupPending.value && !startupError.value,
        queryKey: ['survey-module', KEY],
        queryFn: () => churchtoolsClient.get<{ id: number }>(`/custommodules/${encodeURIComponent(KEY)}`),
    });
    return { ...query, moduleId: computed(() => query.data.value?.id ?? 0) };
}
