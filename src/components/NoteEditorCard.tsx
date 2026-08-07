import { MapPin, Trash2, X } from 'lucide-react';

import {
  stageRemoveNote,
  stageUpdateNote,
} from '../app/noteActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  getNoteKind,
  getNoteNumber,
  isNoteAnnotation,
  type OmiNoteKind,
} from '../model/notes';

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
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const note = manuscript.annotations.find(
    (annotation) =>
      annotation.id === noteId && isNoteAnnotation(annotation),
  );

  if (!note) {
    return null;
  }

  const noteNumber = getNoteNumber(manuscript, note.id);
  const section = manuscript.sections.find((candidate) =>
    candidate.blocks.some((block) => block.id === note.targetBlockId),
  );
  const noteKind = getNoteKind(note);

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

    stageRemoveNote(note.id);
    onClose?.();
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
            stageUpdateNote(note.id, {
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
            stageUpdateNote(note.id, {
              body: event.target.value,
            })
          }
        />
      </label>

      <div className="omi-note-meta">
        <code>{note.anchorId ?? note.id}</code>
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
