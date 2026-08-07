import type {
  OmiCitationStyleId,
  OmiCrossReferenceNumbering,
  OmiManuscript,
  OmiManuscriptState,
  OmiSectionNumberingStyle,
} from '../types/omi';

export const OMI_PUBLICATION_PROFILE_MODEL =
  'omi-publication-profile-alpha-0.1' as const;

export type OmiPublicationOutputFormat =
  | 'html'
  | 'jats'
  | 'docx'
  | 'pdf'
  | 'epub';

export type OmiPublicationRequirement =
  | 'off'
  | 'recommended'
  | 'required';

export interface OmiPublicationProfileReference {
  id: string;
  version: string;
}

export interface OmiPublicationProfileLayoutRules {
  pageSize: 'A4' | 'Letter';
  columns: 1 | 2;
  marginMm: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontFamily: 'serif' | 'sans-serif';
  baseFontSizePt: number;
  lineHeight: number;
  textAlign: 'left' | 'justified';
}

export interface OmiPublicationProfileSectionRules {
  numberingStyle: OmiSectionNumberingStyle;
  maxNumberedDepth: number;
}

export interface OmiPublicationProfileCitationRules {
  style: OmiCitationStyleId;
  bibliographyHeading: boolean;
}

export interface OmiPublicationProfileNoteRules {
  placement: 'footnotes' | 'endnotes' | 'interactive';
  restartNumbering: 'document' | 'section';
}

export interface OmiPublicationProfileObjectRules {
  numbering: OmiCrossReferenceNumbering;
  figureCaptionPosition: 'above' | 'below';
  tableCaptionPosition: 'above' | 'below';
  equationNumbering: 'document' | 'section';
}

export interface OmiPublicationProfileContributorRules {
  showAffiliations: boolean;
  affiliationMode: 'inline' | 'markers';
  showOrcid: boolean;
  showCorrespondingMarker: boolean;
}

export interface OmiPublicationProfileMetadataRules {
  requireTitle: boolean;
  requireAbstract: boolean;
  minimumKeywords: number;
  requireContributor: boolean;
  affiliation: OmiPublicationRequirement;
  orcid: OmiPublicationRequirement;
}

export interface OmiPublicationProfileAccessibilityRules {
  figureAltText: OmiPublicationRequirement;
  tableHeaders: OmiPublicationRequirement;
  semanticHeadings: OmiPublicationRequirement;
}

export interface OmiPublicationProfileRules {
  layout: OmiPublicationProfileLayoutRules;
  sections: OmiPublicationProfileSectionRules;
  citations: OmiPublicationProfileCitationRules;
  notes: OmiPublicationProfileNoteRules;
  objects: OmiPublicationProfileObjectRules;
  contributors: OmiPublicationProfileContributorRules;
  metadata: OmiPublicationProfileMetadataRules;
  accessibility: OmiPublicationProfileAccessibilityRules;
  outputs: OmiPublicationOutputFormat[];
}

export interface OmiPublicationProfile {
  model: typeof OMI_PUBLICATION_PROFILE_MODEL;
  id: string;
  version: string;
  name: string;
  description: string;
  publisher?: string;
  rules: OmiPublicationProfileRules;
}

export type OmiPublicationProfileIssueSeverity = 'error' | 'warning';

export type OmiPublicationProfileIssueCode =
  | 'missing-title'
  | 'missing-abstract'
  | 'too-few-keywords'
  | 'missing-contributor'
  | 'missing-affiliation'
  | 'missing-orcid'
  | 'missing-figure-alt'
  | 'missing-table-header'
  | 'unresolved-citation'
  | 'unresolved-cross-reference'
  | 'profile-override';

export interface OmiPublicationProfileIssue {
  code: OmiPublicationProfileIssueCode;
  severity: OmiPublicationProfileIssueSeverity;
  targetId?: string;
  detail?: string;
}

/**
 * Alpha Studio attachment point for a preferred publication profile.
 *
 * OMI-SPEC-240 is still Reserved, so this field is intentionally marked as an
 * implementation experiment rather than a normative conformance claim.
 */
declare module '../types/omi' {
  interface OmiManuscriptState {
    publicationProfile?: OmiPublicationProfileReference;
  }
}

