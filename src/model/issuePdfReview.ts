import { validateReviewedIssueRanges, type IssuePdfRangeProposal } from './issuePdfPageRanges';

export interface IssuePdfReviewRow {
  rootSectionId: string;
  first: string;
  last: string;
  reviewed: boolean;
}
export function createIssuePdfReviewRows(proposals: readonly IssuePdfRangeProposal[]): IssuePdfReviewRow[] {
  return proposals.map(item => ({
    rootSectionId: item.rootSectionId, first: item.firstPage?.toString() ?? '',
    last: item.lastPage?.toString() ?? '', reviewed: false,
  }));
}
export function editIssuePdfReviewRow(rows: readonly IssuePdfReviewRow[], rootSectionId: string,
  field: 'first' | 'last', value: string): IssuePdfReviewRow[] {
  return rows.map(row => row.rootSectionId === rootSectionId ? { ...row, [field]: value, reviewed: false } : row);
}
export function reviewedIssuePdfRanges(pageCount: number, roots: readonly string[], rows: readonly IssuePdfReviewRow[]) {
  const ranges = rows.map(row => {
    if (!row.reviewed || !/^[1-9][0-9]{0,3}$/.test(row.first) || !/^[1-9][0-9]{0,3}$/.test(row.last)) {
      throw new Error('Review and confirm every physical page range.');
    }
    return { rootSectionId: row.rootSectionId, firstPage: Number(row.first), lastPage: Number(row.last) };
  });
  validateReviewedIssueRanges(pageCount, roots, ranges);
  return ranges;
}
