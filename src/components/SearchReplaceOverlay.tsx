import { useEffect, useRef } from 'react';

import { SearchReplaceOverlay as SearchReplaceOverlayBase } from './SearchReplaceOverlayBase';

const OBJECT_SCOPES = new Set(['visuals', 'images', 'tables', 'charts', 'equations']);

/**
 * Normalizes the primary manuscript-search field for mobile IMEs.
 * Android WebView may otherwise expose the action key as "Next"/Tab instead
 * of a search/Enter action when several focusable controls are present.
 */
export function SearchReplaceOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const replayingEnter = useRef(false);

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
    }, 0);
  };

  const submitEmptyObjectSearch = (searchPanel: Element) => {
    const input = searchPanel.querySelector<HTMLInputElement>('input');
    const scope = searchPanel.querySelector<HTMLSelectElement>('select');
    if (!input || !scope || input.value.trim() || !OBJECT_SCOPES.has(scope.value)) return;
    replaySearchEnter(input);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const configureSearchInput = () => {
      const input = root.querySelector<HTMLInputElement>('.omi-search-replace input');
      if (!input) return;
      input.type = 'search';
      input.enterKeyHint = 'search';
      input.setAttribute('enterkeyhint', 'search');
      input.setAttribute('inputmode', 'search');
      input.autocomplete = 'off';
    };

    configureSearchInput();
    const observer = new MutationObserver(configureSearchInput);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
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
          if (!OBJECT_SCOPES.has(target.value)) return;
          window.setTimeout(() => submitEmptyObjectSearch(searchPanel), 0);
          return;
        }

        if (target instanceof HTMLInputElement && searchPanel.querySelector('input') === target && !target.value.trim()) {
          window.setTimeout(() => submitEmptyObjectSearch(searchPanel), 0);
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
    </div>
  );
}
