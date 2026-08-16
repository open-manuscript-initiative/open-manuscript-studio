import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Irish (Gaeilge) locale scaffold. */
export const ga: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Béarla',
    hu: 'Ungáiris',
    de: 'Gearmáinis'
  }
};
