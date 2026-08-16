import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Portuguese (português) locale scaffold. */
export const pt: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Inglês',
    hu: 'Húngaro',
    de: 'Alemão'
  }
};
