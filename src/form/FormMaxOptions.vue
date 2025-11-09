<script setup lang="ts">
import { SelectInline } from '@churchtools/styleguide';
import { CtColor, type FieldMultiselect, type FieldSelect, type UniformedOption } from '@churchtools/utils';
import { computed } from 'vue';
import { getEntriesWithThisOption } from '../survey/helper';
import type { SurveyEntry, SurveyOptionNew } from '../utils/types';
const props = defineProps<{
    field: FieldSelect | FieldMultiselect;
    entries: SurveyEntry[];
    hideData?: boolean;
}>();
const emit = defineEmits<{
    (event: 'change', value: { [key: string]: string[] }): void;
}>();

const options = computed(() =>
    ((props.field?.options || []) as SurveyOptionNew[]).map((option): UniformedOption & { bold: boolean } => {
        const entries = getEntriesWithThisOption(props.entries, props.field.key, option);
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
