import { en } from './en';
import { ru } from './ru';

export const dictionaries = { ru, en };

export type Language = keyof typeof dictionaries;
export type TranslationKey = keyof typeof ru;

export function t(key: TranslationKey, language: Language = 'ru'): string {
  return dictionaries[language][key] ?? dictionaries.ru[key];
}