const GENERIC_PROFILE: OmiPublicationProfile = {
  model: OMI_PUBLICATION_PROFILE_MODEL,
  id: 'omi-generic-scholarly',
  version: '0.1.0',
  name: 'OMI Generic Scholarly',
  description:
    'A neutral single-column scholarly profile for portable authoring and general-purpose publication.',
  publisher: 'Open Manuscript Initiative',
  rules: {
    layout: {
      pageSize: 'A4',
      columns: 1,
      marginMm: { top: 25, right: 25, bottom: 25, left: 25 },
      fontFamily: 'serif',
      baseFontSizePt: 11,
      lineHeight: 1.45,
      textAlign: 'left',
    },
    sections: {
      numberingStyle: 'decimal',
      maxNumberedDepth: 3,
    },
    citations: {
      style: 'apa-7',
      bibliographyHeading: true,
    },
    notes: {
      placement: 'footnotes',
      restartNumbering: 'document',
    },
    objects: {
      numbering: 'document',
      figureCaptionPosition: 'below',
      tableCaptionPosition: 'above',
      equationNumbering: 'document',
    },
    contributors: {
      showAffiliations: true,
      affiliationMode: 'markers',
      showOrcid: true,
      showCorrespondingMarker: true,
    },
    metadata: {
      requireTitle: true,
      requireAbstract: false,
      minimumKeywords: 0,
      requireContributor: true,
      affiliation: 'recommended',
      orcid: 'recommended',
    },
    accessibility: {
      figureAltText: 'required',
      tableHeaders: 'recommended',
      semanticHeadings: 'required',
    },
    outputs: ['html', 'jats', 'docx', 'pdf', 'epub'],
  },
};

const AUTHOR_DATE_PROFILE: OmiPublicationProfile = {
  model: OMI_PUBLICATION_PROFILE_MODEL,
  id: 'omi-journal-author-date',
  version: '0.1.0',
  name: 'OMI Journal — Author-Date',
  description:
    'A journal-oriented profile with author-date citations, structured metadata requirements and section-scoped scholarly-object numbering.',
  publisher: 'Open Manuscript Initiative',
  rules: {
    layout: {
      pageSize: 'A4',
      columns: 1,
      marginMm: { top: 22, right: 22, bottom: 24, left: 22 },
      fontFamily: 'serif',
      baseFontSizePt: 10.5,
      lineHeight: 1.4,
      textAlign: 'justified',
    },
    sections: {
      numberingStyle: 'decimal',
      maxNumberedDepth: 3,
    },
    citations: {
      style: 'apa-7',
      bibliographyHeading: true,
    },
    notes: {
      placement: 'endnotes',
      restartNumbering: 'document',
    },
    objects: {
      numbering: 'section',
      figureCaptionPosition: 'below',
      tableCaptionPosition: 'above',
      equationNumbering: 'section',
    },
    contributors: {
      showAffiliations: true,
      affiliationMode: 'markers',
      showOrcid: true,
      showCorrespondingMarker: true,
    },
    metadata: {
      requireTitle: true,
      requireAbstract: true,
      minimumKeywords: 3,
      requireContributor: true,
      affiliation: 'required',
      orcid: 'recommended',
    },
    accessibility: {
      figureAltText: 'required',
      tableHeaders: 'required',
      semanticHeadings: 'required',
    },
    outputs: ['html', 'jats', 'docx', 'pdf'],
  },
};

