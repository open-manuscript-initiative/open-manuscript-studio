import type { OmiRenderedContributor } from './publicationRendering';

export type ContributorNamePartKind = 'given' | 'family' | 'literal';

export interface ContributorNamePart {
  kind: ContributorNamePartKind;
  text: string;
}

/**
 * Preserves the published display-name order while exposing given/family
 * components whenever the display name is a direct composition of them.
 *
 * A custom attributionName or another non-trivial public display form is kept
 * as one literal part so typesetting never rewrites the author's chosen form.
 */
export function contributorNameParts(
  contributor: Pick<
    OmiRenderedContributor,
    'displayName' | 'givenName' | 'familyName'
  >,
): ContributorNamePart[] {
  const displayName = normalize(contributor.displayName);
  const givenName = normalize(contributor.givenName);
  const familyName = normalize(contributor.familyName);

  if (!displayName) return [];

  if (givenName && familyName) {
    const givenFirst = normalize(`${givenName} ${familyName}`);
    const familyFirst = normalize(`${familyName} ${givenName}`);

    if (displayName === givenFirst) {
      return [
        { kind: 'given', text: givenName },
        { kind: 'family', text: familyName },
      ];
    }

    if (displayName === familyFirst) {
      return [
        { kind: 'family', text: familyName },
        { kind: 'given', text: givenName },
      ];
    }
  }

  if (givenName && displayName === givenName) {
    return [{ kind: 'given', text: givenName }];
  }

  if (familyName && displayName === familyName) {
    return [{ kind: 'family', text: familyName }];
  }

  return [{ kind: 'literal', text: contributor.displayName.trim() }];
}

export function joinContributorNameParts(
  parts: readonly ContributorNamePart[],
): string {
  return parts.map((part) => part.text).join(' ');
}

function normalize(value: string | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}
