import { useState } from 'react';
import { translationTaskCopy, translationLanguage } from '../model/translationAssignmentProfile';
import type { ReviewerAssignment, ReviewManuscriptSnapshot } from '../services/peerReviewApi';
import './TranslationWorkflow.css';

export function AssignmentTranslationEditor({ assignment, original, revision, disabled, locale, onChange }: {
  assignment: ReviewerAssignment; original: ReviewManuscriptSnapshot; revision: ReviewManuscriptSnapshot;
  disabled: boolean; locale: string; onChange: (value: ReviewManuscriptSnapshot) => void;
}) {
  const copy = translationTaskCopy(locale);
  const draft = revision.translation ?? { sourceLanguage: translationLanguage(assignment.sourceLanguage ?? ''),
    targetLanguage: translationLanguage(assignment.targetLanguage ?? ''), title: '', abstract: '', keywords: [], documentCompleted: false };
  const [keywords, setKeywords] = useState(draft.keywords.join('; '));
  return <section className="review-mode__card" aria-label={copy.metadata}>
    <h2>{copy.metadata} · {draft.sourceLanguage} → {draft.targetLanguage}</h2><p>{copy.required}</p>
    <label className="translation-metadata-field">{copy.title}<small className="translation-source">{copy.sourceText}: {original.title}</small>
      <input required lang={draft.targetLanguage} value={draft.title} disabled={disabled} maxLength={500} onChange={event => onChange({ ...revision, translation: { ...draft, title: event.target.value } })} /></label>
    <label className="translation-metadata-field">{copy.abstract}<small className="translation-source">{copy.sourceText}: {original.abstract ?? '—'}</small>
      <textarea required lang={draft.targetLanguage} rows={6} maxLength={20_000} value={draft.abstract} disabled={disabled} onChange={event => onChange({ ...revision, translation: { ...draft, abstract: event.target.value } })} /></label>
    <label className="translation-metadata-field">{copy.keywords}<small className="translation-source">{copy.sourceText}: {original.keywords.join('; ') || '—'}</small>
      <textarea required lang={draft.targetLanguage} rows={2} value={keywords} disabled={disabled} onChange={event => {
        setKeywords(event.target.value);
        onChange({ ...revision, translation: { ...draft, keywords: event.target.value.split(/[;\n]/).map(term => term.trim()).filter(Boolean) } });
      }} /><small>{copy.keywordHint}</small></label>
    {assignment.documentTranslationRequired ? <><p>{copy.bodyRequired}</p><label><input type="checkbox" checked={draft.documentCompleted} disabled={disabled} onChange={event => onChange({ ...revision, translation: { ...draft, documentCompleted: event.target.checked } })} /> {copy.documentDone}</label></> : <p>{copy.metadataOnly}</p>}
  </section>;
}
