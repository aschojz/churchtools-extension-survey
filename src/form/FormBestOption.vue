<script setup lang="ts">
import { SelectInline } from '@churchtools/styleguide';
import { type FieldMultiselect, type FieldSelect, type UniformedOption } from '@churchtools/utils';
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

const options = computed(() => {
    const options = ((props.field?.options || []) as SurveyOptionNew[]).map(
        (option): UniformedOption & { count: number } => {
            const entries = getEntriesWithThisOption(props.entries, props.field.key, option);
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
    return options.map(option => ({
        ...option,
        domainType: 'group',
        initials: option.count?.toString() || '0',
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
