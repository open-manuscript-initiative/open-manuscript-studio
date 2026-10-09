import { useEffect, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import {
  RENDERED_MANUSCRIPT_CHANGE_EVENT,
  findRenderedNoteElement,
} from '../editor/renderedManuscriptNavigation';
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
  const noteIdsKey = notes.map((note) => note.id).join('\u0000');
  const visibleNoteIds = useVisibleNoteIds(noteIdsKey);
  const visibleNotes = notes.filter((note) => visibleNoteIds.has(note.id));

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
          aria-label={`${visibleNotes.length} ${t('notes.title')}`}
        >
          {visibleNotes.length}
        </span>
      </header>

      {visibleNotes.length > 0 ? (
        <ol className="omi-current-study-notes__list">
          {visibleNotes.map((note) => {
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
      ) : notes.length === 0 ? (
        <p className="omi-current-study-notes__empty">{copy.empty}</p>
      ) : null}
    </section>
  );
}

function useVisibleNoteIds(
  noteIdsKey: string,
): ReadonlySet<string> {
  const [visibleNoteIds, setVisibleNoteIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const noteIds = new Set(noteIdsKey ? noteIdsKey.split('\u0000') : []);
    const noteIdByElement = new Map<HTMLElement, string>();
    const intersectingElements = new Set<HTMLElement>();
    let active = true;
    let scanFrame: number | null = null;

    const publishVisibleNotes = () => {
      if (!active) return;

      const viewportBottom = window.innerHeight;
      const headerBottom = Math.max(
        0,
        Math.min(
          viewportBottom,
          document.querySelector<HTMLElement>('.app-header.focus-header')
            ?.getBoundingClientRect().bottom ?? 0,
        ),
      );
      const nextVisibleNoteIds = new Set<string>();

      for (const [element, noteId] of noteIdByElement) {
        const rect = element.getBoundingClientRect();
        const intersectsViewport = intersectionObserver
          ? intersectingElements.has(element)
          : rect.bottom > 0
            && rect.top < viewportBottom
            && rect.right > 0
            && rect.left < window.innerWidth;

        if (
          intersectsViewport
          && rect.width > 0
          && rect.height > 0
          && rect.bottom > headerBottom
          && rect.top < viewportBottom
          && rect.right > 0
          && rect.left < window.innerWidth
        ) {
          nextVisibleNoteIds.add(noteId);
        }
      }

      setVisibleNoteIds((current) => sameStringSet(current, nextVisibleNoteIds)
        ? current
        : nextVisibleNoteIds);
    };

    const intersectionObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const element = entry.target as HTMLElement;
            if (entry.isIntersecting) intersectingElements.add(element);
            else intersectingElements.delete(element);
          }
          publishVisibleNotes();
        }, { root: null, threshold: 0 });

    const scanAnchors = () => {
      const nextElements = new Map<HTMLElement, string>();
      document.querySelectorAll<HTMLElement>('[data-omi-note][data-note-id]')
        .forEach((element) => {
          const noteId = element.dataset.noteId;
          if (noteId && noteIds.has(noteId)) nextElements.set(element, noteId);
        });

      for (const element of noteIdByElement.keys()) {
        if (nextElements.has(element)) continue;
        intersectionObserver?.unobserve(element);
        intersectingElements.delete(element);
        noteIdByElement.delete(element);
      }

      for (const [element, noteId] of nextElements) {
        if (!noteIdByElement.has(element)) intersectionObserver?.observe(element);
        noteIdByElement.set(element, noteId);
      }

      publishVisibleNotes();
    };

    const scheduleAnchorScan = () => {
      if (scanFrame !== null) return;
      scanFrame = window.requestAnimationFrame(() => {
        scanFrame = null;
        scanAnchors();
      });
    };

    const containsNoteAnchor = (node: Node): boolean => {
      if (node.nodeType !== 1) return false;
      const element = node as Element;
      return element.matches('[data-omi-note][data-note-id]')
        || element.querySelector('[data-omi-note][data-note-id]') !== null;
    };

    const mutationObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          if (records.some((record) =>
            [...record.addedNodes, ...record.removedNodes].some(containsNoteAnchor),
          )) scheduleAnchorScan();
        });
    if (document.body) {
      mutationObserver?.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener('scroll', publishVisibleNotes, true);
    window.addEventListener('resize', publishVisibleNotes);
    window.visualViewport?.addEventListener('scroll', publishVisibleNotes);
    window.visualViewport?.addEventListener('resize', publishVisibleNotes);
    document.addEventListener(RENDERED_MANUSCRIPT_CHANGE_EVENT, scheduleAnchorScan);
    scheduleAnchorScan();

    return () => {
      active = false;
      if (scanFrame !== null) window.cancelAnimationFrame(scanFrame);
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('scroll', publishVisibleNotes, true);
      window.removeEventListener('resize', publishVisibleNotes);
      window.visualViewport?.removeEventListener('scroll', publishVisibleNotes);
      window.visualViewport?.removeEventListener('resize', publishVisibleNotes);
      document.removeEventListener(RENDERED_MANUSCRIPT_CHANGE_EVENT, scheduleAnchorScan);
    };
  }, [noteIdsKey]);

  return visibleNoteIds;
}

function sameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
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
