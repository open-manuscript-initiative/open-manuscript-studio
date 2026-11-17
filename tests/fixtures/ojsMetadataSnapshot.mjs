export function ojsMetadataSnapshot() {
  return {
    protocol: 'omi-ojs-metadata/1',
    authority: 'OJS',
    stateToken: 'a'.repeat(64),
    workflowToken: 'b'.repeat(64),
    submissionId: 12,
    publicationId: 13,
    stage: 'production',
    publicationStatus: 1,
    locales: ['hu', 'en'],
    writableFields: ['title', 'subtitle', 'abstract', 'keywords'],
    abstractRepresentation: 'plain-text',
    metadata: {
      title: { hu: 'OJS cím', en: 'OJS title' },
      subtitle: {},
      abstract: { hu: 'Absztrakt' },
      keywords: { hu: ['kulcs'] },
      doi: '10.1234/test',
      references: 'Native bibliography',
      pages: '12–19',
      issueId: 1,
      datePublished: null,
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      copyrightHolder: {},
      copyrightYear: 2026,
    },
    contributors: [
      {
        externalId: '7',
        name: { given: 'Author', family: 'Name' },
        email: 'private@example.test',
      },
    ],
  };
}
