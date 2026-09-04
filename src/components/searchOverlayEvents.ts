export const SEARCH_OVERLAY_TOGGLE_EVENT = 'omi:search-overlay-toggle';
export const SEARCH_OVERLAY_STATE_EVENT = 'omi:search-overlay-state';

interface SearchOverlayStateDetail {
  open: boolean;
}

export function toggleSearchOverlay(): void {
  window.dispatchEvent(new Event(SEARCH_OVERLAY_TOGGLE_EVENT));
}

export function announceSearchOverlayState(open: boolean): void {
  window.dispatchEvent(new CustomEvent<SearchOverlayStateDetail>(
    SEARCH_OVERLAY_STATE_EVENT,
    { detail: { open } },
  ));
}

export function subscribeSearchOverlayState(
  listener: (open: boolean) => void,
): () => void {
  const handleState = (event: Event) => {
    listener((event as CustomEvent<SearchOverlayStateDetail>).detail.open);
  };

  window.addEventListener(SEARCH_OVERLAY_STATE_EVENT, handleState);
  return () => window.removeEventListener(SEARCH_OVERLAY_STATE_EVENT, handleState);
}

export function getCloseSearchLabel(locale: string): string {
  if (locale === 'hu') return 'Keresés bezárása';
  if (locale === 'de') return 'Suche schließen';
  return 'Close search';
}
