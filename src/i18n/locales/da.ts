import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Danish (dansk) locale scaffold. */
export const da: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Engelsk',
    hu: 'Ungarsk',
    de: 'Tysk'
  }
};
