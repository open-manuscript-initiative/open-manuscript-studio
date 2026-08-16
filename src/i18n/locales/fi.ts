import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Finnish (suomi) locale scaffold. */
export const fi: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Englanti',
    hu: 'Unkari',
    de: 'Saksa'
  }
};
