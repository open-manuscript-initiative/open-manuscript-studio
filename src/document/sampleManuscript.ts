import {
  OMI_IDENTITY_MODEL_VERSION,
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
  const state: OmiManuscriptState = {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: manuscriptId,
    version: '0.1.0-alpha.1',
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    locale: 'en',
    title: '',
    abstract: '',
    keywords: [],
    citationStyle: 'apa-7',
    agents: [],
    contributions: [],
    tombstones: [],
    sections: [
      {
        id: crypto.randomUUID(),
        title: '',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content: '',
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
      summary: 'Created blank manuscript',
      timestamp: now,
      completeness: 'complete',
    }),
  });
};
