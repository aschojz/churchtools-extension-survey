import { ref } from 'vue';
import type { Survey } from '../utils/types';

export function useHelper() {
    const now = ref(new Date());
    setInterval(() => {
        now.value = new Date();
    }, 10000);
    const surveyIsOpen = (survey?: Survey) => {
        if (!survey) {
            return false;
        }
        const startDate = survey.startDate ? new Date(survey.startDate) : null;
        const endDate = survey.endDate ? new Date(survey.endDate) : null;

        if (startDate && now.value < startDate) {
            return false;
        }
        if (endDate && now.value > endDate) {
            return false;
        }
        return survey.isActive;
    };

    const surveyClosesInFiveMinutes = (survey?: Survey) => {
        if (!survey?.endDate) {
            return false;
        }
        const endDate = new Date(survey.endDate);
        const fiveMinutesFromNow = new Date(now.value.getTime() + 5 * 60 * 1000);
        return now.value < endDate && fiveMinutesFromNow >= endDate;
    };
    return { surveyIsOpen, now, surveyClosesInFiveMinutes };
}
