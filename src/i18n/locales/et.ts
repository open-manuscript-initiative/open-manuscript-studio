import type { TranslationDictionary } from '../types';
import { en } from './en';

/** Estonian (eesti) locale scaffold. */
export const et: TranslationDictionary = {
  ...en,
  languages: {
    en: 'Inglise',
    hu: 'Ungari',
    de: 'Saksa'
  }
};
