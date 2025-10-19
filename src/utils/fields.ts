import type { FieldCheckbox, FieldSelect, FieldText, FieldTextarea } from '@churchtools/utils';
import { typeDefinitions } from './helper';
import { SurveyType } from './types';

export const name: FieldText = {
    key: 'name',
    nameTranslated: 'Name der Umfrage',
    fieldTypeCode: 'text',
};

export const internDescription: FieldTextarea = {
    key: 'description',
    nameTranslated: 'Interne Beschreibung',
    fieldTypeCode: 'textarea',
    maxLength: 300,
};

export const surveyDescription: FieldTextarea = {
    key: 'surveyDescription',
    nameTranslated: 'Beschreibung der Umfrage',
    fieldTypeCode: 'textarea',
};

export const pollType: FieldSelect = {
    key: 'type',
    nameTranslated: 'Umfragetyp',
    fieldTypeCode: 'select',
    options: Object.values(SurveyType).map(type => ({ id: type, ...typeDefinitions[type] })),
};

export const isMultiSelect: FieldCheckbox = {
    key: 'isMulti',
    fieldTypeCode: 'checkbox',
    nameTranslated: 'Mehrfachauswahl',
    description: 'Es können mehrere Optionen ausgewählt werden anstatt nur eine einzige.',
};
export const allowComments: FieldCheckbox = {
    key: 'allowComments',
    fieldTypeCode: 'checkbox',
    nameTranslated: 'Kommentare erlauben',
    description: 'Es können Kommentare unter der Umfrage hinzugefügt werden',
};
