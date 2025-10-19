<script setup lang="ts">
import {
    Button,
    ContentWrapper,
    editFormData,
    Input,
    SectionedCard,
    SelectInline,
    Textarea,
    type KeyValueItem,
    type LinkItem,
} from '@churchtools/styleguide';
import { CtColor, type UniformedField } from '@churchtools/utils';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSurveys } from './composables/useSurveys';
import { allowComments, isMultiSelect } from './utils/fields';
import { typeDefinitions } from './utils/helper';
import { SurveyType, type SurveyOptionNew } from './utils/types';

const { createSurvey } = useSurveys();
const router = useRouter();

const onCreateSurvey = async () => {
    await createSurvey({
        name: surveyName.value,
        description: internDescription.value,
        isActive: true,
        fields: [
            {
                fieldTypeCode: settingsData.isMulti ? 'multiselect' : 'select',
                key: 'options',
                options: options.value,
                nameTranslated: 'Optionen',
            },
        ],
        type: pollType.value!,
        surveyDescription: surveyDescription.value,
        allowComments: settingsData.allowComments,
    });
    router.push('/');
};

const pollTypeOptions = computed(() =>
    Object.values(SurveyType).map(type => ({ id: type, size: 'L' as const, ...typeDefinitions[type] })),
);

const surveyName = ref('');
const internDescription = ref('');
const surveyDescription = ref('');
const pollType = ref<SurveyType>();
const settingsData = reactive<{
    isMulti: boolean;
    allowComments: boolean;
}>({
    isMulti: true,
    allowComments: true,
});
const options = ref<SurveyOptionNew[]>([]);

const onAddOption = async () => {
    const fields: UniformedField[] = [];
    if (pollType.value === SurveyType.BEST_DATE) {
        fields.push({
            key: 'nameTranslated',
            fieldTypeCode: 'datetime',
            nameTranslated: 'Datum',
            required: true,
            validatorId: 'datetime',
        });
    } else {
        fields.push({ key: 'nameTranslated', fieldTypeCode: 'text', nameTranslated: 'Titel', required: true });
    }
    fields.push({ key: 'description', fieldTypeCode: 'textarea', nameTranslated: 'Beschreibung' });
    if (pollType.value === SurveyType.MAX_OPTIONS || pollType.value === SurveyType.MAX_OPTIONS_MULTIPLE) {
        fields.push({
            key: 'maxCount',
            fieldTypeCode: 'number',
            nameTranslated: 'Maximale Anzahl',
            validatorId: 'integer',
        });
    }
    if (pollType.value === SurveyType.MAX_OPTIONS_MULTIPLE) {
        fields.push({
            key: 'maxSelectable',
            fieldTypeCode: 'number',
            nameTranslated: 'Maximal auswählbar',
            validatorId: 'integer',
        });
    }
    const result = await editFormData({
        context: 'Umfrage erstellen',
        headline: { title: 'Option hinzufügen' },
        fields,
    });
    if (result) {
        options.value.push({ ...result, id: result.nameTranslated.toString().replace(/\W/g, '_') } as SurveyOptionNew);
    }
};

const items = computed(() =>
    options.value.map(
        (option): LinkItem => ({
            type: 'link' as const,
            value: option.nameTranslated,
            description: option.description,
            actions: [
                {
                    type: 'button' as const,
                    icon: 'fas fa-trash-alt',
                    color: CtColor.DESTRUCTIVE,
                    onClick: () => {
                        options.value = options.value.filter(o => o !== option);
                    },
                },
            ],
        }),
    ),
);

const settings = computed((): KeyValueItem[] => [
    {
        type: 'key-value',
        bold: true,
        viz: { type: 'yesno', field: isMultiSelect, value: settingsData.isMulti },
        editable: true,
    },
    {
        type: 'key-value',
        bold: true,
        viz: { type: 'yesno', field: allowComments, value: settingsData.allowComments },
        editable: true,
    },
]);
const onSetSetting = (data: { [key: string]: any }) => {
    Object.keys(data).forEach(key => {
        (settingsData as any)[key] = data[key];
    });
};
</script>
<template>
    <ContentWrapper icon="fas fa-plus" :max-width="true" title="Umfrage erstellen">
        <Input v-model="surveyName" label="Name der Umfrage" />
        <Textarea v-model="internDescription" label="Interne Beschreibung" :max-length="300" :rows="3" />
        <Textarea
            v-model="surveyDescription"
            label="Beschreibung der Umfrage"
            :max-length="300"
            note="Sichtbar für den Nutzer als Einleitung"
        />
        <SelectInline v-model="pollType" :emit-id="true" label="Umfrage-Typ" :options="pollTypeOptions" />
        <SectionedCard
            v-if="pollType"
            :actions="[{ label: 'Option hinzufügen', icon: 'fas fa-plus', onClick: onAddOption }]"
            :emptystate="{ icon: 'fas fa-list-check' }"
            :items="items"
            title="Optionen"
        />
        <SectionedCard v-if="pollType" :items="settings" title="Einstellungen" @save-item="onSetSetting" />
        <div class="flex justify-end">
            <Button
                :color="CtColor.CONSTRUCTIVE"
                icon="fas fa-plus"
                :soft-disabled="options.length < 1 || !pollType"
                @click="onCreateSurvey"
                >Umfrage erstellen</Button
            >
        </div>
    </ContentWrapper>
</template>
