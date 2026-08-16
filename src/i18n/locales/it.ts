import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Italian (italiano) locale scaffold. */
export const it: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Inglese',
    hu: 'Ungherese',
    de: 'Tedesco'
  }
};
