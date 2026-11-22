import { resolveStudioFeedbackLocale } from './studioFeedbackTranslations';

interface GooglePlayFeedbackCopy {
  label: string;
  error: string;
}

const copyByLanguage: Record<string, GooglePlayFeedbackCopy> = {
  hu: {
    label: 'Visszajelzés a Google Playen',
    error: 'Nem sikerült megnyitni a Google Play alkalmazásoldalát.',
  },
  en: {
    label: 'Feedback on Google Play',
    error: 'Unable to open the app page on Google Play.',
  },
  de: {
    label: 'Feedback über Google Play',
    error: 'Die App-Seite in Google Play konnte nicht geöffnet werden.',
  },
  fr: {
    label: 'Donner un avis sur Google Play',
    error: "Impossible d'ouvrir la fiche de l'application sur Google Play.",
  },
  it: {
    label: 'Invia feedback su Google Play',
    error: "Impossibile aprire la pagina dell'app su Google Play.",
  },
  es: {
    label: 'Enviar comentarios en Google Play',
    error: 'No se pudo abrir la página de la aplicación en Google Play.',
  },
  nl: {
    label: 'Feedback geven via Google Play',
    error: 'De app-pagina op Google Play kan niet worden geopend.',
  },
  pl: {
    label: 'Prześlij opinię w Google Play',
    error: 'Nie można otworzyć strony aplikacji w Google Play.',
  },
};

export function getGooglePlayFeedbackCopy(locale: string): GooglePlayFeedbackCopy {
  return copyByLanguage[resolveStudioFeedbackLocale(locale)] ?? copyByLanguage.en;
}
