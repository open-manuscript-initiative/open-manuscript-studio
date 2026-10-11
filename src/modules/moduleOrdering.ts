import { getModuleShellCopy } from './moduleShellTranslations';
import type { StudioModuleManifest } from './types';

/** Sort display labels, without changing registry IDs or persisted preferences. */
export function sortModulesForLocale<T extends StudioModuleManifest>(modules: readonly T[], locale: string): T[] {
  const copy = getModuleShellCopy(locale);
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const title = (module: T) => copy.modules[module.id]?.title ?? module.titleKey;
  return [...modules].sort((left, right) =>
    collator.compare(title(left), title(right)) || left.id.localeCompare(right.id));
}
