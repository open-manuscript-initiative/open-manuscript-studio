/** Scientific submission is final; translators/language reviewers remain active until editorial completion. */
export function readableReviewStatuses(type: string): string[] {
  return type === 'SCIENTIFIC_REVIEW' ? ['INVITED', 'ACCEPTED', 'IN_PROGRESS'] : ['INVITED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'];
}
export function writableReviewStatuses(type: string): string[] {
  return type === 'SCIENTIFIC_REVIEW' ? ['ACCEPTED', 'IN_PROGRESS'] : ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'];
}
export function assertReviewDocumentAccess(type: string, status: string, write = false): void {
  if (!(write ? writableReviewStatuses(type) : readableReviewStatuses(type)).includes(status)) {
    const error = new Error('This task is closed. Document access is no longer available.');
    error.name = 'ForbiddenError';
    throw error;
  }
}
