import type {
  OmiManuscriptState,
} from '../types/omi.ts';
import type {
  OmiPublicationProfile,
} from './publicationProfile.ts';

/**
 * Optional manuscript front matter that is scholarly content, not layout.
 *
 * `subtitle` already belongs to the portable manuscript state. `motto` is an
 * alpha extension while the canonical Document/Metadata specifications evolve.
 */
declare module '../types/omi.ts' {
  interface OmiManuscriptState {
    motto?: string;
    titleMatter?: OmiTitleMatter;
  }
}

export interface OmiTitleMatter {
  halfTitle?: string;
  responsibilityStatement?: string;
  editionStatement?: string;
  publisherName?: string;
  publicationPlace?: string;
  publicationYear?: string;
  isbn?: string;
  copyrightStatement?: string;
  colophon?: string;
}

export type OmiTitleMatterField = keyof OmiTitleMatter;

export type OmiOptionalFrontMatterMode = 'optional';

export interface OmiPublicationFrontMatterRules {
  subtitle: {
    mode: OmiOptionalFrontMatterMode;
    position: 'below-title';
  };
  motto: {
    mode: OmiOptionalFrontMatterMode;
    position: 'below-subtitle' | 'below-title';
    style: 'italic' | 'normal';
    alignment: 'left' | 'center' | 'right';
  };
}

const DEFAULT_FRONT_MATTER_RULES: OmiPublicationFrontMatterRules = {
  subtitle: {
    mode: 'optional',
    position: 'below-title',
  },
  motto: {
    mode: 'optional',
    position: 'below-subtitle',
    style: 'italic',
    alignment: 'right',
  },
};

const PROFILE_FRONT_MATTER_RULES: Record<
  string,
  OmiPublicationFrontMatterRules
> = {
  'omi-generic-scholarly': DEFAULT_FRONT_MATTER_RULES,
  'omi-journal-author-date': {
    subtitle: {
      mode: 'optional',
      position: 'below-title',
    },
    motto: {
      mode: 'optional',
      position: 'below-subtitle',
      style: 'italic',
      alignment: 'right',
    },
  },
  'omi-humanities-notes': {
    subtitle: {
      mode: 'optional',
      position: 'below-title',
    },
    motto: {
      mode: 'optional',
      position: 'below-subtitle',
      style: 'italic',
      alignment: 'right',
    },
  },
};

export function getPublicationFrontMatterRules(
  profile: Pick<OmiPublicationProfile, 'id'>,
): OmiPublicationFrontMatterRules {
  return PROFILE_FRONT_MATTER_RULES[profile.id] ?? DEFAULT_FRONT_MATTER_RULES;
}

export function normalizeOptionalFrontMatterValue(
  value: string,
): string | undefined {
  return value.length === 0 ? undefined : value;
}

export function frontMatterIsEmpty(
  manuscript: Pick<OmiManuscriptState, 'subtitle' | 'motto'>,
): boolean {
  return !(manuscript.subtitle ?? '').trim() && !(manuscript.motto ?? '').trim();
}

export function normalizeTitleMatter(
  value: OmiTitleMatter | undefined,
): OmiTitleMatter | undefined {
  if (!value) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, item]) => [key, item.trim()])
      .filter(([, item]) => Boolean(item)),
  ) as OmiTitleMatter;
  return Object.keys(normalized).length ? normalized : undefined;
}

/**
 * Exports the alpha profile together with the explicit optional front-matter
 * rendering rules. This keeps profile export reproducible without pretending
 * that Reserved OMI-SPEC-240 already defines a normative JSON schema.
 */
export function serializePublicationProfileWithFrontMatter(
  profile: OmiPublicationProfile,
): string {
  const portable = {
    ...profile,
    rules: {
      ...profile.rules,
      frontMatter: getPublicationFrontMatterRules(profile),
    },
  };

  return `${JSON.stringify(portable, null, 2)}\n`;
}
