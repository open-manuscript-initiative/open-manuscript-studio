import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Dutch (Nederlands) locale scaffold. */
export const nl: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Engels',
    hu: 'Hongaars',
    de: 'Duits'
  }
};
