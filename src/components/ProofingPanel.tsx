import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  MessageSquarePlus,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  createProofingTextDiff,
  normalizeProofingState,
  storedContentText,
} from '../model/proofing';
import './ProofingPanel.css';

export function ProofingPanel({ onClose }: { onClose: () => void }) {
  const { locale } = useTranslation();
  const copy = proofingCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const activeId = useStudioStore((state) => state.activeProofingChangeId);
  const selection = useStudioStore((state) => state.proofingSelection);
  const setActive = useStudioStore((state) => state.setActiveProofingChange);
  const setTracking = useStudioStore((state) => state.setTrackChanges);
  const accept = useStudioStore((state) => state.acceptProofingChange);
  const reject = useStudioStore((state) => state.rejectProofingChange);
  const acceptAll = useStudioStore((state) => state.acceptAllProofingChanges);
  const rejectAll = useStudioStore((state) => state.rejectAllProofingChanges);
  const addComment = useStudioStore((state) => state.addProofingComment);
  const resolveComment = useStudioStore((state) => state.setProofingCommentResolved);
  const [commentBody, setCommentBody] = useState('');
  const [visibility, setVisibility] = useState<'author_and_editor' | 'editor_only'>(
    'author_and_editor',
  );

  const proofing = normalizeProofingState(manuscript.proofing);
  const pending = proofing.changes.filter((change) => change.status === 'pending');
  const active = pending.find((change) => change.id === activeId) ?? pending[0];
  const activeIndex = active
    ? pending.findIndex((change) => change.id === active.id)
    : -1;
  const comments = useMemo(
    () => manuscript.annotations.filter((annotation) => annotation.type === 'comment'),
    [manuscript.annotations],
  );
  const activeComments = comments.filter((comment) => comment.status !== 'resolved');

  function navigate(delta: number): void {
    if (!pending.length) return;
    const next = pending[(Math.max(0, activeIndex) + delta + pending.length) % pending.length];
    if (!next) return;
    setActive(next.id);
    scrollToBlock(next.targetBlockId);
  }

  function selectChange(changeId: string, blockId: string): void {
    setActive(changeId);
    scrollToBlock(blockId);
  }

  function submitComment(event: FormEvent): void {
    event.preventDefault();
    if (!commentBody.trim()) return;
    addComment(commentBody, visibility);
    setCommentBody('');
  }

  const diff = active
    ? createProofingTextDiff(
        storedContentText(active.before),
        storedContentText(active.after),
      )
    : null;

  return (
    <aside id="omi-proofing-panel" className="proofing-panel" aria-labelledby="proofing-panel-title">
      <header className="proofing-panel__header">
        <div>
          <span className="proofing-panel__eyebrow"><FileCheck2 size={15} aria-hidden="true" />{copy.review}</span>
          <h2 id="proofing-panel-title">{copy.title}</h2>
        </div>
        <button type="button" className="proofing-panel__icon-button" onClick={onClose} aria-label={copy.close} title={copy.close}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="proofing-panel__body">
        <label className="proofing-panel__tracking">
          <input
            type="checkbox"
            checked={proofing.trackChanges}
            onChange={(event) => setTracking(event.target.checked)}
          />
          <span><strong>{copy.trackChanges}</strong><small>{copy.trackChangesHelp}</small></span>
        </label>

        <section className="proofing-panel__section" aria-labelledby="proofing-changes-title">
          <div className="proofing-panel__section-heading">
            <h3 id="proofing-changes-title">{copy.changes}</h3>
            <span>{copy.pending(pending.length)}</span>
          </div>

          {active && diff ? (
            <article className="proofing-panel__change-card">
              <div className="proofing-panel__change-nav">
                <span>{activeIndex + 1} / {pending.length}</span>
                <div>
                  <button type="button" onClick={() => navigate(-1)} aria-label={copy.previous} title={copy.previous}><ChevronUp size={17} /></button>
                  <button type="button" onClick={() => navigate(1)} aria-label={copy.next} title={copy.next}><ChevronDown size={17} /></button>
                </div>
              </div>
              <p className="proofing-panel__diff">
                <span>{diff.prefix}</span>
                {diff.removed ? <del>{diff.removed}</del> : null}
                {diff.inserted ? <ins>{diff.inserted}</ins> : null}
                <span>{diff.suffix}</span>
                {!diff.removed && !diff.inserted ? <em>{copy.formattingChanged}</em> : null}
              </p>
              <div className="proofing-panel__decision-actions">
                <button type="button" className="is-accept" onClick={() => accept(active.id)}><Check size={16} />{copy.accept}</button>
                <button type="button" className="is-reject" onClick={() => reject(active.id)}><XCircle size={16} />{copy.reject}</button>
              </div>
            </article>
          ) : (
            <p className="proofing-panel__empty">{copy.noChanges}</p>
          )}

          {pending.length > 1 ? (
            <div className="proofing-panel__all-actions">
              <button type="button" onClick={acceptAll}><CheckCheck size={15} />{copy.acceptAll}</button>
              <button type="button" onClick={rejectAll}><RotateCcw size={15} />{copy.rejectAll}</button>
            </div>
          ) : null}

          {pending.length > 1 ? (
            <ol className="proofing-panel__change-list">
              {pending.map((change, index) => (
                <li key={change.id}>
                  <button
                    type="button"
                    className={change.id === active?.id ? 'is-active' : ''}
                    onClick={() => selectChange(change.id, change.targetBlockId)}
                  >
                    <span>{copy.changeNumber(index + 1)}</span>
                    <small>{storedContentText(change.after).slice(0, 84) || copy.emptyText}</small>
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        <section className="proofing-panel__section" aria-labelledby="proofing-comments-title">
          <div className="proofing-panel__section-heading">
            <h3 id="proofing-comments-title">{copy.comments}</h3>
            <span>{activeComments.length}</span>
          </div>

          <form className="proofing-panel__comment-form" onSubmit={submitComment}>
            <div className={`proofing-panel__selection${selection?.text.trim() ? '' : ' is-empty'}`}>
              {selection?.text.trim() ? `“${selection.text.trim().slice(0, 180)}”` : copy.selectText}
            </div>
            <textarea
              rows={3}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={copy.commentPlaceholder}
              disabled={!selection?.text.trim()}
            />
            <div className="proofing-panel__comment-actions">
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} aria-label={copy.visibility}>
                <option value="author_and_editor">{copy.authorAndEditor}</option>
                <option value="editor_only">{copy.editorOnly}</option>
              </select>
              <button type="submit" disabled={!selection?.text.trim() || !commentBody.trim()}><MessageSquarePlus size={15} />{copy.addComment}</button>
            </div>
          </form>

          {comments.length ? (
            <ol className="proofing-panel__comments">
              {comments.map((comment) => (
                <li key={comment.id} className={comment.status === 'resolved' ? 'is-resolved' : ''}>
                  <button type="button" className="proofing-panel__comment-target" onClick={() => scrollToBlock(comment.targetBlockId)}>
                    {comment.targetText ? `“${comment.targetText.slice(0, 90)}”` : copy.comment}
                  </button>
                  <p>{comment.body}</p>
                  <div>
                    <small>{comment.visibility === 'editor_only' ? copy.editorOnly : copy.authorAndEditor}</small>
                    <button type="button" onClick={() => resolveComment(comment.id, comment.status !== 'resolved')}>
                      {comment.status === 'resolved' ? copy.reopen : copy.resolve}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="proofing-panel__empty">{copy.noComments}</p>}
        </section>
      </div>
    </aside>
  );
}

function scrollToBlock(blockId: string): void {
  const element = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]'))
    .find((candidate) => candidate.dataset.blockId === blockId);
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function proofingCopy(locale: string) {
  if (locale === 'hu') return {
    review: 'Korrektúra', title: 'Áttekintés', close: 'Korrektúra bezárása', trackChanges: 'Változások követése', trackChangesHelp: 'A további szövegjavítások elfogadható vagy visszautasítható javaslatként maradnak meg.', changes: 'Változások', pending: (count: number) => `${count} függőben`, previous: 'Előző változás', next: 'Következő változás', accept: 'Elfogadás', reject: 'Elutasítás', acceptAll: 'Összes elfogadása', rejectAll: 'Összes elutasítása', noChanges: 'Nincs függőben lévő változás.', changeNumber: (number: number) => `${number}. változás`, emptyText: 'Üres szöveg', formattingChanged: 'A szöveg formázása módosult.', comments: 'Megjegyzések', selectText: 'Jelöljön ki egy szövegrészt a dokumentumban.', commentPlaceholder: 'Korrektori vagy lektori megjegyzés…', visibility: 'Megjegyzés láthatósága', authorAndEditor: 'Szerzőnek és szerkesztőnek', editorOnly: 'Csak a szerkesztőnek', addComment: 'Megjegyzés', comment: 'Megjegyzés', resolve: 'Lezárás', reopen: 'Újranyitás', noComments: 'Még nincs korrektori megjegyzés.',
  };
  if (locale === 'de') return {
    review: 'Korrektur', title: 'Überprüfen', close: 'Korrektur schließen', trackChanges: 'Änderungen nachverfolgen', trackChangesHelp: 'Weitere Textänderungen bleiben als annehmbare oder ablehnbare Vorschläge erhalten.', changes: 'Änderungen', pending: (count: number) => `${count} ausstehend`, previous: 'Vorherige Änderung', next: 'Nächste Änderung', accept: 'Annehmen', reject: 'Ablehnen', acceptAll: 'Alle annehmen', rejectAll: 'Alle ablehnen', noChanges: 'Keine ausstehenden Änderungen.', changeNumber: (number: number) => `Änderung ${number}`, emptyText: 'Leerer Text', formattingChanged: 'Die Textformatierung wurde geändert.', comments: 'Kommentare', selectText: 'Markieren Sie Text im Dokument.', commentPlaceholder: 'Korrektur- oder Gutachterkommentar…', visibility: 'Sichtbarkeit', authorAndEditor: 'Autor und Redaktion', editorOnly: 'Nur Redaktion', addComment: 'Kommentar', comment: 'Kommentar', resolve: 'Erledigen', reopen: 'Wieder öffnen', noComments: 'Noch keine Korrekturkommentare.',
  };
  return {
    review: 'Proofing', title: 'Review', close: 'Close proofing', trackChanges: 'Track changes', trackChangesHelp: 'Further text edits remain as suggestions that can be accepted or rejected.', changes: 'Changes', pending: (count: number) => `${count} pending`, previous: 'Previous change', next: 'Next change', accept: 'Accept', reject: 'Reject', acceptAll: 'Accept all', rejectAll: 'Reject all', noChanges: 'No pending changes.', changeNumber: (number: number) => `Change ${number}`, emptyText: 'Empty text', formattingChanged: 'Text formatting changed.', comments: 'Comments', selectText: 'Select text in the document.', commentPlaceholder: 'Proofreader or reviewer comment…', visibility: 'Comment visibility', authorAndEditor: 'Author and editor', editorOnly: 'Editor only', addComment: 'Comment', comment: 'Comment', resolve: 'Resolve', reopen: 'Reopen', noComments: 'No proofing comments yet.',
  };
}
