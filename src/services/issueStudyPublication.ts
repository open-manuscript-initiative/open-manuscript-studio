import type { OmiManuscript } from '../types/omi';
import { projectIssueStudyForExport, type IssueStudyExportOptions } from '../model/issueStudyExport';
import { preparePublicationArtifact, type PreparedPublicationArtifact } from './publicationArtifact';

export async function prepareIssueStudyPublication(
  issue: OmiManuscript, rootSectionId: string, formats: readonly ('html' | 'jats')[],
  options: IssueStudyExportOptions = {},
): Promise<{ study: OmiManuscript; artifacts: PreparedPublicationArtifact[] }> {
  if (!formats.length || new Set(formats).size !== formats.length ||
      formats.some(format => format !== 'html' && format !== 'jats')) throw new Error('Select distinct HTML or JATS formats.');
  const study = projectIssueStudyForExport(issue, rootSectionId, options);
  const artifacts: PreparedPublicationArtifact[] = [];
  for (const format of formats) {
    artifacts.push(await preparePublicationArtifact(study, format, { assetOwnerId: issue.id }));
  }
  return { study, artifacts };
}
