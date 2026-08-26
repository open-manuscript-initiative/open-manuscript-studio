import { useRef } from 'react';

import { SearchReplaceOverlay as SearchReplaceOverlayBase } from './SearchReplaceOverlayBase';

/**
 * Defers Enter handling by one task so mobile IMEs can commit the final input
 * event before the search component snapshots the query.
 */
export function SearchReplaceOverlay() {
  const replayingEnter = useRef(false);

  return (
    <div
      style={{ display: 'contents' }}
      onKeyDownCapture={(event) => {
        if (replayingEnter.current || event.key !== 'Enter') return;

        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;

        const searchPanel = target.closest('.omi-search-replace');
        if (!searchPanel || searchPanel.querySelector('input') !== target) return;

        const shiftKey = event.shiftKey;
        event.preventDefault();
        event.stopPropagation();

        window.setTimeout(() => {
          replayingEnter.current = true;
          target.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true,
            shiftKey,
          }));
          replayingEnter.current = false;
        }, 0);
      }}
    >
      <SearchReplaceOverlayBase />
    </div>
  );
}
