import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import SurveyEditor from '../src/components/SurveyEditor.vue';
import type { SurveyNew } from '../src/utils/types';
vi.mock('../src/composables/useDraftGuard', () => ({ useDraftGuard: vi.fn() }));
const survey: SurveyNew = {
    name: 'Gespeichert',
    type: 'best-option',
    isActive: true,
    fields: [
        {
            key: 'options',
            fieldTypeCode: 'multiselect',
            options: [
                { id: 'a', nameTranslated: 'A' },
                { id: 'b', nameTranslated: 'B' },
            ],
        },
    ],
};
const container = defineComponent({
    setup(_, { slots }) {
        return () => h('div', slots.default?.());
    },
});
const input = defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        return () =>
            h('input', {
                value: props.modelValue,
                onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
            });
    },
});
const form = defineComponent({
    props: ['state'],
    emits: ['submit'],
    setup(_, { slots, emit }) {
        return () =>
            h(
                'form',
                {
                    onSubmit: (event: Event) => {
                        event.preventDefault();
                        emit('submit');
                    },
                },
                slots.default?.(),
            );
    },
});
const button = defineComponent({
    setup(_, { slots, attrs }) {
        return () => h('button', attrs, slots.default?.());
    },
});
function editor() {
    return mount(SurveyEditor, {
        props: { initial: survey },
        global: {
            stubs: {
                UForm: form,
                UInput: input,
                UTextarea: input,
                UFormField: container,
                UCard: container,
                UButton: button,
                UBadge: container,
                UAlert: container,
                UTooltip: container,
                UModal: true,
                USelect: true,
                USwitch: true,
                UInputNumber: true,
            },
        },
    });
}
describe('Einstellungsentwurf', () => {
    it('erhält einen Entwurf bei einem neuen gespeicherten Stand und synchronisiert erst ausdrücklich', async () => {
        const wrapper = editor();
        await wrapper.find('input').setValue('Mein Entwurf');
        expect(wrapper.vm.dirty).toBe(true);
        await wrapper.setProps({ initial: { ...survey, name: 'Fremde Änderung', isActive: false } });
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Mein Entwurf');
        wrapper.vm.acceptSaved({ ...survey, name: 'Bestätigt', isActive: false });
        await wrapper.vm.$nextTick();
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Bestätigt');
        expect(wrapper.vm.dirty).toBe(false);
        wrapper.unmount();
    });
    it('archiviert gespeicherte Optionen und erhält ihre IDs und Beschriftungen', async () => {
        const wrapper = editor();
        await wrapper.find('[aria-label="A: entfernen oder archivieren"]').trigger('click');
        await wrapper.find('form').trigger('submit');
        const emitted = wrapper.emitted('save')![0]![0] as SurveyNew;
        expect(emitted.fields[0]!.options).toHaveLength(2);
        expect(emitted.fields[0]!.options[0]).toMatchObject({ id: 'a', nameTranslated: 'A', archived: true });
        wrapper.unmount();
    });
    it('sperrt die Absendelogik während einer laufenden Speicherung', async () => {
        const wrapper = editor();
        await wrapper.setProps({ busy: true });
        await wrapper.find('form').trigger('submit');
        expect(wrapper.emitted('save')).toBeUndefined();
        wrapper.unmount();
    });
});
