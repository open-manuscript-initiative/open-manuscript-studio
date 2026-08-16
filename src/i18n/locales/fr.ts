import type { TranslationDictionary } from '../types';
import { en } from './en';

/** French (français) locale scaffold. */
export const fr: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Anglais',
    hu: 'Hongrois',
    de: 'Allemand'
  }
};
