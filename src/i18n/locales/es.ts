import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Spanish (español) locale scaffold. */
export const es: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Inglés',
    hu: 'Húngaro',
    de: 'Alemán'
  }
};
