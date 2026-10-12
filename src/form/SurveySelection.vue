<script setup lang="ts">
import { computed, useId } from 'vue';
import { getEntryDataValue } from '../survey/helper';
import { optionLabel } from '../utils/export';
import { optionCount } from '../utils/validation';
import type { SurveyEntry, SurveyNew } from '../utils/types';
const props = defineProps<{
    survey: SurveyNew;
    entries: SurveyEntry[];
    modelValue: Record<string, string[] | number>;
    hideData?: boolean;
    availabilityKnown?: boolean;
    disabled?: boolean;
    originalData?: Record<string, string[] | number>;
}>();
const emit = defineEmits<{ 'update:modelValue': [data: Record<string, string[] | number>] }>();
const selectionId = useId();
const field = computed(() => props.survey.fields[0]);
const selected = computed(() => getEntryDataValue(props.modelValue, field.value.key));
const options = computed(() => {
    const options = field.value.options.filter(
        option =>
            !option.archived ||
            (props.survey.type === 'max-options-multiple'
                ? Number(props.originalData?.[option.id]) > 0
                : getEntryDataValue(props.originalData ?? {}, field.value.key).includes(option.id)),
    );
    if (props.survey.type === 'best-date')
        options.sort((a, b) => new Date(a.nameTranslated).getTime() - new Date(b.nameTranslated).getTime());
    return options.map(option => {
        const count = optionCount(props.survey, props.entries, option);
        const remaining =
            props.availabilityKnown === false || !option.maxCount ? Infinity : Math.max(0, option.maxCount - count);
        return {
            ...option,
            count,
            remaining,
            limit: option.archived
                ? Number(props.originalData?.[option.id] ?? 0)
                : Math.min(option.maxSelectable || Infinity, remaining),
            label: optionLabel(props.survey, option),
        };
    });
});
function toggle(id: string, checked: boolean) {
    const values =
        field.value.fieldTypeCode === 'select'
            ? checked
                ? [id]
                : []
            : checked
              ? [...new Set([...selected.value, id])]
              : selected.value.filter(value => value !== id);
    emit('update:modelValue', { [field.value.key]: values });
}
function quantity(id: string, count: number | undefined) {
    emit('update:modelValue', { ...props.modelValue, [id]: count ?? 0 });
}
</script>
<template>
    <fieldset class="survey-stack survey-selection">
        <legend class="survey:sr-only">Optionen auswählen</legend>
        <p v-if="originalData" class="survey:text-sm survey:text-muted">
            Archivierte Auswahl bleibt erhalten und kann reduziert werden. Die Verfügbarkeit zeigt zusätzliche Kapazität
            ohne deine bisherige Antwort.
        </p>

        <URadioGroup
            v-if="field.fieldTypeCode === 'select' && survey.type !== 'max-options-multiple'"
            :model-value="selected[0]"
            :items="
                options.map(option => ({
                    value: option.id,
                    label: option.label + (option.archived ? ' (archiviert)' : ''),
                    disabled: disabled || (survey.type === 'max-options' && option.remaining === 0),
                    description: [
                        option.description,
                        survey.type === 'max-options'
                            ? availabilityKnown === false
                                ? 'Verfügbarkeit wird beim Absenden geprüft'
                                : Number.isFinite(option.remaining)
                                  ? `${option.remaining} verfügbar`
                                  : 'Unbegrenzt'
                            : !hideData
                              ? `${option.count} ${option.count === 1 ? 'Stimme' : 'Stimmen'}`
                              : '',
                        !hideData
                            ? entries
                                  .filter(
                                      entry =>
                                          entry.status !== 'cancelled' &&
                                          getEntryDataValue(entry.data, field.key).includes(option.id),
                                  )
                                  .map(entry => entry.name)
                                  .join(', ')
                            : '',
                    ]
                        .filter(Boolean)
                        .join(' · '),
                }))
            "
            class="survey-radio-choices"
            size="lg"
            :highlight="true"
            variant="card"
            @update:model-value="toggle(String($event), true)"
        />
        <template v-else
            ><div
                v-for="option in options"
                :key="option.id"
                class="survey-choice-card"
                :class="{
                    'is-selected':
                        survey.type === 'max-options-multiple'
                            ? Number(modelValue[option.id]) > 0
                            : selected.includes(option.id),
                    'is-unavailable': option.remaining === 0 && !option.archived,
                }"
            >
                <div class="survey-choice-row">
                    <div class="survey:min-w-0 survey:flex-1">
                        <UFormField
                            v-if="survey.type === 'max-options-multiple'"
                            :name="`selection.${option.id}`"
                            :label="option.label + (option.archived ? ' (archiviert)' : '')"
                            :description="option.description"
                            class="survey-quantity-field"
                            ><UInputNumber
                                class="survey-quantity-control"
                                size="xl"
                                :disable-wheel-change="true"
                                :increment="{ size: 'lg', variant: 'soft', color: 'primary' }"
                                :decrement="{ size: 'lg', variant: 'soft', color: 'primary' }"
                                :model-value="
                                    typeof modelValue[option.id] === 'number' ? Number(modelValue[option.id]) : 0
                                "
                                :min="0"
                                :max="Number.isFinite(option.limit) ? option.limit : undefined"
                                :disabled="disabled || (!option.archived && option.remaining === 0)"
                                @update:model-value="quantity(option.id, $event)"
                        /></UFormField>
                        <UCheckbox
                            v-else
                            :id="`${selectionId}-option-${option.id}`"
                            variant="card"
                            size="lg"
                            :highlight="true"
                            class="survey-checkbox-choice"
                            :model-value="selected.includes(option.id)"
                            :name="`selection.${option.id}`"
                            :label="option.label + (option.archived ? ' (archiviert)' : '')"
                            :description="option.description"
                            :disabled="
                                disabled ||
                                (survey.type === 'max-options' &&
                                    option.remaining === 0 &&
                                    !selected.includes(option.id))
                            "
                            @update:model-value="toggle(option.id, $event === true)"
                        />
                    </div>
                    <UBadge
                        v-if="survey.type.startsWith('max-options')"
                        :color="option.remaining === 0 ? 'warning' : 'neutral'"
                        variant="subtle"
                        >{{
                            option.archived
                                ? 'Archiviert · nur bestehende Auswahl'
                                : availabilityKnown === false
                                  ? 'Prüfung beim Absenden'
                                  : Number.isFinite(option.remaining)
                                    ? `${option.remaining} verfügbar`
                                    : 'Unbegrenzt'
                        }}</UBadge
                    >
                    <UBadge v-else-if="!hideData" variant="subtle"
                        >{{ option.count }} {{ option.count === 1 ? 'Stimme' : 'Stimmen' }}</UBadge
                    >
                </div>
                <details
                    v-if="!hideData && survey.type !== 'max-options-multiple' && option.count"
                    class="survey:mt-2 survey:text-sm survey:text-muted"
                >
                    <summary>Wer hat diese Option gewählt?</summary>
                    <p class="survey:mt-2">
                        Gewählt von:
                        {{
                            entries
                                .filter(
                                    entry =>
                                        entry.status !== 'cancelled' &&
                                        getEntryDataValue(entry.data, field.key).includes(option.id),
                                )
                                .map(entry => entry.name)
                                .join(', ')
                        }}
                    </p>
                </details>
            </div></template
        >
    </fieldset>
</template>
