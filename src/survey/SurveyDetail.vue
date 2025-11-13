<script setup lang="ts">
import {
    ContentWrapper,
    editFormData,
    LoadingMessage,
    SectionedCard,
    StatusCard,
    type DropdownItem,
    type KeyValueItem,
    type LinkItem,
} from '@churchtools/styleguide';
import { CtColor, type UniformedOption } from '@churchtools/utils';
import { computed, ref } from 'vue';
import type { ComponentProps } from 'vue-component-type-helpers';
import { useSurvey } from '../composables/useSurvey';
import { useSurveyEdit } from '../composables/useSurveyEdit';
import { useSurveys } from '../composables/useSurveys';
import {
    allowComments,
    askForMail,
    hideDataFromParticipants,
    internDescription,
    isListed,
    isMultiSelect,
    name,
    pollType,
    surveyDescription,
    surveyImage,
} from '../utils/fields';
import { typeDefinitions } from '../utils/helper';
import { encodeId } from '../utils/tokenHelper';
import type { Survey } from '../utils/types';
import DetailBestOption from './DetailBestOption.vue';
import DetailMaxOptions from './DetailMaxOptions.vue';
import DetailMaxOptionsMultiple from './DetailMaxOptionsMultiple.vue';
import { getEntriesWithThisOption } from './helper';

const props = defineProps<{
    id: string;
}>();

const now = ref(new Date());
setInterval(() => {
    now.value = new Date();
}, 30000);

const surveyId = computed(() => parseInt(props.id));
const { updateSurvey } = useSurveys();
const { survey, isPending, surveyEntries } = useSurvey(surveyId);
const saveSurvey = (updatedFields: Partial<Survey>) => updateSurvey({ id: surveyId.value, ...updatedFields });

const setStartDateItem = computed(
    (): DropdownItem => ({
        id: 'startDate',
        nameTranslated: 'Öffnen planen',
        icon: 'fas fa-door-open',
        callback: async () => {
            const result = await setOrEditDate();
            if (result) {
                saveSurvey({ startDate: result.date, isActive: true });
            }
        },
    }),
);
const startDateKeyValueItem = computed(
    (): KeyValueItem => ({
        type: 'key-value',
        viz: {
            field: {
                key: 'startDate',
                fieldTypeCode: 'datetime',
                nameTranslated: 'Öffnungsdatum',
                validatorId: 'datetime',
            },
            type: 'datetime',
            value: survey.value?.startDate,
        },
        editable: true,
        onSave: saveSurvey,
    }),
);
const endDateItem = computed(
    (): DropdownItem => ({
        id: 'endDate',
        nameTranslated: 'Schließen planen',
        icon: 'fas fa-door-closed',
        callback: async () => {
            const result = await setOrEditDate();
            if (result) {
                saveSurvey({ endDate: result.date });
            }
        },
    }),
);
const endDateKeyValueItem = computed(
    (): KeyValueItem => ({
        type: 'key-value',
        viz: {
            field: {
                key: 'endDate',
                fieldTypeCode: 'datetime',
                nameTranslated: 'Schließdatum',
                validatorId: 'datetime',
            },
            type: 'datetime',
            value: survey.value?.endDate,
        },
        editable: true,
        onSave: saveSurvey,
    }),
);

const statusCard = computed((): ComponentProps<typeof StatusCard> => {
    if (!survey.value) {
        return {} as ComponentProps<typeof StatusCard>;
    }
    const dropdownItems: DropdownItem[] = [];
    if (!survey.value.startDate) {
        dropdownItems.push(setStartDateItem.value);
    }
    if (!survey.value.endDate) {
        dropdownItems.push(endDateItem.value);
    }

    const openingDate = survey.value.startDate
        ? new Date(survey.value.startDate)
        : new Date(survey.value.meta.createdDate);
    const closingDate = survey.value.endDate ? new Date(survey.value.endDate) : null;

    const sectionedCardItems: KeyValueItem[] = [];
    if (survey.value.startDate && (openingDate > now.value || !survey.value.isActive)) {
        sectionedCardItems.push(startDateKeyValueItem.value);
    }
    if (closingDate && closingDate > now.value) {
        sectionedCardItems.push(endDateKeyValueItem.value);
    }
    if (survey.value.isActive) {
        if (closingDate && closingDate < now.value) {
            return {
                color: CtColor.BASIC,
                icon: 'fas fa-door-closed',
                title: 'Umfrage geschlossen',
                description: `Geschlossen am ${closingDate.toLocaleString()}`,
                buttons: [
                    {
                        button: {
                            label: 'Wieder öffnen',
                            outlined: true,
                            color: CtColor.BASIC,
                            onClick: () => saveSurvey({ isActive: true, endDate: '', startDate: '' }),
                        },
                    },
                ],
            };
        } else if (openingDate > now.value) {
            return {
                color: CtColor.WARNING,
                icon: 'fas fa-door-closed',
                title: 'Umfrage noch nicht geöffnet',
                description: `Öffnet am ${openingDate.toLocaleString()}`,
                buttons: [
                    {
                        button: {
                            label: 'Jetzt öffnen',
                            outlined: true,
                            color: CtColor.BASIC,
                            onClick: () => saveSurvey({ startDate: '' }),
                        },
                        dropdown: [{ items: dropdownItems }],
                    },
                ],
                sectionedCardItems,
            };
        } else {
            return {
                color: CtColor.CONSTRUCTIVE,
                icon: 'fas fa-door-open',
                title: 'Umfrage offen',
                description: `Geöffnet am ${openingDate.toLocaleString()}`,
                buttons: [
                    {
                        button: {
                            label: 'Temp. deaktivieren',
                            outlined: true,
                            color: CtColor.BASIC,
                            onClick: () => saveSurvey({ isActive: false }),
                        },
                        dropdown: [{ items: dropdownItems }],
                    },
                ],
                sectionedCardItems,
            };
        }
    } else {
        return {
            color: CtColor.BASIC,
            icon: 'fas fa-circle-dashed',
            title: 'Inaktiv',
            buttons: [
                {
                    button: {
                        label: 'Aktivieren',
                        color: CtColor.CONSTRUCTIVE,
                        onClick: () => saveSurvey({ isActive: true }),
                    },
                    dropdown: [{ items: dropdownItems }],
                },
            ],
            sectionedCardItems,
        };
    }
});

