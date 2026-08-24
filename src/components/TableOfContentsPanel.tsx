import { ListTree } from 'lucide-react';
import { useMemo } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { buildTableOfContentsEntries } from '../model/tableOfContents';

const labels: Record<string, {
  title: string;
  description: string;
  empty: string;
  imported: string;
  levels: string;
}> = {
  en: {
    title: 'Table of contents',
    description: 'Live table of contents generated from the manuscript heading hierarchy.',
    empty: 'This manuscript does not contain a semantic table of contents.',
    imported: 'Recognized Word TOC field',
    levels: 'Heading levels',
  },
  hu: {
    title: 'Tartalomjegyzék',
    description: 'A kézirat címsorhierarchiájából automatikusan frissülő tartalomjegyzék.',
    empty: 'A kézirat nem tartalmaz szemantikus tartalomjegyzéket.',
    imported: 'Felismert Word TOC mező',
    levels: 'Címsorszintek',
  },
  de: {
    title: 'Inhaltsverzeichnis',
    description: 'Automatisch aktualisiertes Inhaltsverzeichnis aus der Überschriftenhierarchie.',
    empty: 'Dieses Manuskript enthält kein semantisches Inhaltsverzeichnis.',
    imported: 'Erkanntes Word-TOC-Feld',
    levels: 'Überschriftenebenen',
  },
};

interface TableOfContentsPanelProps {
  onNavigate?: () => void;
}

export function TableOfContentsPanel({ onNavigate }: TableOfContentsPanelProps) {
  const { locale } = useTranslation();
  const copy = labels[locale] ?? labels.en;
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const toc = manuscript.tableOfContents;
  const entries = useMemo(
    () => (toc ? buildTableOfContentsEntries(manuscript.sections, toc) : []),
    [manuscript.sections, toc],
  );

  if (!toc) {
    return (
      <section className="studio-menu-view">
        <div className="studio-menu-view-header"><div><h3><ListTree size={18} aria-hidden="true" />{copy.title}</h3><p>{copy.description}</p></div></div>
        <div className="omi-notes-empty"><ListTree size={22} aria-hidden="true" /><p>{copy.empty}</p></div>
      </section>
    );
  }

  function navigate(sectionId: string): void {
    selectSection(sectionId);
    onNavigate?.();
    document.querySelector<HTMLButtonElement>('.studio-menu-close')?.click();
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `.omi-continuous-section[data-section-id="${cssEscape(sectionId)}"]`,
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.querySelector<HTMLElement>('.omi-section-title-input')?.focus({ preventScroll: true });
    }, 120);
  }

  return (
    <section className="studio-menu-view">
      <div className="studio-menu-view-header">
        <div><h3><ListTree size={18} aria-hidden="true" />{toc.title || copy.title}</h3><p>{copy.description}</p></div>
        <span className="omi-notes-count">{entries.length}</span>
      </div>
      {toc.source?.format === 'docx-toc' ? (
        <div className="studio-tool-card"><div><strong>{copy.imported}</strong><p>{copy.levels}: {toc.minLevel}–{toc.maxLevel}</p></div></div>
      ) : null}
      <div className="omi-notes-list" aria-label={copy.title}>
        {entries.map((entry) => (
          <button
            key={entry.sectionId}
            type="button"
            className="studio-menu-secondary-action"
            style={{ paddingInlineStart: `${0.75 + (entry.level - toc.minLevel) * 1.1}rem` }}
            onClick={() => navigate(entry.sectionId)}
          >
            <span>{entry.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
