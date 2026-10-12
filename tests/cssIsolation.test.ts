import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { isolateCss } from '../scripts/isolate-css';

describe('Isolation gegenüber ChurchTools', () => {
    it('begrenzt Framework-Selektoren einschließlich universeller Initialisierung auf die Extension', async () => {
        document.body.innerHTML =
            '<header id="menu1"><a class="navigation">ChurchTools</a></header><div id="survey"><a class="navigation">Survey</a><div role="dialog">Portal</div></div>';
        const result = await postcss([isolateCss()]).process(
            '@layer base { * { --tw-outline-style: solid } :root,:host { --ui-bg: white } a:focus-visible { outline-offset: 0 } .navigation { font-size: 16px } [role="dialog"] { color: green } }',
            { from: undefined },
        );
        const rules: string[] = [];
        result.root.walkRules(rule => {
            rules.push(rule.selector);
        });
        const host = document.querySelector('#menu1 .navigation')!;
        expect(rules.some(selector => host.matches(selector))).toBe(false);
        expect(rules.some(selector => document.querySelector('#survey .navigation')!.matches(selector))).toBe(true);
        expect(rules.some(selector => document.querySelector('#survey')!.matches(selector))).toBe(true);
        expect(rules.some(selector => document.querySelector('[role="dialog"]')!.matches(selector))).toBe(true);
        expect(result.css).toContain('@layer survey-base');
        document.body.innerHTML = '';
    });
    it('lässt verschachtelte Media-Regeln innerhalb der bereits begrenzten Regel funktionieren', async () => {
        const result = await postcss([isolateCss()]).process(
            '.control { &:hover { color: green } } @media (width > 600px) { .control { display:flex } }',
            { from: undefined },
        );
        expect(result.css).toContain(':where(#survey) .control');
        expect(result.css).toContain('&:hover');
        expect(result.css).not.toContain(':where(#survey) &:hover');
    });
    it('isoliert globale Tailwind-Properties und Animationen', async () => {
        const result = await postcss([isolateCss()]).process(
            '@property --tw-ring-color { syntax:"*"; inherits:false } @keyframes spin { to { transform:rotate(360deg) } } :root { --animate-spin:spin 1s linear infinite } .ring { color:var(--tw-ring-color); animation:spin 1s }',
            { from: undefined },
        );
        expect(result.css).not.toContain('--tw-');
        expect(result.css).toContain('@property --survey-tw-ring-color');
        expect(result.css).toContain('@keyframes survey-spin');
        expect(result.css).toContain('--animate-spin:survey-spin');
        expect(result.css).toContain('animation:survey-spin');
        expect(result.css).toContain('to { transform:rotate');
    });
});
