import { StickyNote } from 'lucide-react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { sortNotesByDocumentOrder } from '../model/notes';
import { NoteEditorCard } from './NoteEditorCard';

interface NotesPanelProps {
  onNavigate?: () => void;
}

export function NotesPanel({ onNavigate }: NotesPanelProps) {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const notes = sortNotesByDocumentOrder(manuscript);

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
          {notes.map((note) => (
            <NoteEditorCard
              key={note.id}
              noteId={note.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
