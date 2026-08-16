import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Swedish (svenska) locale scaffold. */
export const sv: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Engelska',
    hu: 'Ungerska',
    de: 'Tyska'
  }
};
