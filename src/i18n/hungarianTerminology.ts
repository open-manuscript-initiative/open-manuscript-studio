import { getAccountDeletionCopy } from './accountDeletionTranslations';
import { getCentralAdministrationCopy } from './centralAdministrationTranslations';
import { getCloudOAuthCopy } from './cloudOAuthTranslations';
import { getCloudStorageCopy } from './cloudStorageTranslations';
import { getInstitutionalProfilesCopy } from './institutionalProfilesTranslations';
import { getLinkedIdentitiesCopy } from './linkedIdentitiesTranslations';

const STUDIO_TERM = /\bStudio\b/g;

function normalizeValue(value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      if (typeof item === 'string') {
        value[index] = item.replace(STUDIO_TERM, 'Stúdió');
      } else {
        normalizeValue(item);
      }
    }
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') {
      (value as Record<string, unknown>)[key] = item.replace(STUDIO_TERM, 'Stúdió');
    } else {
      normalizeValue(item);
    }
  }
}

/**
 * Legacy translation modules return mutable locale objects directly instead of
 * resolving every label through translate(). Normalize the Hungarian copy once
 * at module startup so those older surfaces follow the same terminology rule.
 */
export function normalizeLegacyHungarianTerminology(): void {
  const copies: unknown[] = [
    getAccountDeletionCopy('hu'),
    getCentralAdministrationCopy('hu'),
    getCloudOAuthCopy('hu'),
    getCloudStorageCopy('hu'),
    getInstitutionalProfilesCopy('hu'),
    getLinkedIdentitiesCopy('hu'),
  ];

  for (const copy of copies) normalizeValue(copy);
}
