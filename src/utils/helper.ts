import { CtColor, type FAIcon } from '@churchtools/utils';
import type { SurveyType } from './types';

export const typeDefinitions: Record<
    SurveyType,
    { nameTranslated: string; description: string; icon: FAIcon; color: CtColor }
> = {
    'best-date': {
        nameTranslated: 'Datum finden',
        description: 'Eine Umfrage um den besten Termin zu finden.',
        icon: 'fas fa-calendar-alt',
        color: CtColor.AMBER,
    },
    'best-option': {
        nameTranslated: 'Beste Option finden',
        description: 'Eine Umfrage um die beste Option aus mehreren zu wählen.',
        icon: 'fas fa-star',
        color: CtColor.CONSTRUCTIVE,
    },
    'max-options': {
        nameTranslated: 'Optionen mit maximaler Anzahl',
        description:
            'Eine Umfrage bei der Optionen eine maximale Anzahl haben können. Der Teilnehmer kann jede Optionen maximal 1x wählen.',
        icon: 'fas fa-poll',
        color: CtColor.BLUE,
    },
    'max-options-multiple': {
        nameTranslated: 'Optionen mit maximaler Anzahl (Mehrfachauswahl)',
        description:
            'Eine Umfrage bei der Optionen eine maximale Anzahl haben können. Der Teilnehmer kann eine Optionen auch mehrfach wählen.',
        icon: 'fas fa-hashtag',
        color: CtColor.CYAN,
    },
};
