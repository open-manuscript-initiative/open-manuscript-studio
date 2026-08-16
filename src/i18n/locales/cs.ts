import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Czech (čeština) locale scaffold. */
export const cs: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Angličtina',
    hu: 'Maďarština',
    de: 'Němčina'
  }
};
