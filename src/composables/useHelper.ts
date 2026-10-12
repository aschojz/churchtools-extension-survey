import { onScopeDispose, ref } from 'vue';
import type { SurveyNew } from '../utils/types';

export function useHelper() {
    const now = ref(new Date());
    const timer = setInterval(() => {
        now.value = new Date();
    }, 10000);
    onScopeDispose(() => clearInterval(timer));
    const surveyIsOpen = (survey?: SurveyNew) => {
        if (!survey) {
            return false;
        }
        const startDate = survey.startDate ? new Date(survey.startDate) : null;
        const endDate = survey.endDate ? new Date(survey.endDate) : null;

        if (startDate && now.value < startDate) {
            return false;
        }
        if (endDate && now.value >= endDate) {
            return false;
        }
        return survey.isActive;
    };

    const surveyClosesInFiveMinutes = (survey?: SurveyNew) => {
        if (!survey?.endDate) {
            return false;
        }
        const endDate = new Date(survey.endDate);
        const fiveMinutesFromNow = new Date(now.value.getTime() + 5 * 60 * 1000);
        return now.value < endDate && fiveMinutesFromNow >= endDate;
    };
    const surveyStatus = (survey: SurveyNew) => {
        if (!survey.isActive)
            return { label: 'Deaktiviert', color: 'neutral' as const, description: 'Die Teilnahme ist deaktiviert.' };
        if (survey.endDate && now.value >= new Date(survey.endDate))
            return {
                label: 'Beendet',
                color: 'warning' as const,
                description: `Beendet am ${new Date(survey.endDate).toLocaleString('de-DE')}`,
            };
        if (survey.startDate && now.value < new Date(survey.startDate))
            return {
                label: 'Geplant',
                color: 'info' as const,
                description: `Öffnet am ${new Date(survey.startDate).toLocaleString('de-DE')}`,
            };
        return {
            label: 'Offen',
            color: 'success' as const,
            description: survey.endDate
                ? `Schließt am ${new Date(survey.endDate).toLocaleString('de-DE')}`
                : 'Teilnahme ohne festes Schließdatum.',
        };
    };
    return { surveyIsOpen, surveyStatus, now, surveyClosesInFiveMinutes };
}
