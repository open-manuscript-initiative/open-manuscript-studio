import { StickyNote } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  getNoteKind,
  sortNotesByDocumentOrder,
} from '../model/notes';
import { NoteEditorCard } from './NoteEditorCard';

interface NotesPanelProps {
  onNavigate?: () => void;
}

export function NotesPanel({ onNavigate }: NotesPanelProps) {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const notes = useMemo(
    () => sortNotesByDocumentOrder(manuscript),
    [manuscript],
  );

  return (
    <section className="studio-menu-view omi-notes-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>
            <StickyNote size={18} aria-hidden="true" />
            {t('notes.title')}
          </h3>
          <p>{t('notes.description')}</p>
        </div>

        <span className="omi-notes-count">
          {notes.length}
        </span>
      </div>

      {notes.length === 0 ? (
        <div className="omi-notes-empty">
          <StickyNote size={22} aria-hidden="true" />
          <p>{t('notes.empty')}</p>
          <small>{t('notes.emptyHint')}</small>
        </div>
      ) : (
        <div className="omi-notes-list">
          {notes.map((note, index) => {
            if (note.id === activeNoteId) {
              return (
                <NoteEditorCard
                  key={note.id}
                  noteId={note.id}
                  onClose={() => setActiveNoteId(null)}
                  onNavigate={onNavigate}
                />
              );
            }

            const preview = createNotePreview(note.body ?? '');
            const kind = getNoteKind(note);

            return (
              <button
                key={note.id}
                type="button"
                className="omi-note-editor-card omi-note-editor-card--compact"
                onClick={() => setActiveNoteId(note.id)}
                aria-label={`${t('notes.note')} ${index + 1}`}
              >
                <span className="omi-note-editor-header">
                  <span>
                    <span className="omi-note-number">{index + 1}</span>
                    <strong>{noteKindLabel(kind, t)}</strong>
                  </span>
                </span>
                {preview ? <span className="omi-note-meta">{preview}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function noteKindLabel(
  kind: ReturnType<typeof getNoteKind>,
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

function createNotePreview(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';

  try {
    const parsed: unknown = JSON.parse(trimmed);
    const text = collectText(parsed).replace(/\s+/g, ' ').trim();
    return truncate(text);
  } catch {
    return truncate(trimmed.replace(/\s+/g, ' '));
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(collectText).join(' ');

  const node = value as Record<string, unknown>;
  const ownText = typeof node.text === 'string' ? node.text : '';
  const childText = Array.isArray(node.content)
    ? node.content.map(collectText).join(' ')
    : '';
  return `${ownText} ${childText}`;
}

function truncate(value: string): string {
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}
