import selectorParser from 'postcss-selector-parser';

// Scope generated framework CSS as well as authored styles. Portals render in #survey.
export function isolateCss() {
    return {
        postcssPlugin: 'survey-css-isolation',
        OnceExit(root) {
            const animations = new Map();
            root.walkAtRules(rule => {
                if (rule.name === 'layer')
                    rule.params = rule.params.replace(/\b(properties|theme|base|components|utilities)\b/g, 'survey-$1');
                if (rule.name.endsWith('keyframes')) {
                    animations.set(rule.params, `survey-${rule.params}`);
                    rule.params = `survey-${rule.params}`;
                }
            });
            root.walkRules(rule => {
                let parent = rule.parent;
                while (parent && parent.type !== 'root') {
                    if (parent.type === 'rule' || (parent.type === 'atrule' && parent.name.endsWith('keyframes')))
                        return;
                    parent = parent.parent;
                }
                rule.selector = selectorParser(selectors => {
                    selectors.each(selector => {
                        let isRoot = false;
                        selector.walkPseudos(pseudo => {
                            if (pseudo.value === ':root' || pseudo.value === ':host') {
                                pseudo.replaceWith(selectorParser.id({ value: 'survey' }));
                                isRoot = true;
                            }
                        });
                        if (!isRoot && !selector.toString().includes('#survey')) {
                            const prefix = selectorParser().astSync(':where(#survey)').first;
                            selector.prepend(selectorParser.combinator({ value: ' ' }));
                            selector.prepend(prefix.first.clone());
                        }
                    });
                }).processSync(rule.selector);
            });
            // Tailwind property registrations are document-wide: use extension-owned names.
            root.walkDecls(decl => {
                decl.prop = decl.prop.replace(/--tw-/g, '--survey-tw-');
                decl.value = decl.value.replace(/--tw-/g, '--survey-tw-');
                if (decl.prop.includes('animat')) {
                    for (const [name, scoped] of animations) {
                        decl.value = decl.value.replace(new RegExp(`\\b${name}\\b`, 'g'), scoped);
                    }
                }
            });
            root.walkAtRules('property', rule => {
                rule.params = rule.params.replace(/--tw-/g, '--survey-tw-');
            });
        },
    };
}
