import { createContext, useSyncExternalStore } from 'react';
import { isMobileStudio } from '../mobile/platform/platform';

export const PublicationPreviewContext = createContext(false);

const query = '(max-width: 720px)';
function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

export function usePublicationPreview(): boolean {
  return useSyncExternalStore(subscribe, () => isMobileStudio() || window.matchMedia(query).matches, () => false);
}
