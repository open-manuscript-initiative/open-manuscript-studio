import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import {
  createOjsAssignment,
  listOjsAssignments,
  type OjsAssignmentLaunchContext,
  type OjsAssignmentSummary,
  type OjsAssignmentType,
} from '../services/ojsAssignmentApi';

export function OjsAssignmentPanel({
  actorMode,
  context,
}: {
  actorMode: 'editor' | 'author';
  context: OjsAssignmentLaunchContext;
}) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [assignments, setAssignments] = useState<OjsAssignmentSummary[]>([]);
  const [reviewerEmail, setReviewerEmail] = useState(context.candidates[0]?.email ?? '');
  const [assignmentType, setAssignmentType] = useState<OjsAssignmentType>('scientific_review');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visibleAssignments = useMemo(
    () => actorMode === 'author'
      ? assignments.filter((item) => item.assignmentType === 'language_review' || item.assignmentType === 'translation')
      : assignments,
    [actorMode, assignments],
  );

  useEffect(() => {
    let active = true;
    void listOjsAssignments(context.grant)
      .then((result) => {
        if (active) setAssignments(result.assignments);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : copy.loadError);
      });
    return () => { active = false; };
  }, [context.grant, copy.loadError]);

  async function addAssignment(): Promise<void> {
    if (actorMode !== 'editor' || !reviewerEmail) return;
    setBusy(true);
    setError('');
    try {
      const assignment = await createOjsAssignment({
        context,
        reviewerEmail,
        assignmentType,
        sourceLanguage: sourceLanguage || undefined,
        targetLanguage: targetLanguage || undefined,
      });
      setAssignments((current) => [...current, assignment]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.createError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{actorMode === 'editor' ? copy.editorDescription : copy.authorDescription}</p>
        </div>
      </div>

      {error ? <p role="alert" className="studio-settings-future-note">{error}</p> : null}

      {actorMode === 'editor' ? (
        <section className="studio-settings-card">
          <div className="studio-settings-card-header">
            <div><h4>{copy.add}</h4><p>{copy.ojsCandidates}</p></div>
          </div>
          <div className="studio-manuscript-fields">
            <label>
              <span>{copy.person}</span>
              <select value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)}>
                <option value="">{copy.choose}</option>
                {context.candidates.map((candidate) => (
                  <option key={candidate.externalId} value={candidate.email}>
                    {candidate.fullName} — {candidate.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.role}</span>
              <select value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as OjsAssignmentType)}>
                <option value="scientific_review">{copy.scientific}</option>
                <option value="language_review">{copy.language}</option>
                <option value="translation">{copy.translation}</option>
              </select>
            </label>
            {assignmentType === 'translation' ? (
              <>
                <label><span>{copy.sourceLanguage}</span><input value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} /></label>
                <label><span>{copy.targetLanguage}</span><input value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} /></label>
              </>
            ) : null}
          </div>
          <button type="button" className="studio-menu-primary-action" disabled={busy || !reviewerEmail} onClick={() => void addAssignment()}>
            {busy ? copy.adding : copy.add}
          </button>
          <p className="studio-settings-hint">{copy.accountHint}</p>
        </section>
      ) : null}

      <section className="studio-settings-card">
        <div className="studio-settings-card-header"><div><h4>{copy.current}</h4></div></div>
        {visibleAssignments.length ? (
          <div className="studio-language-preference-list">
            {visibleAssignments.map((assignment) => (
              <div className="studio-language-preference" key={assignment.id}>
                <span className="studio-language-preference-copy">
                  <strong>{assignment.reviewer?.fullName ?? assignment.reviewerAlias}</strong>
                  <small>{roleLabel(assignment.assignmentType, copy)} · {assignment.status}</small>
                </span>
                {assignment.assignmentType === 'translation' ? (
                  <code>{assignment.sourceLanguage ?? '?'} → {assignment.targetLanguage ?? '?'}</code>
                ) : null}
              </div>
            ))}
          </div>
        ) : <p>{copy.empty}</p>}
      </section>
    </section>
  );
}

function roleLabel(type: OjsAssignmentType, copy: ReturnType<typeof getCopy>): string {
  if (type === 'scientific_review') return copy.scientific;
  if (type === 'language_review') return copy.language;
  return copy.translation;
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Közreműködők és megbízások', editorDescription: 'A kézirathoz tudományos lektort, nyelvi lektort vagy fordítót rendelhet. Az OJS lektorai automatikusan megjelennek a választható személyek között.', authorDescription: 'A szerző a nyelvi lektort és a fordítót láthatja. A tudományos lektor személyazonossága nem jelenik meg.', add: 'Megbízás hozzáadása', ojsCandidates: 'OJS lektorok', person: 'Személy', choose: 'Válasszon személyt', role: 'Szerepkör', scientific: 'Tudományos lektor', language: 'Nyelvi lektor', translation: 'Fordító', sourceLanguage: 'Forrásnyelv', targetLanguage: 'Célnyelv', adding: 'Hozzáadás…', accountHint: 'Az OJS-ből kiválasztott személynek azonos e-mail-címmel aktív Studio-fiókkal kell rendelkeznie.', current: 'Jelenlegi megbízások', empty: 'Nincs megjeleníthető megbízás.', loadError: 'A megbízások nem tölthetők be.', createError: 'A megbízás nem hozható létre.' };
  if (locale === 'de') return {
    title: 'Mitwirkende und Aufträge', editorDescription: 'Sie können wissenschaftliche Gutachter, Sprachlektoren oder Übersetzer zuweisen. OJS-Gutachter werden automatisch als Kandidaten angeboten.', authorDescription: 'Autorinnen und Autoren können Sprachlektor und Übersetzer sehen. Die Identität wissenschaftlicher Gutachter bleibt verborgen.', add: 'Auftrag hinzufügen', ojsCandidates: 'OJS-Gutachter', person: 'Person', choose: 'Person auswählen', role: 'Rolle', scientific: 'Wissenschaftliches Gutachten', language: 'Sprachlektorat', translation: 'Übersetzung', sourceLanguage: 'Ausgangssprache', targetLanguage: 'Zielsprache', adding: 'Wird hinzugefügt…', accountHint: 'Die ausgewählte OJS-Person benötigt ein aktives Studio-Konto mit derselben E-Mail-Adresse.', current: 'Aktuelle Aufträge', empty: 'Keine sichtbaren Aufträge.', loadError: 'Aufträge konnten nicht geladen werden.', createError: 'Auftrag konnte nicht erstellt werden.' };
  return {
    title: 'Participants and assignments', editorDescription: 'Assign a scientific reviewer, language reviewer, or translator. OJS reviewers are automatically available as candidates.', authorDescription: 'Authors can see the language reviewer and translator. Scientific reviewer identity remains hidden.', add: 'Add assignment', ojsCandidates: 'OJS reviewers', person: 'Person', choose: 'Choose a person', role: 'Role', scientific: 'Scientific reviewer', language: 'Language reviewer', translation: 'Translator', sourceLanguage: 'Source language', targetLanguage: 'Target language', adding: 'Adding…', accountHint: 'The selected OJS participant must have an active Studio account with the same email address.', current: 'Current assignments', empty: 'No visible assignments.', loadError: 'Unable to load assignments.', createError: 'Unable to create assignment.' };
}
