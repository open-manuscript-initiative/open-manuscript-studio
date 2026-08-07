import type {
  OmiManuscriptState,
} from '../types/omi';
import type {
  OmiPublicationProfile,
} from './publicationProfile';

/**
 * Optional manuscript front matter that is scholarly content, not layout.
 *
 * `subtitle` already belongs to the portable manuscript state. `motto` is an
 * alpha extension while the canonical Document/Metadata specifications evolve.
 */
declare module '../types/omi' {
  interface OmiManuscriptState {
    motto?: string;
  }
}

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
