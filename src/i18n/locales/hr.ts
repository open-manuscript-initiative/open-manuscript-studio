import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Croatian (hrvatski) locale scaffold. */
export const hr: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Engleski',
    hu: 'Mađarski',
    de: 'Njemački'
  }
};
