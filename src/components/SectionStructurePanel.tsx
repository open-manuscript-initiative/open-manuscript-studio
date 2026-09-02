import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  Plus,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';

import {
  stageIndentSection,
  stageInsertSectionAfter,
  stageInsertSubsection,
  stageInsertTopLevelSection,
  stageMoveSectionSibling,
  stageOutdentSection,
  stageReparentSection,
} from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { requestBlockEditorFocus } from '../editor/blockFocusRegistry';
import { findRenderedSectionElement } from '../editor/renderedManuscriptNavigation';
import { useTranslation } from '../i18n';
import { getSectionStructureCopy } from '../i18n/sectionStructure';
import {
  formatHierarchicalSectionHeading,
} from '../model/sectionNumbering';
import {
  buildSectionOutline,
  canIndentSection,
  canOutdentSection,
  getParentSectionId,
  isDescendantOf,
  validateSectionHierarchy,
} from '../model/sectionStructure';

interface SectionStructurePanelProps {
  onNavigate?: () => void;
}

export function SectionStructurePanel({
  onNavigate,
}: SectionStructurePanelProps) {
  const { locale } = useTranslation();
  const copy = getSectionStructureCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );
  const selectSection = useStudioStore(
    (state) => state.selectSection,
  );
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [rootDropActive, setRootDropActive] = useState(false);
  const outline = useMemo(
    () => buildSectionOutline(manuscript.sections),
    [manuscript.sections],
  );
  const hierarchyIssues = useMemo(
    () => validateSectionHierarchy(manuscript.sections),
    [manuscript.sections],
  );

  function finishDrag(): void {
    setDraggedSectionId(null);
    setDropTargetId(null);
    setRootDropActive(false);
  }

  function insertTopLevel(): void {
    const sectionId = stageInsertTopLevelSection();
    if (!sectionId) return;

    const section = useStudioStore
      .getState()
      .manuscript.sections.find((candidate) => candidate.id === sectionId);
    const firstBlockId = section?.blocks[0]?.id;
    if (firstBlockId) requestBlockEditorFocus(firstBlockId, 'start');
    onNavigate?.();
    window.setTimeout(() => {
      findRenderedSectionElement(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  function insertSubsection(parentId: string): void {
    const sectionId = stageInsertSubsection(parentId);
    if (sectionId) onNavigate?.();
  }

  function insertAfter(sectionId: string): void {
    const insertedId = stageInsertSectionAfter(sectionId);
    if (insertedId) onNavigate?.();
  }

  function canDropOnTarget(targetId: string): boolean {
    return Boolean(
      draggedSectionId &&
        draggedSectionId !== targetId &&
        !isDescendantOf(manuscript.sections, targetId, draggedSectionId),
    );
  }

  function dropAsChild(
    event: DragEvent<HTMLElement>,
    targetId: string,
  ): void {
    event.preventDefault();
    if (draggedSectionId && canDropOnTarget(targetId)) {
      stageReparentSection(draggedSectionId, targetId);
    }
    finishDrag();
  }

  function dropAtRoot(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (draggedSectionId) {
      stageReparentSection(draggedSectionId, undefined);
    }
    finishDrag();
  }

  return (
    <section
      className="omi-section-structure"
      aria-labelledby="section-structure-title"
    >
      <header className="omi-section-structure-header">
        <div>
          <h4 id="section-structure-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>

        <button
          type="button"
          className="omi-section-add-root"
          onClick={insertTopLevel}
        >
          <Plus size={15} aria-hidden="true" />
          {copy.addTopLevel}
        </button>
      </header>

      <p className="omi-section-structure-hint">{copy.dragHint}</p>

      {hierarchyIssues.length > 0 ? (
        <div className="omi-section-hierarchy-warning" role="alert">
          {copy.invalidHierarchy}
        </div>
      ) : null}

      {draggedSectionId ? (
        <div
          className={`omi-section-root-drop${
            rootDropActive ? ' omi-section-root-drop--active' : ''
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setRootDropActive(true);
            setDropTargetId(null);
          }}
          onDragLeave={() => setRootDropActive(false)}
          onDrop={dropAtRoot}
        >
          {copy.addTopLevel}
        </div>
      ) : null}

      <div className="omi-section-structure-list">
        {outline.map(({ section, depth, parentSectionId }) => {
          const selected = section.id === selectedSectionId;
          const heading = formatHierarchicalSectionHeading(
            section.title || copy.emptyTitle,
            manuscript.sections,
            section.id,
            manuscript.sectionNumberingStyle,
          );
          const siblings = manuscript.sections.filter(
            (candidate) => getParentSectionId(candidate) === parentSectionId,
          );
          const siblingIndex = siblings.findIndex(
            (candidate) => candidate.id === section.id,
          );
          const canMoveUp = siblingIndex > 0;
          const canMoveDown =
            siblingIndex >= 0 && siblingIndex < siblings.length - 1;
          const canIndent = canIndentSection(manuscript.sections, section.id);
          const canOutdent = canOutdentSection(manuscript.sections, section.id);
          const validDropTarget = canDropOnTarget(section.id);
          const isDropTarget = dropTargetId === section.id;
          const rowStyle = {
            '--omi-section-depth': depth,
          } as CSSProperties;

          return (
            <article
              key={section.id}
              className={`omi-section-structure-item${
                selected ? ' omi-section-structure-item--selected' : ''
              }${isDropTarget ? ' omi-section-structure-item--drop-target' : ''}`}
              data-section-id={section.id}
              data-section-depth={depth}
              style={rowStyle}
              onDragOver={(event) => {
                if (!validDropTarget) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTargetId(section.id);
                setRootDropActive(false);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDropTargetId((current) =>
                    current === section.id ? null : current,
                  );
                }
              }}
              onDrop={(event) => dropAsChild(event, section.id)}
              title={isDropTarget ? copy.dropAsChild : undefined}
            >
              <div
                className="omi-section-drag-handle"
                draggable
                role="button"
                tabIndex={0}
                aria-label={`${copy.dragSection}: ${heading}`}
                title={copy.dragSection}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', section.id);
                  setDraggedSectionId(section.id);
                }}
                onDragEnd={finishDrag}
              >
                <GripVertical size={18} aria-hidden="true" />
              </div>

              <button
                type="button"
                className="omi-section-structure-open"
                onClick={() => {
                  selectSection(section.id);
                  onNavigate?.();
                }}
                title={copy.openSection}
              >
                <strong>{heading}</strong>
                <small>
                  {copy.level} {depth + 1}
                  {selected ? ` · ${copy.selected}` : ''}
                </small>
              </button>

              <div className="omi-section-structure-actions">
                <button
                  type="button"
                  onClick={() => insertSubsection(section.id)}
                  aria-label={`${copy.addSubsection}: ${heading}`}
                  title={copy.addSubsection}
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => insertAfter(section.id)}
                  aria-label={`${copy.insertAfter}: ${heading}`}
                  title={copy.insertAfter}
                >
                  <Plus size={15} aria-hidden="true" />
                  <span className="omi-section-action-sibling">↳</span>
                </button>
                <button
                  type="button"
                  disabled={!canOutdent}
                  onClick={() => stageOutdentSection(section.id)}
                  aria-label={`${copy.outdent}: ${heading}`}
                  title={copy.outdent}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!canIndent}
                  onClick={() => stageIndentSection(section.id)}
                  aria-label={`${copy.indent}: ${heading}`}
                  title={copy.indent}
                >
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveUp}
                  onClick={() => stageMoveSectionSibling(section.id, -1)}
                  aria-label={`${copy.moveUp}: ${heading}`}
                  title={copy.moveUp}
                >
                  <ArrowUp size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveDown}
                  onClick={() => stageMoveSectionSibling(section.id, 1)}
                  aria-label={`${copy.moveDown}: ${heading}`}
                  title={copy.moveDown}
                >
                  <ArrowDown size={15} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
