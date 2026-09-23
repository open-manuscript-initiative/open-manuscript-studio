import {
  useRef,
  type CSSProperties,
  type PointerEvent,
} from 'react';

import { stageSectionLayoutChange } from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  DEFAULT_SECTION_COLUMN_GAP_MM,
  normalizeColumnCount,
  normalizeSectionLayout,
  toggleTabStop,
} from '../model/sectionLayout';
import type { OmiSectionColumnCount } from '../types/omi';

interface PublicationSectionRulerProps {
  locale: string;
  viewMode: 'print' | 'html';
  widthPx: number;
  pageWidthMm: number;
  leftMarginMm: number;
  rightMarginMm: number;
  rulerStepPx: number;
}

interface SectionRulerCopy {
  sectionLayout: string;
  columns: string;
  columnGap: string;
  tabStops: string;
  clearTabs: string;
  rulerHint: string;
  noSection: string;
}

export function PublicationSectionRuler({
  locale,
  viewMode,
  widthPx,
  pageWidthMm,
  leftMarginMm,
  rightMarginMm,
  rulerStepPx,
}: PublicationSectionRulerProps) {
  const copy = rulerCopy(locale);
  const rulerRef = useRef<HTMLDivElement>(null);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const section = manuscript.sections.find((item) => item.id === selectedSectionId)
    ?? manuscript.sections[0];

  if (!section) {
    return <div className="publication-section-ruler-empty">{copy.noSection}</div>;
  }

  const layout = normalizeSectionLayout(section.layout);
  const columns = normalizeColumnCount(layout?.columns);
  const columnGapMm = layout?.columnGapMm ?? DEFAULT_SECTION_COLUMN_GAP_MM;
  const tabStops = layout?.tabStopsMm ?? [];
  const contentWidthMm = Math.max(1, pageWidthMm - leftMarginMm - rightMarginMm);
  const leftPct = (leftMarginMm / pageWidthMm) * 100;
  const rightPct = (rightMarginMm / pageWidthMm) * 100;
  const contentPct = Math.max(0, 100 - leftPct - rightPct);
  const rulerStyle = {
    width: viewMode === 'html' ? 'min(100%, 56rem)' : `${widthPx}px`,
    '--omi-publication-ruler-left': `${leftPct}%`,
    '--omi-publication-ruler-right': `${rightPct}%`,
    '--omi-publication-ruler-step': `${rulerStepPx}px`,
  } as CSSProperties;

  const updateLayout = (
    next: Parameters<typeof normalizeSectionLayout>[0],
  ) => {
    stageSectionLayoutChange(section.id, normalizeSectionLayout(next));
  };

  const onRulerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof Element
      && target.closest('[data-tab-stop], button, input, select, label')
    ) return;

    const ruler = rulerRef.current;
    if (!ruler) return;
    const rect = ruler.getBoundingClientRect();
    if (rect.width <= 0) return;

    const x = event.clientX - rect.left;
    const contentLeftPx = rect.width * leftPct / 100;
    const contentRightPx = rect.width * (1 - rightPct / 100);
    if (x < contentLeftPx || x > contentRightPx) return;

    const relative = (x - contentLeftPx) / Math.max(1, contentRightPx - contentLeftPx);
    const rawMm = relative * contentWidthMm;
    const snappedMm = Math.max(2.5, Math.round(rawMm / 2.5) * 2.5);
    updateLayout({
      ...layout,
      columns,
      columnGapMm,
      tabStopsMm: toggleTabStop(tabStops, snappedMm),
    });
  };

  return (
    <div className="publication-section-ruler-shell">
      <div className="publication-section-ruler-controls">
        <span className="publication-section-ruler-section">
          <strong>{copy.sectionLayout}</strong>
          <span>{section.title.trim() || '—'}</span>
        </span>
        <label>
          <span>{copy.columns}</span>
          <select
            value={String(columns)}
            onChange={(event) => updateLayout({
              ...layout,
              columns: Number(event.target.value) as OmiSectionColumnCount,
              columnGapMm,
              tabStopsMm: tabStops,
            })}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label>
          <span>{copy.columnGap}</span>
          <input
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={columnGapMm}
            disabled={columns === 1}
            onChange={(event) => updateLayout({
              ...layout,
              columns,
              columnGapMm: Number(event.target.value),
              tabStopsMm: tabStops,
            })}
          />
          <span>mm</span>
        </label>
        <span className="publication-section-ruler-tab-summary">
          {copy.tabStops}: {tabStops.length}
        </span>
        <button
          type="button"
          disabled={tabStops.length === 0}
          onClick={() => updateLayout({
            ...layout,
            columns,
            columnGapMm,
            tabStopsMm: [],
          })}
        >
          {copy.clearTabs}
        </button>
      </div>

      <div
        ref={rulerRef}
        className="publication-document-ruler publication-document-ruler--interactive"
        style={rulerStyle}
        role="group"
        aria-label={copy.rulerHint}
        title={copy.rulerHint}
        onPointerDown={onRulerPointerDown}
      >
        <span className="publication-document-ruler-margin publication-document-ruler-margin--left" />
        <span className="publication-document-ruler-margin publication-document-ruler-margin--right" />
        {Array.from({ length: Math.max(0, columns - 1) }, (_, index) => {
          const left = leftPct + contentPct * ((index + 1) / columns);
          return (
            <span
              className="publication-document-ruler-column-guide"
              style={{ left: `${left}%` }}
              key={index}
              aria-hidden="true"
            />
          );
        })}
        {tabStops.map((stop) => {
          const left = leftPct + contentPct * (stop / contentWidthMm);
          return (
            <button
              type="button"
              className="publication-document-ruler-tab-stop"
              data-tab-stop
              style={{ left: `${Math.min(leftPct + contentPct, Math.max(leftPct, left))}%` }}
              aria-label={`${copy.tabStops}: ${stop} mm`}
              title={`${stop} mm`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => updateLayout({
                ...layout,
                columns,
                columnGapMm,
                tabStopsMm: toggleTabStop(tabStops, stop),
              })}
              key={stop}
            >
              ┴
            </button>
          );
        })}
      </div>
    </div>
  );
}

function rulerCopy(locale: string): SectionRulerCopy {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') {
    return {
      sectionLayout: 'Szakasz elrendezése',
      columns: 'Hasábok',
      columnGap: 'Hasábköz',
      tabStops: 'Tabulátorok',
      clearTabs: 'Tabulátorok törlése',
      rulerHint: 'Kattintson a vonalzóra tabulátor hozzáadásához vagy eltávolításához.',
      noSection: 'Nincs aktív szakasz.',
    };
  }
  if (language === 'de') {
    return {
      sectionLayout: 'Abschnittslayout',
      columns: 'Spalten',
      columnGap: 'Spaltenabstand',
      tabStops: 'Tabstopps',
      clearTabs: 'Tabstopps löschen',
      rulerHint: 'Auf das Lineal klicken, um einen Tabstopp hinzuzufügen oder zu entfernen.',
      noSection: 'Kein aktiver Abschnitt.',
    };
  }
  return {
    sectionLayout: 'Section layout',
    columns: 'Columns',
    columnGap: 'Column gap',
    tabStops: 'Tab stops',
    clearTabs: 'Clear tabs',
    rulerHint: 'Click the ruler to add or remove a tab stop.',
    noSection: 'No active section.',
  };
}
