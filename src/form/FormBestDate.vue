<script setup lang="ts">
import { SelectInline } from '@churchtools/styleguide';
import { CtColor, type FieldMultiselect, type FieldSelect, type UniformedOption } from '@churchtools/utils';
import { computed } from 'vue';
import type { SurveyEntry, SurveyOptionNew } from '../utils/types';
const props = defineProps<{
    field: FieldSelect | FieldMultiselect;
    entries: SurveyEntry[];
    hideData?: boolean;
}>();
const emit = defineEmits<{
    (event: 'change', value: { [key: string]: string[] }): void;
}>();

const getEntriesWithThisOption = (option: SurveyOptionNew) => {
    return props.entries.filter(entry => {
        const fieldValue = entry.data[props.field.key];
        return Array.isArray(fieldValue) ? fieldValue.includes(option.id) : fieldValue.toString() === option.id;
    });
};

const options = computed(() => {
    const options = ((props.field?.options || []) as SurveyOptionNew[]).map(
        (option): UniformedOption & { count: number } => {
            const entries = getEntriesWithThisOption(option);
            return {
                ...option,
                size: 'L',
                count: entries.length,
                description:
                    entries.length && !props.hideData
                        ? 'Gewählt von: ' + entries.map(entry => entry.name).join(', ')
                        : '',
            };
        },
    );
    const maxCount = Math.max(...options.map(o => o.count || 0), 1);
    return options
        .sort((a, b) => new Date(a.nameTranslated).getTime() - new Date(b.nameTranslated).getTime())
        .map(option => ({
            ...option,
            nameTranslated: new Date(option.nameTranslated).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
            }),
            domainType: 'group',
            initials: option.count?.toString() || '0',
            tag:
                maxCount === option.count
                    ? { icon: 'fas fa-star' as const, color: CtColor.YELLOW, size: '0' as const }
                    : undefined,
            basicBind: {
                style:
                    maxCount === option.count
                        ? '--avatar-background: var(--color-green-secondary)'
                        : `--avatar-background: rgba(0,201,81,${option.count / maxCount + 0.2})`,
            },
        }));
});
</script>
<template>
    <SelectInline
        :emit-id="true"
        :multiple="field?.fieldTypeCode === 'multiselect'"
        :options="options"
        @update:model-value="emit('change', { [field.key]: $event as string[] })"
    />
</template>
