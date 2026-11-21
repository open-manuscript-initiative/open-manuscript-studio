import { publicationPaginationCopy } from '../i18n/publicationPagination';
import type { PublicationLayoutIssue } from '../model/publicationLayoutDiagnostics';

export function PublicationLayoutChecker({ locale, enabled, onEnabled, issues, onNavigate }: {
  locale: string; enabled: boolean; onEnabled: (enabled: boolean) => void;
  issues: readonly PublicationLayoutIssue[]; onNavigate: (issue: PublicationLayoutIssue) => void;
}) {
  const copy = publicationPaginationCopy(locale);
  return <fieldset className="publication-layout-checker"><legend>{copy.checker}</legend>
    <label className="publication-style-toggle"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} /><span>{copy.enableChecker}</span></label>
    {enabled ? issues.length ? <ul>{issues.map((issue) => <li key={issue.id}><button type="button" data-layout-issue={issue.id} onClick={() => onNavigate(issue)}><span aria-hidden="true">⚠ </span>{issue.message}</button></li>)}</ul> : <p role="status">{copy.noIssues}</p> : null}
  </fieldset>;
}
