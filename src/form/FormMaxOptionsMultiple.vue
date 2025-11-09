<script setup lang="ts">
import { Input } from '@churchtools/styleguide';
import type { FieldMultiselect, FieldSelect, UniformedOption } from '@churchtools/utils';
import { computed, reactive } from 'vue';
import { getEntriesWithThisOption } from '../survey/helper';
import type { SurveyEntry, SurveyOptionNew } from '../utils/types';

const props = defineProps<{
    field: FieldSelect | FieldMultiselect;
    entries: SurveyEntry[];
    hideData?: boolean;
}>();
const emit = defineEmits<{
    (event: 'change', value: { [key: string]: number }): void;
}>();

const data = reactive<{ [key: string]: number }>({});
const onSetData = (optionId: string, value: number | string) => {
    data[optionId] = typeof value === 'string' ? parseInt(value) : value;
    emit('change', data);
};

const options = computed(() => {
    return ((props.field?.options || []) as (UniformedOption & SurveyOptionNew)[]).map(option => {
        const entriesCount = getEntriesWithThisOption(props.entries, props.field.key, option).length;
        const necessaryCount = (option.maxCount || Infinity) - entriesCount;
        return {
            ...option,
            disabled: necessaryCount <= 0,
            maxSelectable: option.maxSelectable ? Math.min(option.maxSelectable, necessaryCount) : necessaryCount,
            label: option.nameTranslated + ` (${necessaryCount} verfügbar)`,
        };
    });
});
</script>
<template>
    <div class="flex flex-col gap-4">
        <Input
            v-for="option in options"
            :key="option.id"
            :disabled="option.disabled"
            :input-bind="{ max: option.maxSelectable }"
            :label="option.label"
            :note="option.description"
            type="number"
            @update:model-value="onSetData(option.id, $event)"
        />
    </div>
</template>
