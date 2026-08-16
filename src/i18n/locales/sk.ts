import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Slovak (slovenčina) locale scaffold. */
export const sk: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Angličtina',
    hu: 'Maďarčina',
    de: 'Nemčina'
  }
};
