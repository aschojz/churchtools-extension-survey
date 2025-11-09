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

export const surveyImage: FieldText = {
    key: 'imageUrl',
    nameTranslated: 'Bild-URL',
    fieldTypeCode: 'text',
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
export const hideDataFromParticipants: FieldCheckbox = {
    key: 'hideDataFromParticipants',
    fieldTypeCode: 'checkbox',
    nameTranslated: 'Teilnehmerdaten verbergen',
    description:
        'Die Daten der Teilnehmer werden nicht in der UI angezeigt. (Über die API sind die Daten weiterhin sichtbar.)',
};
export const askForMail: FieldCheckbox = {
    key: 'askForMail',
    fieldTypeCode: 'checkbox',
    nameTranslated: 'E-Mail-Adresse abfragen',
    description: 'Die E-Mail-Adresse der Teilnehmer abfragen, um sie später kontaktieren zu können.',
};
export const isListed: FieldCheckbox = {
    key: 'isListed',
    fieldTypeCode: 'checkbox',
    nameTranslated: 'Umfrage listen',
    description:
        'Die Umfrage in einer öffentlichen Sammlung anzeigen. Deaktivieren, um die Umfrage nur über einen direkten Link zugänglich zu machen.',
};
