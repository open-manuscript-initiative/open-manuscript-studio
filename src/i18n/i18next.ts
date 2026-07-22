import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, translations } from './config';

const savedLocale = window.localStorage.getItem('omi-ui-locale');

const initialLocale =
  savedLocale &&
  Object.prototype.hasOwnProperty.call(
    translations,
    savedLocale,
  )
    ? savedLocale
    : DEFAULT_LOCALE;

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: translations.en,
    },
    hu: {
      translation: translations.hu,
    },
    de: {
      translation: translations.de,
    },
  },

  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,

  interpolation: {
    escapeValue: false,
  },

  returnNull: false,
});

export default i18n;
