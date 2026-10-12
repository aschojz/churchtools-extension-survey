import { churchtoolsClient } from '@churchtools/churchtools-client';
import ui from '@nuxt/ui/vue-plugin';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';
import { startupPending, startupError } from './data/startup';
import { queryClient } from './data/queryClient';
import { router } from './router';
import './tailwind.css';
const settings = (window as Window & { settings?: { base_url?: string } }).settings;
churchtoolsClient.setBaseUrl(settings?.base_url ?? import.meta.env.VITE_BASE_URL ?? window.location.origin);
churchtoolsClient.setLoadCSRFForAPI();
startupPending.value = true;
createApp(App).use(router).use(ui).use(VueQueryPlugin, { queryClient }).mount('#survey');
async function initialize() {
    try {
        const username = import.meta.env.VITE_USERNAME;
        const password = import.meta.env.VITE_PASSWORD;
        if (import.meta.env.DEV && username && password) {
            const user = await churchtoolsClient.get<{ id: number }>('/whoami').catch(() => null);
            if (!user || user.id <= 0) await churchtoolsClient.post('/login', { username, password });
        }
    } catch {
        startupError.value =
            'Die Anmeldung ist fehlgeschlagen. Prüfe die Entwicklungs-Zugangsdaten und lade die Seite erneut.';
    } finally {
        startupPending.value = false;
    }
}
void initialize();
