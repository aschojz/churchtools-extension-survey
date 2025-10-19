import type { FieldMultiselect, FieldSelect } from '@churchtools/utils';

export const SurveyType = {
    BEST_DATE: 'best-date',
    BEST_OPTION: 'best-option',
    MAX_OPTIONS: 'max-options',
    MAX_OPTIONS_MULTIPLE: 'max-options-multiple',
} as const;

export type SurveyType = (typeof SurveyType)[keyof typeof SurveyType];

export type Survey = SurveyNew & {
    meta: {
        createdDate: string;
        modifiedDate?: string;
    };
};

export type SurveyNew = {
    name: string;
    description?: string;
    fields: ((FieldSelect | FieldMultiselect) & { options: SurveyOptionNew[] })[];
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    type: SurveyType;
    surveyDescription?: string;
    allowComments?: boolean;
};

export type SurveyOptionNew = {
    id: string;
    nameTranslated: string;
    description?: string;
    maxCount?: number;
    maxSelectable?: number;
};

export type SurveyEntry = SurveyEntryNew & {
    meta: {
        createdDate: string;
        modifiedDate?: string;
    };
};

export type SurveyEntryNew = {
    name: string;
    email?: string;
    data: Record<string, string[] | number>;
    comments?: {
        comment: string;
        createdDate: string;
    }[];
};
