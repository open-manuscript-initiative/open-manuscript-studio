import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Greek (Ελληνικά) locale scaffold. */
export const el: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Αγγλικά',
    hu: 'Ουγγρικά',
    de: 'Γερμανικά'
  }
};
