import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
export default defineConfig([
    globalIgnores(['dist/', 'releases/', 'node_modules/', 'auto-imports.d.ts', 'components.d.ts']),
    js.configs.recommended,
    tseslint.configs.recommended,
    pluginVue.configs['flat/essential'],
    { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
    { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
    { files: ['**/*.{ts,vue}'], rules: { 'no-undef': 'off', 'vue/multi-word-component-names': 'off' } },
]);