const HUMANITIES_PROFILE: OmiPublicationProfile = {
  model: OMI_PUBLICATION_PROFILE_MODEL,
  id: 'omi-humanities-notes',
  version: '0.1.0',
  name: 'OMI Humanities — Notes & Bibliography',
  description:
    'A humanities-oriented profile with Chicago notes and bibliography, footnotes and document-wide object numbering.',
  publisher: 'Open Manuscript Initiative',
  rules: {
    layout: {
      pageSize: 'A4',
      columns: 1,
      marginMm: { top: 25, right: 28, bottom: 25, left: 28 },
      fontFamily: 'serif',
      baseFontSizePt: 11,
      lineHeight: 1.5,
      textAlign: 'justified',
    },
    sections: {
      numberingStyle: 'none',
      maxNumberedDepth: 0,
    },
    citations: {
      style: 'chicago-notes-bibliography',
      bibliographyHeading: true,
    },
    notes: {
      placement: 'footnotes',
      restartNumbering: 'document',
    },
    objects: {
      numbering: 'document',
      figureCaptionPosition: 'below',
      tableCaptionPosition: 'above',
      equationNumbering: 'document',
    },
    contributors: {
      showAffiliations: true,
      affiliationMode: 'inline',
      showOrcid: true,
      showCorrespondingMarker: false,
    },
    metadata: {
      requireTitle: true,
      requireAbstract: false,
      minimumKeywords: 0,
      requireContributor: true,
      affiliation: 'recommended',
      orcid: 'recommended',
    },
    accessibility: {
      figureAltText: 'required',
      tableHeaders: 'recommended',
      semanticHeadings: 'required',
    },
    outputs: ['html', 'jats', 'docx', 'pdf', 'epub'],
  },
};

export const BUILTIN_PUBLICATION_PROFILES: readonly OmiPublicationProfile[] = [
  GENERIC_PROFILE,
  AUTHOR_DATE_PROFILE,
  HUMANITIES_PROFILE,
];

export const DEFAULT_PUBLICATION_PROFILE_ID = GENERIC_PROFILE.id;

export function getPublicationProfile(
  id: string | undefined,
): OmiPublicationProfile | undefined {
  if (!id) return undefined;
  return BUILTIN_PUBLICATION_PROFILES.find((profile) => profile.id === id);
}

export function getPublicationProfileReference(
  manuscript: Pick<OmiManuscriptState, 'publicationProfile'>,
): OmiPublicationProfileReference | undefined {
  const reference = manuscript.publicationProfile;
  if (!reference?.id?.trim() || !reference.version?.trim()) return undefined;
  return {
    id: reference.id.trim(),
    version: reference.version.trim(),
  };
}

export function resolvePublicationProfile(
  manuscriptOrReference:
    | Pick<OmiManuscriptState, 'publicationProfile'>
    | OmiPublicationProfileReference
    | undefined,
): OmiPublicationProfile {
  const possibleReference = manuscriptOrReference as
    | OmiPublicationProfileReference
    | undefined;
  const reference =
    possibleReference && 'id' in possibleReference
      ? possibleReference
      : manuscriptOrReference
        ? getPublicationProfileReference(
            manuscriptOrReference as Pick<OmiManuscriptState, 'publicationProfile'>,
          )
        : undefined;

  return getPublicationProfile(reference?.id) ?? GENERIC_PROFILE;
}

export function createPublicationProfileReference(
  profile: OmiPublicationProfile,
): OmiPublicationProfileReference {
  return { id: profile.id, version: profile.version };
}

export function applyPublicationProfileDefaults(
  state: OmiManuscriptState,
  profile: OmiPublicationProfile,
): OmiManuscriptState {
  return {
    ...state,
    publicationProfile: createPublicationProfileReference(profile),
    sectionNumberingStyle: profile.rules.sections.numberingStyle,
    citationStyle: profile.rules.citations.style,
    crossReferenceNumbering: profile.rules.objects.numbering,
  };
}

export function publicationProfileOverrides(
  manuscript: Pick<
    OmiManuscriptState,
    | 'sectionNumberingStyle'
    | 'citationStyle'
    | 'crossReferenceNumbering'
  >,
  profile: OmiPublicationProfile,
): string[] {
  const overrides: string[] = [];

  if (
    (manuscript.sectionNumberingStyle ?? 'none') !==
    profile.rules.sections.numberingStyle
  ) {
    overrides.push('sections.numberingStyle');
  }
  if (
    (manuscript.citationStyle ?? 'apa-7') !==
    profile.rules.citations.style
  ) {
    overrides.push('citations.style');
  }
  if (
    (manuscript.crossReferenceNumbering ?? 'document') !==
    profile.rules.objects.numbering
  ) {
    overrides.push('objects.numbering');
  }

  return overrides;
}

