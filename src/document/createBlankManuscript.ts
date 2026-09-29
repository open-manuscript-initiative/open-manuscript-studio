import {
  createContribution,
  createPersonAgent,
  OMI_IDENTITY_MODEL_VERSION,
} from '../model/identity';
import {
  createDocumentStructureProfile,
  type OmiDocumentKind,
  type OmiVolumeKind,
} from '../model/documentProfile';
import { OMI_MANUSCRIPT_SCHEMA_URI } from '../model/omiFormatConstants';
import { ensureManuscriptRevisionStateDigests } from '../model/revisionIntegrity';
import { createEmptyStudy } from '../model/sectionStructure';
import { createInitialVersioningEnvelope } from '../model/versioning';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';

export interface CreateBlankManuscriptInput {
  kind: OmiDocumentKind;
  volumeKind?: OmiVolumeKind;
  locale?: string;
  title?: string;
  author?: {
    displayName: string;
    givenName?: string;
    familyName?: string;
    preferredPublicName?: string;
    email: string;
    affiliation?: string;
    affiliationRorId?: string;
    country?: string;
    orcid?: string;
    biography?: Record<string, string>;
  };
}

export function createBlankManuscript(
  input: CreateBlankManuscriptInput,
): OmiManuscript {
  const now = new Date().toISOString();
  const manuscriptId = crypto.randomUUID();
  const authorName = input.author?.displayName.trim();
  const author = authorName
      ? createPersonAgent({
        givenName: input.author?.givenName ?? '',
        familyName: input.author?.familyName ?? '',
        displayName: authorName,
        email: input.author?.email,
        affiliation: input.author?.affiliation,
        affiliationRorId: input.author?.affiliationRorId,
        country: input.author?.country,
        orcid: input.author?.orcid,
        biography: input.author?.biography,
        language: input.locale,
      }, crypto.randomUUID(), now)
    : null;
  const rootStudyId = input.kind === 'study' ? crypto.randomUUID() : null;
  const state: OmiManuscriptState = {
    schema: OMI_MANUSCRIPT_SCHEMA_URI,
    id: manuscriptId,
    version: '0.1.0-alpha.1',
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: input.locale?.trim() || 'en',
    title: input.title ?? '',
    subtitle: undefined,
    abstract: '',
    keywords: [],
    citationStyle: 'apa-7',
    documentStructure: createDocumentStructureProfile(
      input.kind,
      input.volumeKind,
    ),
    agents: author ? [author] : [],
    contributions: author
      ? [{
          ...createContribution(
            author.id,
            rootStudyId ?? manuscriptId,
            ['author'],
            1,
            crypto.randomUUID(),
            now,
          ),
          ...(input.author?.preferredPublicName?.trim()
            ? { attributionName: input.author.preferredPublicName.trim() }
            : {}),
        }]
      : [],
    tombstones: [],
    sections: rootStudyId ? [createEmptyStudy(rootStudyId)] : [],
    annotations: [],
    bibliographicRecords: [],
    bibliographyAdditionalRecordIds: [],
    citations: [],
    citationClusters: [],
    crossReferences: [],
    assets: [],
    createdAt: now,
    updatedAt: now,
  };

  const summary = input.kind === 'study'
    ? 'Created blank OMI study'
    : input.volumeKind === 'monograph'
      ? 'Created blank OMI monograph'
      : 'Created blank OMI edited volume';

  return ensureManuscriptRevisionStateDigests({
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary,
      timestamp: now,
      completeness: 'complete',
    }),
  });
}
