import { useStudioStore } from './useStudioStore';
import { WORD_HYPHENATION_EXTENSION, normalizeWordHyphenation } from '../model/wordHyphenation';
import { manuscriptImportOrigin } from '../model/manuscriptImportOrigin';
import { documentImportSourcePolicy, type DocumentImportSourceOptions } from '../model/documentImportMode';
import { OMI_MANUSCRIPT_SCHEMA_URI } from '../model/omiFormatConstants';
import { createDocumentStructureProfile } from '../model/documentProfile';
import { attachImportedDocumentSource, importedDocumentSourceLabel } from '../model/importedDocumentSource';
import {
  createContribution,
  createPersonAgent,
  OMI_IDENTITY_MODEL_VERSION,
} from '../model/identity';
import { createInitialVersioningEnvelope } from '../model/versioning';
import type { DocxManuscriptImportPlan } from '../services/docxManuscriptImport';
import type { OmiManuscript, OmiManuscriptState } from '../types/omi';

export interface ApplyDocxImportOptions extends DocumentImportSourceOptions {
  importDetectedAuthors: boolean;
  source: string;
}

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

  const policy = documentImportSourcePolicy(options);
  const sections = policy.includeSource
    ? attachImportedDocumentSource(plan.sections, options.source, importedDocumentSourceLabel(plan.locale ?? current.locale))
    : plan.sections;
  // Document provenance has no block/section anchor and cannot constrain edits.
  const annotations = plan.annotations;

  const wordHyphenation=normalizeWordHyphenation(plan.wordHyphenation);
  const extensions={...(policy.selfAuthored?manuscriptImportOrigin(plan.fileName.toLowerCase().endsWith('.odt')?'odt':'docx',timestamp):{}),...(wordHyphenation?{[WORD_HYPHENATION_EXTENSION]:wordHyphenation}:{})};
  const state: OmiManuscriptState = {
    ...(Object.keys(extensions).length?{extensions}:{}),
    schema: OMI_MANUSCRIPT_SCHEMA_URI,
    id: manuscriptId,
    version: current.version,
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: plan.locale ?? current.locale,
    title: plan.title,
    abstract: plan.abstract,
    keywords: plan.keywords,
    documentStructure: createDocumentStructureProfile('study'),
    sectionNumberingStyle: 'none',
    citationStyle: current.citationStyle ?? 'apa-7',
    crossReferenceNumbering: 'document',
    agents,
    contributions,
    tombstones: [],
    sections,
    annotations,
    bibliographicRecords: plan.bibliographicRecords,
    citations: plan.citations,
    citationClusters: plan.citationClusters,
    crossReferences: [],
    ...(plan.indexEntries ? { indexEntries: plan.indexEntries } : {}),
    ...(plan.generatedIndexes ? { generatedIndexes: plan.generatedIndexes } : {}),
    ...(plan.tableOfContents ? { tableOfContents: plan.tableOfContents } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const envelope = createInitialVersioningEnvelope(state, {
    summary: policy.selfAuthored
      ? `Imported self-authored ${plan.fileName.toLowerCase().endsWith('.odt') ? 'ODT' : 'DOCX'} manuscript`
      : `Imported ${plan.fileName.toLowerCase().endsWith('.odt') ? 'ODT' : 'DOCX'} manuscript: ${plan.fileName}`,
    timestamp,
    completeness: 'complete',
  });
  const manuscript: OmiManuscript = { ...state, ...envelope };

  useStudioStore.getState().loadManuscript(manuscript);
  return manuscriptId;
}
