import { createContext } from 'react';

export type PublicationGraphicsMode = 'full' | 'simplified' | 'outlines' | 'screen';

export interface PublicationViewOptions {
  graphicsMode: PublicationGraphicsMode;
  showMarginBoundaries: boolean;
  showAlignmentGuides: boolean;
}

export const PUBLICATION_VIEW_OPTIONS_KEY = 'omi:publication-view-options:v1';

// This is a display-only setting, never part of the manuscript or publication style.
export const DEFAULT_PUBLICATION_VIEW_OPTIONS: PublicationViewOptions = {
  graphicsMode: 'simplified',
  showMarginBoundaries: false,
  showAlignmentGuides: false,
};

export const PublicationGraphicsContext = createContext<PublicationGraphicsMode>('full');

export function readPublicationViewOptions(): PublicationViewOptions {
  if (typeof window === 'undefined') return { ...DEFAULT_PUBLICATION_VIEW_OPTIONS };
  try {
    const raw = window.localStorage.getItem(PUBLICATION_VIEW_OPTIONS_KEY);
    if (!raw) return { ...DEFAULT_PUBLICATION_VIEW_OPTIONS };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { ...DEFAULT_PUBLICATION_VIEW_OPTIONS };
    const options = value as Partial<PublicationViewOptions>;
    return {
      graphicsMode: options.graphicsMode === 'full' || options.graphicsMode === 'simplified' || options.graphicsMode === 'outlines'
        ? options.graphicsMode : DEFAULT_PUBLICATION_VIEW_OPTIONS.graphicsMode,
      showMarginBoundaries: options.showMarginBoundaries === true,
      showAlignmentGuides: options.showAlignmentGuides === true,
    };
  } catch {
    return { ...DEFAULT_PUBLICATION_VIEW_OPTIONS };
  }
}

export function savePublicationViewOptions(options: PublicationViewOptions): void {
  try {
    window.localStorage.setItem(PUBLICATION_VIEW_OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Preferences are local and optional; never block editing.
  }
}
