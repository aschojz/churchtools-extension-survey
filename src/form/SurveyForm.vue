<script setup lang="ts">
import {
    Button,
    Card,
    ContentWrapper,
    InfoBox,
    Input,
    LoadingMessage,
    SectionHeader,
    Textarea,
} from '@churchtools/styleguide';
import { CtColor, useCurrentUser } from '@churchtools/utils';
import { computed, onMounted, ref, watch } from 'vue';
import { useHelper } from '../composables/useHelper';
import { useSurvey } from '../composables/useSurvey';
import { decodeId } from '../utils/tokenHelper';
import FormBestDate from './FormBestDate.vue';
import FormBestOption from './FormBestOption.vue';
import FormMaxOptions from './FormMaxOptions.vue';
import FormMaxOptionsMultiple from './FormMaxOptionsMultiple.vue';

const props = defineProps<{
    id: string;
}>();

const id = computed(() => decodeId(props.id));
const { survey, createSurveyEntry, surveyEntries, isPending } = useSurvey(id);

onMounted(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nameParam = urlParams.get('name');
    const emailParam = urlParams.get('email');
    if (nameParam) {
        name.value = nameParam;
    }
    if (emailParam) {
        email.value = emailParam;
    }
    init();
});
const init = () => {
    if (survey.value) {
        document.title = `Umfrage - ${survey.value.name}`;
    }
};
watch(survey, init);

const currentUser = useCurrentUser();
watch(
    () => currentUser.isLoading,
    () => {
        if (currentUser.isLoggedIn && currentUser.person) {
            name.value = [currentUser.person.firstName, currentUser.person.lastName].join(' ');
            email.value = currentUser.person.email;
        }
    },
);
const { surveyIsOpen, now, surveyClosesInFiveMinutes } = useHelper();

const firstField = computed(() => survey.value?.fields[0]);

const name = ref<string>('');
const email = ref<string | undefined>();
const selectedOptions = ref<string[]>([]);
const data = ref<{ [key: string]: string[] | number }>({});
const comment = ref('');
const successMessage = ref(false);
const onCreateSurveyEntry = () => {
    createSurveyEntry({
        name: name.value,
        email: email.value?.toLocaleLowerCase(),
        personId: currentUser?.id > 0 ? currentUser.id : undefined,
        data: data.value,
        comments: comment.value ? [{ comment: comment.value, createdDate: new Date().toISOString() }] : [],
    });
    clearForm();
    successMessage.value = true;
    setTimeout(() => {
        successMessage.value = false;
    }, 2000);
};

const clearForm = () => {
    name.value = '';
    email.value = '';
    selectedOptions.value = [];
    data.value = {};
    comment.value = '';
};

const allComments = computed(() => {
    return surveyEntries.value
        .flatMap(entry => (entry.comments || []).map(c => ({ ...c, name: entry.name })))
        .reverse();
});
</script>
<template>
    <ContentWrapper
        :description="surveyIsOpen(survey) ? survey?.surveyDescription : ''"
        :max-width="true"
        :title="surveyIsOpen(survey) ? survey?.name : ''"
    >
        <template #hero>
            <img v-if="survey?.imageUrl" class="mb-8 h-48 w-full rounded-md object-cover" :src="survey?.imageUrl" />
        </template>
        <LoadingMessage v-if="isPending" />
        <InfoBox
            v-else-if="!surveyIsOpen(survey)"
            :description="
                survey?.isActive === false || !survey?.startDate || now > new Date(survey.startDate)
                    ? 'Die Umfrage ist derzeit geschlossen und kann nicht ausgefüllt werden.'
                    : `Die Umfrage startet am ${new Date(survey.startDate).toLocaleString()}`
            "
            title="Umfrage geschlossen"
            :type="CtColor.WARNING"
        />
        <InfoBox
            v-else-if="successMessage"
            description="Dein Eintrag ist erfolgreich eingegangen."
            title="Vielen Dank"
            :type="CtColor.SUCCESS"
        />
        <template v-else-if="firstField">
            <InfoBox
                v-if="surveyClosesInFiveMinutes(survey)"
                :description="`Die Umfrage wird in Kürze (${new Date(survey!.endDate!).toLocaleString()}) geschlossen und kann dann nicht mehr ausgefüllt werden.`"
                title="Umfrage wird geschlossen"
                :type="CtColor.WARNING"
            />
            <form action="#" class="flex flex-col gap-4" @submit.prevent="onCreateSurveyEntry">
                <Input v-model="name" label="Name" :required="true" />
                <Input v-if="survey?.askForMail" v-model="email" label="E-Mail-Adresse" :required="true" type="email" />
                <FormMaxOptionsMultiple
                    v-if="survey?.type === 'max-options-multiple'"
                    :entries="surveyEntries"
                    :field="firstField"
                    :hide-data="survey.hideDataFromParticipants"
                    @change="data = $event"
                />
                <FormMaxOptions
                    v-else-if="survey?.type === 'max-options'"
                    :entries="surveyEntries"
                    :field="firstField"
                    :hide-data="survey.hideDataFromParticipants"
                    @change="data = $event"
                />
                <FormBestDate
                    v-else-if="survey?.type === 'best-date'"
                    :entries="surveyEntries"
                    :field="firstField"
                    :hide-data="survey.hideDataFromParticipants"
                    @change="data = $event"
                />
                <FormBestOption
                    v-else
                    :entries="surveyEntries"
                    :field="firstField"
                    :hide-data="survey?.hideDataFromParticipants"
                    @change="data = $event"
                />
                <Textarea v-if="survey?.allowComments" v-model="comment" label="Kommentar" :rows="3" />
                <div class="flex justify-end">
                    <Button
                        :color="CtColor.CONSTRUCTIVE"
                        :disabled="Object.keys(data).length === 0"
                        icon="fas fa-paper-plane"
                        type="submit"
                    >
                        Absenden
                    </Button>
                </div>
            </form>

            <div
                v-if="survey?.allowComments && !survey?.hideDataFromParticipants && allComments.length"
                class="flex flex-col gap-2"
                style="--card-px: 1rem; --card-py: 0.75rem"
            >
                <SectionHeader title="Kommentare" />
                <Card v-for="comment in allComments" :key="comment.createdDate">
                    <div>
                        <span class="font-bold">{{ comment.name }} </span> ·
                        <span class="text-basic-tertiary text-sm">{{
                            new Date(comment.createdDate).toLocaleString(undefined, {
                                timeStyle: 'short',
                                dateStyle: 'short',
                            })
                        }}</span>
                    </div>
                    <div class="text-gray-700">{{ comment.comment }}</div>
                </Card>
            </div>
        </template>
    </ContentWrapper>
</template>
