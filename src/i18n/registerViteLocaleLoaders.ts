import { registerTranslationDictionaryLoaders } from './config';
import type { TranslationDictionary } from './types';

// Vite rewrites this glob to imports of emitted JavaScript chunks. Keeping the
// glob in the browser entry avoids leaking source JSON URLs into production
// while allowing Node tests to register native JSON loaders independently.
const localeLoaders = import.meta.glob<TranslationDictionary>(
  './locales/*/studio.json',
  { import: 'default' },
);

registerTranslationDictionaryLoaders(localeLoaders);
