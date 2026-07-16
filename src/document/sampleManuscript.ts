import type { OmiManuscript } from '../types/omi';

export const createSampleManuscript = (): OmiManuscript => {
  const now = new Date().toISOString();

  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: crypto.randomUUID(),
    version: '0.1.0-alpha.1',
    locale: 'en',
    title: 'Untitled OMI Manuscript',
    abstract: 'This alpha manuscript demonstrates the initial structured OMI document model.',
    keywords: ['open manuscript', 'scholarly publishing', 'structured editing'],
    authors: [
      {
        id: crypto.randomUUID(),
        givenName: 'Sample',
        familyName: 'Author',
        affiliation: 'Open Manuscript Initiative'
      }
    ],
    sections: [
      {
        id: crypto.randomUUID(),
        title: 'Introduction',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content:
              'Open Manuscript Studio stores scholarly text as a structured manuscript rather than as a simple formatted document.'
          },
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content:
              'Annotations may target precise text ranges and can later be rendered as footnotes, endnotes, margin notes or interactive comments.'
          }
        ]
      }
    ],
    annotations: [],
    citations: [],
    createdAt: now,
    updatedAt: now
  };
};
