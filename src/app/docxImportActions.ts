import { useStudioStore } from './useStudioStore';
import {
  createContribution,
  createPersonAgent,
  OMI_IDENTITY_MODEL_VERSION,
} from '../model/identity';
import { createInitialVersioningEnvelope } from '../model/versioning';
import type { DocxManuscriptImportPlan } from '../services/docxManuscriptImport';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';

export interface ApplyDocxImportOptions {
  importDetectedAuthors: boolean;
}

/**
 * Opens a DOCX-derived document as a new OMI manuscript.
 *
 * A DOCX import deliberately starts a new revision root instead of rewriting
 * the active manuscript's history. The Studio is currently a single-active-
 * manuscript reference implementation, so loading the new manuscript replaces
 * the active workspace document without mutating the old manuscript identity.
 */
export function applyDocxImportPlan(
  plan: DocxManuscriptImportPlan,
  options: ApplyDocxImportOptions,
): string {
  const current = useStudioStore.getState().manuscript;
  const timestamp = new Date().toISOString();
  const manuscriptId = crypto.randomUUID();
  const agents = options.importDetectedAuthors
    ? plan.authors.map((author) =>
        createPersonAgent(
          {
            givenName: author.givenName,
            familyName: author.familyName,
            displayName: author.displayName,
            language: plan.locale ?? current.locale,
          },
          crypto.randomUUID(),
          timestamp,
        ),
      )
    : [];
  const contributions = agents.map((agent, index) =>
    createContribution(
      agent.id,
      manuscriptId,
      ['author'],
      index + 1,
      crypto.randomUUID(),
      timestamp,
    ),
  );

  const state: OmiManuscriptState = {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: manuscriptId,
    version: current.version,
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: plan.locale ?? current.locale,
    title: plan.title,
    abstract: plan.abstract,
    keywords: plan.keywords,
    sectionNumberingStyle: 'decimal',
    citationStyle: current.citationStyle ?? 'apa-7',
    crossReferenceNumbering: 'document',
    agents,
    contributions,
    tombstones: [],
    sections: plan.sections,
    annotations: plan.annotations,
    bibliographicRecords: plan.bibliographicRecords,
    citations: plan.citations,
    citationClusters: plan.citationClusters,
    crossReferences: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const envelope = createInitialVersioningEnvelope(state, {
    summary: `Imported DOCX manuscript: ${plan.fileName}`,
    timestamp,
    completeness: 'complete',
  });
  const manuscript: OmiManuscript = {
    ...state,
    ...envelope,
  };

  useStudioStore.getState().loadManuscript(manuscript);
  return manuscriptId;
}