export function validateManuscriptForPublication(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): OmiPublicationProfileIssue[] {
  const issues: OmiPublicationProfileIssue[] = [];
  const rules = profile.rules;

  if (rules.metadata.requireTitle && !manuscript.title.trim()) {
    issues.push({ code: 'missing-title', severity: 'error', targetId: manuscript.id });
  }
  if (rules.metadata.requireAbstract && !(manuscript.abstract ?? '').trim()) {
    issues.push({ code: 'missing-abstract', severity: 'error', targetId: manuscript.id });
  }
  if ((manuscript.keywords ?? []).filter((keyword) => keyword.trim()).length < rules.metadata.minimumKeywords) {
    issues.push({
      code: 'too-few-keywords',
      severity: 'error',
      targetId: manuscript.id,
      detail: String(rules.metadata.minimumKeywords),
    });
  }

  const contributorAgentIds = new Set(
    manuscript.contributions
      .filter((contribution) => contribution.roles.includes('author'))
      .map((contribution) => contribution.agentId),
  );
  const contributors = manuscript.agents.filter((agent) => contributorAgentIds.has(agent.id));

  if (rules.metadata.requireContributor && contributors.length === 0) {
    issues.push({ code: 'missing-contributor', severity: 'error', targetId: manuscript.id });
  }

  for (const agent of contributors) {
    if (
      rules.metadata.affiliation !== 'off' &&
      !agent.affiliations.some((affiliation) => affiliation.organizationName.trim())
    ) {
      issues.push({
        code: 'missing-affiliation',
        severity: requirementSeverity(rules.metadata.affiliation),
        targetId: agent.id,
      });
    }

    if (
      rules.metadata.orcid !== 'off' &&
      !agent.identifiers.some(
        (identifier) =>
          identifier.scheme.toLowerCase() === 'orcid' &&
          identifier.normalizedValue.trim(),
      )
    ) {
      issues.push({
        code: 'missing-orcid',
        severity: requirementSeverity(rules.metadata.orcid),
        targetId: agent.id,
      });
    }
  }

  for (const section of manuscript.sections) {
    for (const block of section.blocks) {
      if (
        block.visual?.kind === 'image' &&
        rules.accessibility.figureAltText !== 'off' &&
        !block.visual.alt.trim()
      ) {
        issues.push({
          code: 'missing-figure-alt',
          severity: requirementSeverity(rules.accessibility.figureAltText),
          targetId: block.id,
        });
      }

      if (
        block.visual?.kind === 'table' &&
        rules.accessibility.tableHeaders !== 'off' &&
        (block.visual.headerRows ?? 0) < 1
      ) {
        issues.push({
          code: 'missing-table-header',
          severity: requirementSeverity(rules.accessibility.tableHeaders),
          targetId: block.id,
        });
      }
    }
  }

  const bibliographicIds = new Set(
    (manuscript.bibliographicRecords ?? []).map((record) => record.id),
  );
  for (const citation of manuscript.citations) {
    if (!bibliographicIds.has(citation.target)) {
      issues.push({
        code: 'unresolved-citation',
        severity: 'error',
        targetId: citation.id,
      });
    }
  }

  const targetIds = new Set<string>();
  for (const section of manuscript.sections) {
    targetIds.add(section.id);
    for (const block of section.blocks) {
      if (block.visual) targetIds.add(block.id);
    }
  }
  for (const reference of manuscript.crossReferences ?? []) {
    if (!targetIds.has(reference.targetId)) {
      issues.push({
        code: 'unresolved-cross-reference',
        severity: 'error',
        targetId: reference.id,
      });
    }
  }

  const overrides = publicationProfileOverrides(manuscript, profile);
  for (const override of overrides) {
    issues.push({
      code: 'profile-override',
      severity: 'warning',
      targetId: manuscript.id,
      detail: override,
    });
  }

  return issues;
}

export function publicationReadinessSummary(
  issues: readonly OmiPublicationProfileIssue[],
): { errors: number; warnings: number; ready: boolean } {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  return { errors, warnings, ready: errors === 0 };
}

export function serializePublicationProfile(
  profile: OmiPublicationProfile,
): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

export function profileSupportsOutput(
  profile: OmiPublicationProfile,
  format: OmiPublicationOutputFormat,
): boolean {
  return profile.rules.outputs.includes(format);
}

function requirementSeverity(
  requirement: OmiPublicationRequirement,
): OmiPublicationProfileIssueSeverity {
  return requirement === 'required' ? 'error' : 'warning';
}
