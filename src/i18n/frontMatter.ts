export interface FrontMatterCopy {
  subtitle: string;
  subtitleOptional: string;
  subtitlePlaceholder: string;
  motto: string;
  mottoOptional: string;
  mottoPlaceholder: string;
  frontMatter: string;
  frontMatterDescription: string;
  optional: string;
  belowTitle: string;
  belowSubtitle: string;
  italic: string;
  normal: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
}

const COPY: Record<'en' | 'hu' | 'de', FrontMatterCopy> = {
  en: {
    subtitle: 'Subtitle',
    subtitleOptional: 'Subtitle (optional)',
    subtitlePlaceholder: 'Add an optional subtitle',
    motto: 'Motto',
    mottoOptional: 'Motto (optional)',
    mottoPlaceholder: 'Add an optional motto or epigraph',
    frontMatter: 'Title block',
    frontMatterDescription:
      'Subtitle and motto are independent optional scholarly front-matter fields.',
    optional: 'Optional',
    belowTitle: 'Below title',
    belowSubtitle: 'Below subtitle',
    italic: 'Italic',
    normal: 'Normal',
    alignLeft: 'Left',
    alignCenter: 'Center',
    alignRight: 'Right',
  },
  hu: {
    subtitle: 'Alcím',
    subtitleOptional: 'Alcím (opcionális)',
    subtitlePlaceholder: 'Opcionális alcím megadása',
    motto: 'Mottó',
    mottoOptional: 'Mottó (opcionális)',
    mottoPlaceholder: 'Opcionális mottó vagy epigráf megadása',
    frontMatter: 'Címblokk',
    frontMatterDescription:
      'Az alcím és a mottó egymástól független, opcionális tudományos előanyagmező.',
    optional: 'Opcionális',
    belowTitle: 'A cím alatt',
    belowSubtitle: 'Az alcím alatt',
    italic: 'Dőlt',
    normal: 'Normál',
    alignLeft: 'Balra',
    alignCenter: 'Középre',
    alignRight: 'Jobbra',
  },
  de: {
    subtitle: 'Untertitel',
    subtitleOptional: 'Untertitel (optional)',
    subtitlePlaceholder: 'Optionalen Untertitel hinzufügen',
    motto: 'Motto',
    mottoOptional: 'Motto (optional)',
    mottoPlaceholder: 'Optionales Motto oder Epigraph hinzufügen',
    frontMatter: 'Titelblock',
    frontMatterDescription:
      'Untertitel und Motto sind voneinander unabhängige optionale wissenschaftliche Frontmatter-Felder.',
    optional: 'Optional',
    belowTitle: 'Unter dem Titel',
    belowSubtitle: 'Unter dem Untertitel',
    italic: 'Kursiv',
    normal: 'Normal',
    alignLeft: 'Links',
    alignCenter: 'Zentriert',
    alignRight: 'Rechts',
  },
};

export function getFrontMatterCopy(locale: string): FrontMatterCopy {
  const primary = locale.trim().toLowerCase().split('-')[0];
  if (primary === 'hu' || primary === 'de') return COPY[primary];
  return COPY.en;
}
