import type { KeyValueItem } from '@churchtools/styleguide';
import type { SurveyEntry, SurveyOptionNew } from '../utils/types';

export const getEntryDataValue = (entryData: Record<string, string[] | number>, key: string) => {
    const value = entryData[key];
    return value && Array.isArray(value) ? value : value ? [value.toString()] : [];
};

export const getEntriesWithThisOption = (entries: SurveyEntry[], key: string, option: SurveyOptionNew) => {
    return entries.filter(entry => {
        const fieldValue = entry.data[key];
        if (!fieldValue) {
            return false;
        }
        return Array.isArray(fieldValue)
            ? fieldValue.includes(option.id)
            : (typeof fieldValue === 'string' ? fieldValue : fieldValue.toString()) === option.id;
    });
};

export const settingsItems = ({
    isMulti,
    allowComments,
}: {
    isMulti: boolean;
    allowComments: boolean;
}): KeyValueItem[] => [
    {
        type: 'key-value',
        bold: true,
        viz: {
            type: 'yesno',
            field: {
                key: 'isMulti',
                fieldTypeCode: 'checkbox',
                nameTranslated: 'Mehrfachauswahl',
                description: 'Es können mehrere Optionen ausgewählt werden anstatt nur eine einzige.',
            },
            value: isMulti,
        },
        editable: true,
    },
    {
        type: 'key-value',
        bold: true,
        viz: {
            type: 'yesno',
            field: {
                key: 'allowComments',
                fieldTypeCode: 'checkbox',
                nameTranslated: 'Kommentare erlauben',
                description: 'Es können Kommentare unter der Umfrage hinzugefügt werden',
            },
            value: allowComments,
        },
        editable: true,
    },
];
