import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Romanian (română) locale scaffold. */
export const ro: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Engleză',
    hu: 'Maghiară',
    de: 'Germană'
  }
};
