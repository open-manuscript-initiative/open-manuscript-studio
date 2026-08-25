import { useMemo, type CSSProperties } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { buildTableOfContentsEntries } from '../model/tableOfContents';
import './EmbeddedTableOfContents.css';

const labels: Record<string, string> = {
  en: 'Table of contents',
  hu: 'Tartalomjegyzék',
  de: 'Inhaltsverzeichnis',
};

export function EmbeddedTableOfContents() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectSection = useStudioStore((state) => state.selectSection);
  const toc = manuscript.tableOfContents;
  const entries = useMemo(
    () => (toc ? buildTableOfContentsEntries(manuscript.sections, toc) : []),
    [manuscript.sections, toc],
  );

  if (!toc || entries.length === 0) return null;

  function navigate(sectionId: string): void {
    selectSection(sectionId);
    const attempt = (remaining: number) => {
      const target = document.querySelector<HTMLElement>(
        `.omi-continuous-section[data-section-id="${cssEscape(sectionId)}"]`,
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('omi-toc-navigation-target');
        window.setTimeout(() => target.classList.remove('omi-toc-navigation-target'), 1400);
        return;
      }
      if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 80);
    };
    window.setTimeout(() => attempt(8), 0);
  }

  return (
    <nav className="omi-embedded-toc" aria-label={toc.title || labels[locale] || labels.en}>
      <h2>{toc.title || labels[locale] || labels.en}</h2>
      <ol>
        {entries.map((entry) => (
          <li
            key={entry.sectionId}
            style={{ '--omi-toc-level': entry.level - toc.minLevel } as CSSProperties}
          >
            <button type="button" onClick={() => navigate(entry.sectionId)}>
              {entry.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
