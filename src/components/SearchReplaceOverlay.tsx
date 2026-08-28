import { Replace, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { findTextMatchRanges, type ManuscriptSearchOptions } from '../model/manuscriptSearch';
import { SearchReplaceOverlay as SearchReplaceOverlayBase } from './SearchReplaceOverlayBase';

const OBJECT_SCOPES = new Set(['visuals', 'images', 'tables', 'charts', 'equations']);
const SEARCH_HIGHLIGHT_NAME = 'omi-search-match';

type SearchMode = 'find' | 'replace';
type HighlightRegistry = { set: (name: string, highlight: unknown) => void; delete: (name: string) => boolean };
type HighlightConstructor = new (...ranges: Range[]) => unknown;

/**
 * Adds mobile IME handling, an explicit Find/Replace mode switch and
 * non-destructive CSS Custom Highlight rendering on top of the shared search
 * engine. The highlight layer never mutates Tiptap/ProseMirror document DOM.
 */
export function SearchReplaceOverlay() {
  const { locale } = useTranslation();
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const rootRef = useRef<HTMLDivElement>(null);
  const replayingEnter = useRef(false);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<SearchMode>('find');
  const copy = getModeCopy(locale);

  const clearVisibleHighlights = () => {
    const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
    registry?.delete(SEARCH_HIGHLIGHT_NAME);
  };

  const highlightVisibleResults = (searchPanel: Element) => {
    clearVisibleHighlights();
    const input = searchPanel.querySelector<HTMLInputElement>('input');
    const scope = searchPanel.querySelector<HTMLSelectElement>('select')?.value ?? 'all';
    const query = input?.value ?? '';
    if (!query.trim() || OBJECT_SCOPES.has(scope) || scope === 'notes' || scope === 'metadata' || scope === 'headings') return;

    const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
    const HighlightCtor = (globalThis as unknown as { Highlight?: HighlightConstructor }).Highlight;
    if (!registry || !HighlightCtor) return;

    const checkboxes = Array.from(searchPanel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const options: ManuscriptSearchOptions = {
      caseSensitive: checkboxes[0]?.checked ?? false,
      wholeWord: checkboxes[1]?.checked ?? false,
    };

    let roots: HTMLElement[] = [];
    if (scope === 'current-section' && selectedSectionId) {
      const section = document.querySelector<HTMLElement>(`.omi-continuous-section[data-section-id="${cssEscape(selectedSectionId)}"]`);
      if (section) roots = [section];
    } else if (scope === 'body') {
      roots = Array.from(document.querySelectorAll<HTMLElement>('.omi-continuous-blocks'));
    } else {
      const manuscript = document.querySelector<HTMLElement>('.omi-manuscript-page');
      if (manuscript) roots = [manuscript];
    }

    const ranges: Range[] = [];
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest('.omi-search-replace')) return NodeFilter.FILTER_REJECT;
          if (parent.closest('script, style, textarea, input, select, button')) return NodeFilter.FILTER_REJECT;
          return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? '';
        for (const match of findTextMatchRanges(text, query, options)) {
          const range = document.createRange();
          range.setStart(node, match.start);
          range.setEnd(node, match.end);
          ranges.push(range);
        }
        node = walker.nextNode();
      }
    }

    if (ranges.length) registry.set(SEARCH_HIGHLIGHT_NAME, new HighlightCtor(...ranges));
  };

  const replaySearchEnter = (input: HTMLInputElement, shiftKey = false) => {
    window.setTimeout(() => {
      replayingEnter.current = true;
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
        shiftKey,
      }));
      replayingEnter.current = false;
      const searchPanel = input.closest('.omi-search-replace');
      if (searchPanel) window.setTimeout(() => highlightVisibleResults(searchPanel), 40);
    }, 0);
  };

  const submitEmptyObjectSearch = (searchPanel: Element) => {
    const input = searchPanel.querySelector<HTMLInputElement>('input');
    const scope = searchPanel.querySelector<HTMLSelectElement>('select');
    if (!input || !scope || input.value.trim() || !OBJECT_SCOPES.has(scope.value)) return;
    replaySearchEnter(input);
  };

  const switchMode = (nextMode: SearchMode) => {
    const key = nextMode === 'replace' ? 'h' : 'f';
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key,
      code: `Key${key.toUpperCase()}`,
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    }));
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const configure = () => {
      const searchPanel = root.querySelector<HTMLElement>('.omi-search-replace');
      setPanel((current) => current === searchPanel ? current : searchPanel);
      if (!searchPanel) {
        clearVisibleHighlights();
        return;
      }
      setMode(searchPanel.querySelector('.omi-search-replace__row--replace') ? 'replace' : 'find');
      const input = searchPanel.querySelector<HTMLInputElement>('input');
      if (!input) return;
      input.type = 'search';
      input.enterKeyHint = 'search';
      input.setAttribute('enterkeyhint', 'search');
      input.setAttribute('inputmode', 'search');
      input.autocomplete = 'off';
    };

    configure();
    const observer = new MutationObserver(configure);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearVisibleHighlights();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      style={{ display: 'contents' }}
      onFocusCapture={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const searchPanel = target.closest('.omi-search-replace');
        if (!searchPanel || searchPanel.querySelector('input') !== target) return;
        target.type = 'search';
        target.enterKeyHint = 'search';
        target.setAttribute('enterkeyhint', 'search');
        target.setAttribute('inputmode', 'search');
      }}
      onChangeCapture={(event) => {
        const target = event.target;
        const searchPanel = target instanceof Element ? target.closest('.omi-search-replace') : null;
        if (!searchPanel) return;

        if (target instanceof HTMLSelectElement) {
          clearVisibleHighlights();
          if (OBJECT_SCOPES.has(target.value)) window.setTimeout(() => submitEmptyObjectSearch(searchPanel), 0);
          return;
        }

        if (target instanceof HTMLInputElement && searchPanel.querySelector('input') === target) {
          clearVisibleHighlights();
          if (!target.value.trim()) window.setTimeout(() => submitEmptyObjectSearch(searchPanel), 0);
        }
      }}
      onKeyDownCapture={(event) => {
        if (replayingEnter.current) return;
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const searchPanel = target.closest('.omi-search-replace');
        if (!searchPanel || searchPanel.querySelector('input') !== target) return;

        const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
        const mobileTabAction = event.key === 'Tab' && coarsePointer && !event.shiftKey;
        if (event.key !== 'Enter' && !mobileTabAction) return;

        const shiftKey = event.shiftKey;
        event.preventDefault();
        event.stopPropagation();
        replaySearchEnter(target, shiftKey);
      }}
    >
      <SearchReplaceOverlayBase />
      {panel ? createPortal(
        <div className="omi-search-replace__mode-switch" aria-label={copy.modeLabel}>
          <button type="button" className={mode === 'find' ? 'is-active' : ''} aria-pressed={mode === 'find'} onClick={() => switchMode('find')}>
            <Search size={15} aria-hidden="true" />{copy.find}
          </button>
          <button type="button" className={mode === 'replace' ? 'is-active' : ''} aria-pressed={mode === 'replace'} onClick={() => switchMode('replace')}>
            <Replace size={15} aria-hidden="true" />{copy.replace}
          </button>
        </div>,
        panel,
      ) : null}
    </div>
  );
}

function getModeCopy(locale: string) {
  if (locale === 'hu') return { modeLabel: 'Keresési mód', find: 'Keresés', replace: 'Keresés és csere' };
  if (locale === 'de') return { modeLabel: 'Suchmodus', find: 'Suchen', replace: 'Suchen und Ersetzen' };
  return { modeLabel: 'Search mode', find: 'Find', replace: 'Find and replace' };
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
