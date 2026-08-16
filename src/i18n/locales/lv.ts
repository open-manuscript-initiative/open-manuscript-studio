import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Latvian (latviešu) locale scaffold. */
export const lv: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Angļu',
    hu: 'Ungāru',
    de: 'Vācu'
  }
};
