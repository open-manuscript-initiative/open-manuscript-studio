import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCrossReferenceCopy } from '../i18n/crossReferences';
import {
  collectCrossReferenceTargets,
  formatCrossReferenceTargetOption,
} from '../model/crossReferences';
import type {
  OmiCrossReferenceDisplayStyle,
  OmiCrossReferenceTargetKind,
} from '../types/omi';

interface CrossReferencePickerProps {
  onInsert: (
    targetId: string,
    targetKind: OmiCrossReferenceTargetKind,
    displayStyle: OmiCrossReferenceDisplayStyle,
  ) => void;
  onCancel: () => void;
}

const TARGET_KINDS: Array<OmiCrossReferenceTargetKind | 'all'> = [
  'all',
  'section',
  'figure',
  'table',
  'chart',
  'equation',
  'bookmark',
];

export function CrossReferencePicker({
  onInsert,
  onCancel,
}: CrossReferencePickerProps) {
  const { locale } = useTranslation();
  const copy = getCrossReferenceCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<
    OmiCrossReferenceTargetKind | 'all'
  >('all');
  const [displayStyle, setDisplayStyle] =
    useState<OmiCrossReferenceDisplayStyle>('label-number');
  const targets = useMemo(
    () => collectCrossReferenceTargets(manuscript),
    [manuscript],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filteredTargets = targets.filter((target) => {
    if (kind !== 'all' && target.kind !== kind) return false;
    if (!normalizedQuery) return true;

    const haystack = `${formatCrossReferenceTargetOption(
      target,
      manuscript.locale,
    )} ${target.title}`.toLocaleLowerCase(locale);
    return haystack.includes(normalizedQuery);
  });

  return (
    <section className="omi-xref-picker" aria-label={copy.chooseTarget}>
      <header className="omi-xref-picker-header">
        <div>
          <strong>{copy.chooseTarget}</strong>
          <p>{copy.insertDescription}</p>
        </div>
        <button
          type="button"
          className="omi-xref-icon-button"
          onClick={onCancel}
          aria-label={copy.cancel}
          title={copy.cancel}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="omi-xref-picker-controls">
        <label className="omi-xref-search">
          <Search size={15} aria-hidden="true" />
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          <span>{copy.target}</span>
          <select
            value={kind}
            onChange={(event) =>
              setKind(
                event.target.value as
                  | OmiCrossReferenceTargetKind
                  | 'all',
              )
            }
          >
            <option value="all">—</option>
            {TARGET_KINDS.filter((value) => value !== 'all').map(
              (value) => (
                <option key={value} value={value}>
                  {kindLabel(value as OmiCrossReferenceTargetKind, copy, locale)}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>{copy.display}</span>
          <select
            value={displayStyle}
            onChange={(event) =>
              setDisplayStyle(
                event.target.value as OmiCrossReferenceDisplayStyle,
              )
            }
          >
            <option value="label-number">{copy.displayLabelNumber}</option>
            <option value="number">{copy.displayNumber}</option>
            <option value="title">{copy.displayTitle}</option>
            <option value="label-number-title">
              {copy.displayLabelNumberTitle}
            </option>
          </select>
        </label>
      </div>

      <div className="omi-xref-target-list" role="listbox">
        {filteredTargets.length === 0 ? (
          <p className="omi-xref-empty">{copy.noTargets}</p>
        ) : (
          filteredTargets.map((target) => (
            <button
              key={target.id}
              type="button"
              role="option"
              aria-selected="false"
              className="omi-xref-target"
              onClick={() =>
                onInsert(target.id, target.kind, displayStyle)
              }
            >
              <strong>
                {formatCrossReferenceTargetOption(
                  target,
                  manuscript.locale,
                )}
              </strong>
              <small>{kindLabel(target.kind, copy, locale)}</small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function kindLabel(
  kind: OmiCrossReferenceTargetKind,
  copy: ReturnType<typeof getCrossReferenceCopy>,
  locale: string,
): string {
  switch (kind) {
    case 'section':
      return copy.section;
    case 'figure':
      return copy.figure;
    case 'table':
      return copy.table;
    case 'chart':
      return copy.chart;
    case 'equation':
      return copy.equation;
    case 'bookmark':
      return bookmarkLabel(locale);
  }
}

function bookmarkLabel(locale: string): string {
  switch (locale.trim().toLowerCase().split('-')[0]) {
    case 'hu':
      return 'Könyvjelző';
    case 'de':
      return 'Textmarke';
    default:
      return 'Bookmark';
  }
}
