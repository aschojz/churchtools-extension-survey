import ui from '@nuxt/ui/vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import { isolateCss } from './scripts/isolate-css.js';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    const key = env.VITE_KEY || 'survey';
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Ungültiger Extension-Key');
    return {
        base: `/ccm/${key}/`,
        css: { postcss: { plugins: [isolateCss()] } },
        plugins: [
            vue(),
            tailwindcss(),
            ui({
                colorMode: false,
                theme: { prefix: 'survey' },
                experimental: { componentDetection: true },
                icon: { clientBundle: { scan: true } },
            }),
        ],
        resolve: { dedupe: ['vue', '@tanstack/vue-query'] },
    };
});
