import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
} from 'lucide-react';
import {
  Fragment,
  useState,
  type DragEvent,
} from 'react';

import {
  stageInsertSectionAtGap,
  stageMoveSectionToGap,
  stageMoveSectionToIndex,
} from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getSectionStructureCopy } from '../i18n/sectionStructure';
import { formatSectionHeading } from '../model/sectionNumbering';

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
  const [activeDropGap, setActiveDropGap] = useState<number | null>(null);

  function insertAt(gapIndex: number): void {
    const sectionId = stageInsertSectionAtGap(gapIndex);

    if (sectionId) {
      onNavigate?.();
    }
  }

  function dropAt(event: DragEvent<HTMLDivElement>, gapIndex: number): void {
    event.preventDefault();

    if (draggedSectionId) {
      stageMoveSectionToGap(draggedSectionId, gapIndex);
    }

    setDraggedSectionId(null);
    setActiveDropGap(null);
  }

  return (
    <section className="omi-section-structure" aria-labelledby="section-structure-title">
      <header className="omi-section-structure-header">
        <div>
          <h4 id="section-structure-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </header>

      <p className="omi-section-structure-hint">{copy.dragHint}</p>

      <div className="omi-section-structure-list">
        <SectionGap
          gapIndex={0}
          label={copy.insertFirst}
          active={activeDropGap === 0}
          dragging={Boolean(draggedSectionId)}
          onInsert={insertAt}
          onDragEnter={setActiveDropGap}
          onDrop={dropAt}
        />

        {manuscript.sections.map((section, index) => {
          const selected = section.id === selectedSectionId;
          const heading = formatSectionHeading(
            section.title || copy.emptyTitle,
            index,
            manuscript.sectionNumberingStyle,
          );

          return (
            <Fragment key={section.id}>
              <article
                className={`omi-section-structure-item${
                  selected ? ' omi-section-structure-item--selected' : ''
                }`}
                data-section-id={section.id}
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
                  onDragEnd={() => {
                    setDraggedSectionId(null);
                    setActiveDropGap(null);
                  }}
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
                  {selected ? <span>{copy.selected}</span> : null}
                </button>

                <div className="omi-section-structure-actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      stageMoveSectionToIndex(section.id, index - 1)
                    }
                    aria-label={`${copy.moveUp}: ${heading}`}
                    title={copy.moveUp}
                  >
                    <ArrowUp size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === manuscript.sections.length - 1}
                    onClick={() =>
                      stageMoveSectionToIndex(section.id, index + 1)
                    }
                    aria-label={`${copy.moveDown}: ${heading}`}
                    title={copy.moveDown}
                  >
                    <ArrowDown size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>

              <SectionGap
                gapIndex={index + 1}
                label={
                  index === manuscript.sections.length - 1
                    ? copy.insertAfterLast
                    : copy.insertHere
                }
                active={activeDropGap === index + 1}
                dragging={Boolean(draggedSectionId)}
                onInsert={insertAt}
                onDragEnter={setActiveDropGap}
                onDrop={dropAt}
              />
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

interface SectionGapProps {
  gapIndex: number;
  label: string;
  active: boolean;
  dragging: boolean;
  onInsert: (gapIndex: number) => void;
  onDragEnter: (gapIndex: number) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, gapIndex: number) => void;
}

function SectionGap({
  gapIndex,
  label,
  active,
  dragging,
  onInsert,
  onDragEnter,
  onDrop,
}: SectionGapProps) {
  return (
    <div
      className={`omi-section-gap${active ? ' omi-section-gap--active' : ''}${
        dragging ? ' omi-section-gap--dragging' : ''
      }`}
      onDragOver={(event) => {
        if (!dragging) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragEnter(gapIndex);
      }}
      onDragEnter={(event) => {
        if (!dragging) return;
        event.preventDefault();
        onDragEnter(gapIndex);
      }}
      onDrop={(event) => onDrop(event, gapIndex)}
    >
      <span className="omi-section-gap-line" aria-hidden="true" />
      <button
        type="button"
        className="omi-section-gap-button"
        onClick={() => onInsert(gapIndex)}
        aria-label={label}
        title={label}
      >
        <Plus size={14} aria-hidden="true" />
        <span>{label}</span>
      </button>
      <span className="omi-section-gap-line" aria-hidden="true" />
    </div>
  );
}
