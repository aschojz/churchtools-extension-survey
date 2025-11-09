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
        if (!fieldValue) {
            return false;
        }
        return Array.isArray(fieldValue)
            ? fieldValue.includes(option.id)
            : (typeof fieldValue === 'string' ? fieldValue : fieldValue.toString()) === option.id;
    });
};

const options = computed(() =>
    ((props.field?.options || []) as SurveyOptionNew[]).map((option): UniformedOption & { bold: boolean } => {
        const entries = getEntriesWithThisOption(option);
        const necessaryCount = (option.maxCount || Infinity) - entries.length;
        return {
            ...option,
            size: 'L',
            bold: true,
            description:
                entries.length && !props.hideData ? 'Gewählt von: ' + entries.map(entry => entry.name).join(', ') : '',
            disabled: necessaryCount <= 0,
            tag: {
                label: `${entries.length} / ${option.maxCount || '∞'}`,
                color: necessaryCount <= 0 ? CtColor.CONSTRUCTIVE : necessaryCount < 2 ? CtColor.YELLOW : CtColor.BASIC,
            },
        };
    }),
);
</script>
<template>
    <SelectInline
        :emit-id="true"
        :multiple="field?.fieldTypeCode === 'multiselect'"
        :options="options"
        @update:model-value="emit('change', { [field.key]: $event as string[] })"
    />
</template>
