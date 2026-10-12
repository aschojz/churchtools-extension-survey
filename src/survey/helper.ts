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
