import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Slovenian (slovenščina) locale scaffold. */
export const sl: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Angleščina',
    hu: 'Madžarščina',
    de: 'Nemščina'
  }
};
