import { BookOpen, MapPin, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import {
  stageAddNoteCitations,
  stageRemoveNoteCitation,
} from '../app/noteCitationActions';
import {
  stageRemoveNote,
  stageUpdateNote,
} from '../app/noteActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getNoteCitationCopy } from '../i18n/noteCitations';
import {
  createNoteCitation,
  renderNoteCitation,
} from '../model/noteCitations';
import {
  getNoteKind,
  getNoteNumber,
  isNoteAnnotation,
  type OmiNoteKind,
} from '../model/notes';
import {
  CitationPicker,
  type CitationPickerSelection,
} from './CitationPicker';

interface NoteEditorCardProps {
  noteId: string;
  compact?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function NoteEditorCard({
  noteId,
  compact = false,
  onClose,
  onNavigate,
}: NoteEditorCardProps) {
  const { t, locale } = useTranslation();
  const citationCopy = getNoteCitationCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);
  const note = manuscript.annotations.find(
    (annotation) =>
      annotation.id === noteId && isNoteAnnotation(annotation),
  );

  if (!note) {
    return null;
  }

  const stableNoteId = note.id;
  const noteNumber = getNoteNumber(manuscript, stableNoteId);
  const section = manuscript.sections.find((candidate) =>
    candidate.blocks.some((block) => block.id === note.targetBlockId),
  );
  const noteKind = getNoteKind(note);
  const records = manuscript.bibliographicRecords ?? [];
  const noteCitations = note.noteCitations ?? [];

  function navigateToNote(): void {
    if (!section) {
      return;
    }

    selectSection(section.id);
    onNavigate?.();
  }

  function removeNote(): void {
    if (!window.confirm(t('notes.confirmDelete'))) {
      return;
    }

    stageRemoveNote(stableNoteId);
    onClose?.();
  }

  function insertCitations(selections: CitationPickerSelection[]): void {
    const citations = selections.map((selection) =>
      createNoteCitation(selection.recordId, selection.locator),
    );
    if (stageAddNoteCitations(stableNoteId, citations)) {
      setCitationPickerOpen(false);
    }
  }

  return (
    <section
      className={`omi-note-editor-card${
        compact ? ' omi-note-editor-card--compact' : ''
      }`}
      aria-label={`${t('notes.note')} ${noteNumber ?? '?'}`}
    >
      <header className="omi-note-editor-header">
        <div>
          <span className="omi-note-number">
            {noteNumber ?? '?'}
          </span>
          <strong>{noteKindLabel(noteKind, t)}</strong>
        </div>

        {onClose ? (
          <button
            type="button"
            className="omi-note-icon-button"
            onClick={onClose}
            aria-label={t('notes.closeEditor')}
            title={t('notes.closeEditor')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <label className="omi-note-field">
        <span>{t('notes.type')}</span>
        <select
          value={noteKind}
          onChange={(event) =>
            stageUpdateNote(stableNoteId, {
              kind: event.target.value as OmiNoteKind,
            })
          }
        >
          <option value="footnote">{t('notes.footnote')}</option>
          <option value="endnote">{t('notes.endnote')}</option>
          <option value="author-note">{t('notes.authorNote')}</option>
        </select>
      </label>

      <label className="omi-note-field">
        <span>{t('notes.body')}</span>
        <textarea
          value={note.body}
          placeholder={t('notes.bodyPlaceholder')}
          onChange={(event) =>
            stageUpdateNote(stableNoteId, {
              body: event.target.value,
            })
          }
        />
      </label>

      <section className="omi-note-citations" aria-label={citationCopy.citations}>
        <div className="omi-note-citations-header">
          <div>
            <strong>{citationCopy.citations}</strong>
            <p>{citationCopy.citationHint}</p>
          </div>
          <button
            type="button"
            className="studio-menu-secondary-action"
            onClick={() => setCitationPickerOpen((value) => !value)}
          >
            <BookOpen size={15} aria-hidden="true" />
            {citationCopy.addCitation}
          </button>
        </div>

        {citationPickerOpen ? (
          <CitationPicker
            onInsert={insertCitations}
            onCancel={() => setCitationPickerOpen(false)}
          />
        ) : null}

        {noteCitations.length ? (
          <ol className="omi-note-citation-list">
            {noteCitations.map((citation) => {
              const unresolved = !records.some((record) => record.id === citation.target);
              return (
                <li key={citation.id}>
                  <span className={unresolved ? 'is-unresolved' : ''}>
                    {renderNoteCitation(
                      citation,
                      note,
                      records,
                      manuscript.citationStyle ?? 'apa-7',
                      manuscript.locale,
                    )}
                  </span>
                  <button
                    type="button"
                    className="omi-note-icon-button"
                    aria-label={citationCopy.removeCitation}
                    title={citationCopy.removeCitation}
                    onClick={() => stageRemoveNoteCitation(stableNoteId, citation.id)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="omi-note-citation-empty">{citationCopy.noCitations}</p>
        )}
      </section>

      <div className="omi-note-meta">
        <code>{note.anchorId ?? stableNoteId}</code>
        <span>{t('notes.autoSave')}</span>
      </div>

      <div className="omi-note-actions">
        {section && onNavigate ? (
          <button
            type="button"
            className="studio-menu-secondary-action"
            onClick={navigateToNote}
          >
            <MapPin size={15} aria-hidden="true" />
            {t('notes.goToNote')}
          </button>
        ) : null}

        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-danger-action"
          onClick={removeNote}
        >
          <Trash2 size={15} aria-hidden="true" />
          {t('notes.delete')}
        </button>
      </div>
    </section>
  );
}

function noteKindLabel(
  kind: OmiNoteKind,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (kind) {
    case 'endnote':
      return t('notes.endnote');
    case 'author-note':
      return t('notes.authorNote');
    case 'footnote':
    default:
      return t('notes.footnote');
  }
}