const setOrEditDate = async (date: string = '') => {
    return await editFormData({
        context: 'Umfrage Termin setzen/bearbeiten',
        fields: [{ fieldTypeCode: 'datetime', key: 'date', nameTranslated: 'Datum', validatorId: 'datetime' }],
        formData: { date },
    });
};

const baseItems = computed((): KeyValueItem[] => {
    return [
        {
            type: 'key-value',
            viz: { field: name, type: 'text', value: survey.value?.name || '' },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            viz: { field: internDescription, type: 'text', value: survey.value?.description || '' },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            viz: { field: surveyDescription, type: 'text', value: survey.value?.surveyDescription || '' },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            viz: { field: surveyImage, type: 'text', value: survey.value?.imageUrl || '' },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            viz: {
                field: pollType,
                type: 'tags',
                value: pollType.options
                    .flatMap(o => ('options' in o ? o.options : o) as UniformedOption)
                    .filter(opt => opt.id === survey.value?.type),
            },
        },
    ];
});

const { createOrEditOption } = useSurveyEdit();
const optionsItems = computed((): LinkItem[] => {
    if (!survey.value) {
        return [];
    }
    return survey.value.fields[0].options.map(option => {
        const count = getEntriesWithThisOption(surveyEntries.value, survey.value!.fields[0].key, option).length;
        return {
            type: 'link',
            value: option.nameTranslated,
            description: option.description,
            bold: true,
            tags: [
                {
                    color:
                        count === option.maxCount
                            ? CtColor.CONSTRUCTIVE
                            : !option.maxCount || count / option.maxCount < 0.5
                              ? CtColor.BASIC
                              : count / option.maxCount < 0.75
                                ? CtColor.YELLOW
                                : CtColor.LIME,
                    label: `${count}/${option.maxCount || '∞'}`,
                },
            ],
            actions: [
                {
                    type: 'button',
                    icon: 'fas fa-pen',
                    onClick: async () => {
                        const result = await createOrEditOption(survey.value!, option);
                        if (result) {
                            const updatedOptions = survey.value!.fields[0].options.map(opt =>
                                opt.id === option.id ? { ...opt, ...result } : opt,
                            );
                            saveSurvey({ fields: [{ ...survey.value!.fields[0], options: updatedOptions }] });
                        }
                    },
                },
            ],
        };
    });
});

const settingsItems = computed((): KeyValueItem[] => {
    return [
        {
            type: 'key-value',
            bold: true,
            viz: {
                type: 'yesno',
                field: isMultiSelect,
                value: survey.value?.fields[0].fieldTypeCode === 'multiselect' || false,
            },
            editable: true,
            onSave: ({ isMulti }) =>
                saveSurvey({
                    fields: [{ ...survey.value!.fields[0], fieldTypeCode: isMulti ? 'multiselect' : 'select' }],
                }),
        },
        {
            type: 'key-value',
            bold: true,
            viz: { type: 'yesno', field: allowComments, value: survey.value?.allowComments || false },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            bold: true,
            viz: { type: 'yesno', field: askForMail, value: survey.value?.askForMail || false },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            bold: true,
            viz: { type: 'yesno', field: isListed, value: survey.value?.isListed || false },
            editable: true,
            onSave: saveSurvey,
        },
        {
            type: 'key-value',
            bold: true,
            viz: {
                type: 'yesno',
                field: hideDataFromParticipants,
                value: survey.value?.hideDataFromParticipants || false,
            },
            editable: true,
            onSave: saveSurvey,
        },
    ];
});
</script>
<template>
    <ContentWrapper
        v-if="survey"
        :actions="[
            {
                type: 'button',
                icon: 'fas fa-eye',
                label: 'Vorschau',
                outlined: true,
                href: `/ccm/survey/form/${encodeId(survey.id)}`,
                target: '_blank',
                iconAfter: 'fas fa-external-link',
            },
        ]"
        :breadcrumbs="[{ title: 'Umfragen', to: '/' }, { title: survey.name }]"
        :color="typeDefinitions[survey!.type].color"
        :icon="typeDefinitions[survey!.type].icon"
        :max-width="true"
        :title="survey?.name"
    >
        <LoadingMessage v-if="isPending" />
        <template v-else>
            <StatusCard v-bind="statusCard" />
            <SectionedCard :items="baseItems" />
            <SectionedCard :items="optionsItems" title="Optionen">
                <!-- <template #default="{ item }">
                    <div class="flex justify-between">
                        <div>
                            <span class="text-body-m-emphasized">{{ item.viz }}</span>
                        </div>
                        <Tag :label="item.viz" />
                    </div>
                </template> -->
            </SectionedCard>
            <SectionedCard :items="settingsItems" title="Einstellungen" />
            <DetailMaxOptions v-if="survey?.type === 'max-options'" :id="surveyId" />
            <DetailMaxOptionsMultiple v-else-if="survey?.type === 'max-options-multiple'" :id="surveyId" />
            <DetailBestOption
                v-else-if="survey?.type === 'best-option' || survey?.type === 'best-date'"
                :id="surveyId"
            />
        </template>
    </ContentWrapper>
</template>
