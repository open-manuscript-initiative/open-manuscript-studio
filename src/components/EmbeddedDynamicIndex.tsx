import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { groupIndexEntries } from '../model/indexing';
import './EmbeddedDynamicIndex.css';

export function EmbeddedDynamicIndex() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const generatedIndexes = manuscript.generatedIndexes ?? [];
  const navigableEntries = useMemo(
    () => (manuscript.indexEntries ?? []).filter((entry) => Boolean(entry.targetBlockId)),
    [manuscript.indexEntries],
  );
  const groups = useMemo(() => groupIndexEntries(navigableEntries), [navigableEntries]);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const manuscriptPage = document.querySelector<HTMLElement>('.omi-manuscript-page');
    if (!manuscriptPage) return;
    const element = document.createElement('div');
    element.className = 'omi-embedded-dynamic-index-host';
    manuscriptPage.appendChild(element);
    setHost(element);
    return () => {
      setHost(null);
      element.remove();
    };
  }, []);

  if (!host || !generatedIndexes.length || !groups.length) return null;

  const title = generatedIndexes[0]?.title?.trim() || defaultIndexTitle(locale);

  return createPortal(
    <section className="omi-embedded-dynamic-index" aria-label={title}>
      <h2>{title}</h2>
      <div className="omi-embedded-dynamic-index-list">
        {groups.map((group) => (
          <p key={group.key} className="omi-embedded-dynamic-index-row">
            <span className="omi-embedded-dynamic-index-label">{group.label}</span>{' '}
            <span className="omi-embedded-dynamic-index-links">
              {group.entries.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  className="omi-embedded-dynamic-index-link"
                  aria-label={`${group.label} — ${occurrenceLabel(locale, index + 1)}`}
                  title={goToLabel(locale)}
                  onClick={() => navigateToIndexTarget(entry.targetBlockId)}
                >
                  ↗
                </button>
              ))}
            </span>
          </p>
        ))}
      </div>
    </section>,
    host,
  );
}

function navigateToIndexTarget(blockId: string | undefined): void {
  if (!blockId) return;
  const reveal = (attempt: number) => {
    window.setTimeout(() => {
      const target = document.getElementById(`omi-target-${blockId}`)
        ?? document.querySelector<HTMLElement>(`[data-block-id="${cssEscape(blockId)}"]`);
      if (!target) {
        if (attempt < 12) reveal(attempt + 1);
        return;
      }
      target.scrollIntoView({ behavior: attempt === 0 ? 'smooth' : 'auto', block: 'center' });
      target.classList.add('omi-index-navigation-target');
      window.setTimeout(() => target.classList.remove('omi-index-navigation-target'), 1600);
    }, 80);
  };
  reveal(0);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

function defaultIndexTitle(locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return language === 'hu' ? 'Névmutató' : language === 'de' ? 'Personenregister' : 'Name index';
}

function goToLabel(locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return language === 'hu' ? 'Ugrás az előforduláshoz' : language === 'de' ? 'Zum Vorkommen' : 'Go to occurrence';
}

function occurrenceLabel(locale: string, number: number): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  if (language === 'hu') return `${number}. előfordulás`;
  if (language === 'de') return `${number}. Vorkommen`;
  return `occurrence ${number}`;
}
