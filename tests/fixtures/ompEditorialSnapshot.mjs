export const ompIdentity = { installationId: 'press-installation', contextId: 1, submissionId: 12, publicationId: 13 };
export function ompWorkflowSnapshot() {
  return {
    protocol: 'omi-omp-workflow/1', authority: 'OMP', stateToken: 'b'.repeat(64),
    submissionId: 12, publicationId: 13, stageId: 5, stage: 'production',
    submissionStatus: 1, publicationStatus: 1, lastModified: null,
    editorialDecisionsWritable: false,
    metadata: {
      title: { hu: 'Kötet', en: 'Volume' }, subtitle: [], abstract: [],
      seriesId: 7, seriesPosition: '2', workType: 2, datePublished: null,
      licenseUrl: null, copyrightHolder: [], copyrightYear: null,
    },
  };
}
export function ompMetadataSnapshot() {
  const workflow = ompWorkflowSnapshot();
  return {
    protocol: 'omi-omp-metadata/1', authority: 'OMP', contextId: 1,
    submissionId: 12, publicationId: 13, stateToken: 'a'.repeat(64),
    workflowToken: workflow.stateToken, stage: 'production', publicationStatus: 1,
    locales: ['hu', 'en'], writableFields: ['title', 'subtitle', 'abstract', 'keywords'],
    abstractRepresentation: 'plain-text',
    metadata: { ...workflow.metadata, keywords: { hu: ['kulcs'], en: ['key'] }, doi: '10.1234/volume', references: '' },
    contributors: [{ externalId: '7', name: { given: 'Editor', family: 'Name' }, isEditor: true, email: 'private@example.test' }],
  };
}
