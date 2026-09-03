import { useStudioStore } from '../app/useStudioStore';
import { findRenderedNoteElement } from '../editor/renderedManuscriptNavigation';
import { useTranslation } from '../i18n';
import { getCurrentStudyNotesCopy } from '../i18n/currentStudyNotes';
import {
  getNoteKind,
  type OmiNoteKind,
} from '../model/notes';
import {
  createNoteBodyDocument,
  noteBodyPlainText,
} from '../model/noteRichText';
import type { ManuscriptStudy } from '../model/sectionStructure';
import type { OmiAnnotation, OmiBlock, OmiSection } from '../types/omi';

interface CurrentStudyNotesFooterProps {
  study: ManuscriptStudy;
  notes: readonly OmiAnnotation[];
  numberByNoteId: ReadonlyMap<string, number>;
}

export function CurrentStudyNotesFooter({
  study,
  notes,
  numberByNoteId,
}: CurrentStudyNotesFooterProps) {
  const { t, locale } = useTranslation();
  const copy = getCurrentStudyNotesCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const root = study.sections.find(
    (section) => section.id === study.rootSectionId,
  );
  const studyTitle = root?.title.trim() || manuscript.title || t('notes.title');

  function navigateToNote(note: OmiAnnotation): void {
    const section = findStudySectionForBlock(study, note.targetBlockId);
    if (section) selectSection(section.id);

    window.requestAnimationFrame(() => {
      const anchor = findRenderedNoteElement(note.id);
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      anchor?.focus({ preventScroll: true });
      anchor?.click();
    });
  }

  return (
    <section
      id="omi-current-study-notes"
      className="omi-current-study-notes"
      aria-labelledby="omi-current-study-notes-title"
    >
      <header className="omi-current-study-notes__header">
        <div>
          <h2 id="omi-current-study-notes-title">{t('notes.title')}</h2>
          <p>{studyTitle}</p>
        </div>
        <span
          className="omi-current-study-notes__count"
          aria-label={`${notes.length} ${t('notes.title')}`}
        >
          {notes.length}
        </span>
      </header>

      {notes.length > 0 ? (
        <ol className="omi-current-study-notes__list">
          {notes.map((note) => {
            const noteNumber = numberByNoteId.get(note.id) ?? '?';
            const kind = getNoteKind(note);
            const body = noteBodyPlainText(createNoteBodyDocument(
              note,
              manuscript.bibliographicRecords ?? [],
              manuscript.citationStyle ?? 'apa-7',
              manuscript.locale,
            ));
            const navigationLabel = `${t('notes.goToNote')}: ${noteNumber}`;

            return (
              <li key={note.id} className="omi-current-study-note">
                <button
                  type="button"
                  className="omi-current-study-note__number"
                  onClick={() => navigateToNote(note)}
                  aria-label={navigationLabel}
                  title={navigationLabel}
                >
                  {noteNumber}
                </button>
                <div className="omi-current-study-note__content">
                  {kind === 'footnote' ? null : (
                    <span className="omi-current-study-note__kind">
                      {noteKindLabel(kind, t)}
                    </span>
                  )}
                  <p>{body || '—'}</p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="omi-current-study-notes__empty">{copy.empty}</p>
      )}
    </section>
  );
}

function findStudySectionForBlock(
  study: ManuscriptStudy,
  blockId: string,
): OmiSection | undefined {
  return study.sections.find((section) =>
    section.blocks.some((block) => blockContainsId(block, blockId)),
  );
}

function blockContainsId(block: OmiBlock, blockId: string): boolean {
  return block.id === blockId
    || (block.children ?? []).some((child) => blockContainsId(child, blockId));
}

function noteKindLabel(
  kind: OmiNoteKind,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (kind === 'endnote') return t('notes.endnote');
  if (kind === 'author-note') return t('notes.authorNote');
  return t('notes.footnote');
}
