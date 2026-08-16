import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Bulgarian (български) locale scaffold. */
export const bg: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Английски',
    hu: 'Унгарски',
    de: 'Немски'
  }
};
