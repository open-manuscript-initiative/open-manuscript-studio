import {
  OMI_IDENTITY_MODEL_VERSION,
  createContribution,
  createPersonAgent,
} from '../model/identity';
import { ensureManuscriptRevisionStateDigests } from '../model/revisionIntegrity';
import {
  createInitialVersioningEnvelope,
} from '../model/versioning';
import type {
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

export const createSampleManuscript = (): OmiManuscript => {
  const now = new Date().toISOString();
  const manuscriptId = crypto.randomUUID();
  const sampleAgent = createPersonAgent(
    {
      givenName: 'Sample',
      familyName: 'Author',
      affiliation: 'Open Manuscript Initiative',
      language: 'en',
    },
    crypto.randomUUID(),
    now,
  );
  const state: OmiManuscriptState = {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: manuscriptId,
    version: '0.1.0-alpha.1',
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: 'en',
    title: 'Untitled OMI Manuscript',
    abstract:
      'This alpha manuscript demonstrates the initial structured OMI document model.',
    keywords: [
      'open manuscript',
      'scholarly publishing',
      'structured editing',
    ],
    citationStyle: 'apa-7',
    agents: [sampleAgent],
    contributions: [
      createContribution(
        sampleAgent.id,
        manuscriptId,
        ['author'],
        1,
        crypto.randomUUID(),
        now,
      ),
    ],
    tombstones: [],
    sections: [
      {
        id: crypto.randomUUID(),
        title: 'Introduction',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content:
              'Open Manuscript Studio stores scholarly text as a structured manuscript rather than as a simple formatted document.',
          },
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content:
              'Annotations may target precise text ranges and can later be rendered as footnotes, endnotes, margin notes or interactive comments.',
          },
        ],
      },
    ],
    annotations: [],
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    createdAt: now,
    updatedAt: now,
  };

  return ensureManuscriptRevisionStateDigests({
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Created sample manuscript',
      actorAgentId: sampleAgent.id,
      timestamp: now,
      completeness: 'complete',
    }),
  });
};
