export interface PublicationLayoutIssue {
  id: string;
  message: string;
  sectionId?: string;
  blockId?: string;
  frameId?: string;
  storyId?: string;
  insertionId?: string;
}
export type PublicationLayoutIssueReporter = (manuscriptId: string, issues: PublicationLayoutIssue[]) => void;
export const PUBLICATION_REVEAL_FRAME_EVENT = 'omi:publication:reveal-frame';
