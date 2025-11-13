<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { alertConfirm, editFormData, SectionedCard, type LinkItem } from '@churchtools/styleguide';
import {
    GROUP_STATUS_ID,
    notNullish,
    useGroupMutations,
    useGroupTypes,
    type DomainObjectPerson,
    type Group,
    type GroupMemberFieldGroup,
    type GroupMemberFieldGroupCreate,
} from '@churchtools/utils';
import { computed } from 'vue';
import { useSurvey } from '../composables/useSurvey';
import type { SurveyEntry } from '../utils/types';
import { getEntryDataValue } from './helper';
import { useSurveyHelper } from './useSurveyHelper';

const props = defineProps<{
    id: number;
}>();

const surveyId = computed(() => props.id);
const { survey, surveyEntries } = useSurvey(surveyId);
const { entryActions } = useSurveyHelper(surveyId);

const entries = computed(() => {
    if (!survey.value) {
        return [];
    }
    return surveyEntries.value.map((entry): LinkItem & SurveyEntry => {
        const ids = getEntryDataValue(entry.data, survey.value!.fields[0].key);
        return {
            ...entry,
            type: 'link',
            bold: true,
            description: [new Date(entry.meta.createdDate).toLocaleString(), entry.email]
                .filter(notNullish)
                .join(' · '),
            value: [entry.name, entry.personId ? ` (#${entry.personId})` : ''].join(''),

            tags: ids
                .map(value => {
                    const option = survey.value!.fields[0].options.find(opt => opt.id.toString() === value);
                    if (!option) {
                        return null;
                    }
                    return {
                        label: option.nameTranslated,
                    };
                })
                .filter(notNullish),
            content: entry.comments?.length ? entry.comments[0].comment : undefined,
            actions: entryActions(entry),
        };
    });
});

const { createGroup: createGroupFunc } = useGroupMutations();
const { groupTypes } = useGroupTypes();
const createGroup = async (): Promise<Group['id']> => {
    const groupPayload = await editFormData({
        context: 'Gruppe erstellen',
        dirtyNecessary: false,
        fields: [
            {
                fieldTypeCode: 'text',
                key: 'name',
                nameTranslated: 'Name der Gruppe',
                required: true,
                defaultValue: survey.value?.name || '',
            },
            {
                fieldTypeCode: 'select',
                key: 'groupTypeId',
                nameTranslated: 'Gruppentyp',
                required: true,
                options: groupTypes.value,
            },
        ],
        formData: {
            name: survey.value?.name || '',
            groupTypeId: groupTypes.value[0]?.id,
        },
    });
    if (groupPayload) {
        const group = await createGroupFunc({ ...groupPayload, groupStatusId: GROUP_STATUS_ID.ACTIVE });
        return group.id;
    }
    throw new Error('Gruppe wurde nicht erstellt');
};

const createMemberFields = async (groupId: Group['id']) => {
    return await churchtoolsClient.post<GroupMemberFieldGroup>(`/groups/${groupId}/memberfields/group`, {
        defaultValue: '',
        fieldTypeCode: 'select',
        name: 'Auswahl',
        options: survey.value?.fields[0].options.map(o => ({ id: o.id, name: o.nameTranslated })) || [],
        requiredInRegistrationForm: true,
        securityLevel: 1,
        sortKey: 0,
        useInRegistrationForm: true,
    } as GroupMemberFieldGroupCreate);
};

const addMemberToGroup = async (groupId: number, field: { id: number }, entry: SurveyEntry) => {
    const ids = getEntryDataValue(entry.data, survey.value!.fields[0].key);
    return await churchtoolsClient.put(`/groups/${groupId}/members/${entry.personId}?only_add=true`, {
        personId: entry.personId,
        groupMemberStatus: 'active',
        groupTypeRoleId: 11,
        memberStartDate: '2025-11-09',
        fields: ids.length
            ? {
                  [field.id]: Array.isArray(ids) ? ids.map(id => parseInt(id)) : [parseInt(ids)],
              }
            : {},
    });
};

const onTransferToGroup = async () => {
    // const groupId = await createGroup();
    console.log(createGroup);
    const groupId = 2305;

    // const field = await createMemberFields(groupId);
    console.log(createMemberFields);
    const field = { id: 2017 };
    for (const entry of surveyEntries.value) {
        let personId = entry.personId;
        if (!entry.personId) {
            const persons = await churchtoolsClient.get<DomainObjectPerson[]>(
                `/search?query=${encodeURIComponent(entry.email || entry.name)}&type=person`,
            );
            if (persons.length === 1) {
                personId = parseInt(persons[0].domainIdentifier);
            } else {
                const result = await alertConfirm({
                    title: 'Person nicht gefunden',
                    description: `Die Person für den Eintrag mit der E-Mail "${
                        entry.email || entry.name
                    }" konnte nicht eindeutig gefunden werden. Es wurden ${persons.length} Personen gefunden.`,
                    button: 'OK',
                });
                if (result !== 'ok') {
                    break;
                }
            }
            if (personId) {
                await addMemberToGroup(groupId, field, { ...entry, personId });
            }
        }
    }
};
console.log(onTransferToGroup);
</script>
<template>
    <!-- <SectionedCard
        :actions="[{ iconAfter: 'fas fa-arrow-right', label: 'In Gruppe übertragen', onClick: onTransferToGroup }]"
        :emptystate="{ icon: 'fas fa-list-check', title: 'Noch keine Einträge vorhanden.' }"
        :items="entries"
        title="Einträge"
    /> -->
    <SectionedCard
        :emptystate="{ icon: 'fas fa-list-check', title: 'Noch keine Einträge vorhanden.' }"
        :items="entries"
        title="Einträge"
    />
</template>
