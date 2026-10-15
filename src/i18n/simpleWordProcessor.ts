export interface SimpleWordProcessorCopy {
  label: string;
  description: string;
}

const copyByLocale: Record<'en' | 'de' | 'hu', SimpleWordProcessorCopy> = {
  en: {
    label: 'Simple text editor',
    description: 'Write and format in the continuous visual view. Author details are preserved; review marks and tools are hidden.',
  },
  de: {
    label: 'Einfacher Texteditor',
    description: 'Schreiben und formatieren Sie in der fortlaufenden visuellen Ansicht. Autorendaten bleiben erhalten; Prüfvermerke und Prüfwerkzeuge werden ausgeblendet.',
  },
  hu: {
    label: 'Egyszerű szövegszerkesztő',
    description: 'Írjon és formázzon a folyamatos vizuális nézetben. A szerzői adatok megmaradnak; lektorálási jelölések és eszközök nem jelennek meg.',
  },
};

export function getSimpleWordProcessorCopy(locale: string): SimpleWordProcessorCopy {
  if (locale === 'hu' || locale === 'de') return copyByLocale[locale];
  return copyByLocale.en;
}
