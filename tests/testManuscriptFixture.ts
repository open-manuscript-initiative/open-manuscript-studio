import type { OmiManuscript } from '../src/types/omi.ts';

const TIMESTAMP = '2026-08-07T12:00:00.000Z';

/** Deterministic, dependency-free manuscript fixture for Node ESM model tests. */
export function createTestManuscript(): OmiManuscript {
  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-test',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    versioningModelVersion: 'OMI-SPEC-160@0.1.0',
    locale: 'en',
    title: 'Test manuscript',
    abstract: 'A structured test abstract.',
    keywords: ['open manuscript', 'structured publishing', 'jats'],
    sectionNumberingStyle: 'decimal',
    citationStyle: 'apa-7',
    crossReferenceNumbering: 'document',
    agents: [
      {
        id: 'agent-author',
        type: 'person',
        names: [
          {
            id: 'name-author',
            value: 'Ada Scholar',
            givenName: 'Ada',
            familyName: 'Scholar',
            preferred: true,
            visibility: 'public',
          },
        ],
        identifiers: [],
        affiliations: [
          {
            id: 'affiliation-one',
            organizationName: 'Open Manuscript Institute',
            visibility: 'public',
          },
        ],
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    contributions: [
      {
        id: 'contribution-author',
        agentId: 'agent-author',
        targetId: 'manuscript-test',
        roles: ['author'],
        order: 1,
        corresponding: false,
        visibility: 'public',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      },
    ],
    tombstones: [],
    sections: [
      {
        id: 'section-one',
        title: 'Introduction',
        blocks: [
          {
            id: 'block-one',
            type: 'paragraph',
            content: JSON.stringify({
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Test paragraph.' }],
                },
              ],
            }),
          },
        ],
      },
    ],
    annotations: [],
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    crossReferences: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    headRevisionId: 'revision-root',
    revisionHistory: {
      revisions: [],
      heads: ['revision-root'],
    } as never,
  } as OmiManuscript;
}
