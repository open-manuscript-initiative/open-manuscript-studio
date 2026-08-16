import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Polish (polski) locale scaffold. */
export const pl: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Angielski',
    hu: 'Węgierski',
    de: 'Niemiecki'
  }
};
