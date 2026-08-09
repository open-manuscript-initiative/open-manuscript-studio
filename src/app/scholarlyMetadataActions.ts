import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type {
  OmiLocalizedTerms,
  OmiLocalizedText,
  OmiScholarlyMetadata,
} from '../model/scholarlyMetadata';
import { useStudioStore } from './useStudioStore';

const CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

type LocalizedTextKey =
  | 'coverage'
  | 'rights'
  | 'source'
  | 'type'
  | 'dataAvailability'
  | 'languages'
  | 'copyrightHolder';

type LocalizedTermsKey =
  | 'subjects'
  | 'disciplines'
  | 'supportingAgencies';

export function setScholarlyLocalizedText(
  key: LocalizedTextKey,
  locale: string,
  value: string,
): void {
  updateMetadata(key, (metadata) => {
    const field = { ...((metadata[key] as OmiLocalizedText | undefined) ?? {}) };
    if (value.trim()) field[locale] = value;
    else delete field[locale];
    return { ...metadata, [key]: field };
  });
}

export function setScholarlyLocalizedTerms(
  key: LocalizedTermsKey,
  locale: string,
  terms: string[],
): void {
  const normalized = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  updateMetadata(key, (metadata) => {
    const field = { ...((metadata[key] as OmiLocalizedTerms | undefined) ?? {}) };
    if (normalized.length) field[locale] = normalized;
    else delete field[locale];
    return { ...metadata, [key]: field };
  });
}

export function setScholarlyScalar(
  key: 'publisherId' | 'licenseUrl' | 'copyrightYear',
  value: string,
): void {
  updateMetadata(key, (metadata) => {
    const next = { ...metadata };
    if (key === 'copyrightYear') {
      const year = Number.parseInt(value, 10);
      if (Number.isFinite(year) && year > 0) next.copyrightYear = year;
      else delete next.copyrightYear;
    } else if (value.trim()) {
      next[key] = value.trim();
    } else {
      delete next[key];
    }
    return next;
  });
}

export function setOjsOpenScienceField(
  key: 'openData' | 'openMaterials' | 'preregistered' | 'preregisteredPlus',
  locale: string,
  value: string,
): void {
  useStudioStore.setState((state) => {
    const previous = state.manuscript.extensions?.['org.pkp.ojs']?.openScience?.[key]?.[locale] ?? '';
    if (previous === value) return state;
    const timestamp = new Date().toISOString();
    const extensions = {
      ...(state.manuscript.extensions ?? {}),
      'org.pkp.ojs': {
        ...(state.manuscript.extensions?.['org.pkp.ojs'] ?? {}),
        openScience: {
          ...(state.manuscript.extensions?.['org.pkp.ojs']?.openScience ?? {}),
          [key]: {
            ...(state.manuscript.extensions?.['org.pkp.ojs']?.openScience?.[key] ?? {}),
            [locale]: value,
          },
        },
      },
    };
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(state.pendingChangeSet, {
      baseRevisionId: state.manuscript.headRevisionId,
      summary: `Changed OJS Open Science metadata: ${key}`,
      events: [{
        operation: 'manuscript.abstract.set' as never,
        targetId: state.manuscript.id,
        path: `/extensions/org.pkp.ojs/openScience/${key}/${locale}`,
        previousValue: previous,
        nextValue: value,
      }],
      timestamp,
    });
    scheduleCheckpoint();
    return {
      manuscript: { ...state.manuscript, ...portableState, extensions, updatedAt: timestamp },
      pendingChangeSet,
    };
  });
}

function updateMetadata(
  key: string,
  updater: (metadata: OmiScholarlyMetadata) => OmiScholarlyMetadata,
): void {
  useStudioStore.setState((state) => {
    const previousMetadata = state.manuscript.metadata ?? {};
    const nextMetadata = updater(previousMetadata);
    if (JSON.stringify(previousMetadata) === JSON.stringify(nextMetadata)) return state;
    const timestamp = new Date().toISOString();
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(state.pendingChangeSet, {
      baseRevisionId: state.manuscript.headRevisionId,
      summary: `Changed scholarly metadata: ${key}`,
      events: [{
        operation: 'manuscript.abstract.set' as never,
        targetId: state.manuscript.id,
        path: `/metadata/${key}`,
        previousValue: previousMetadata[key as keyof OmiScholarlyMetadata],
        nextValue: nextMetadata[key as keyof OmiScholarlyMetadata],
      }],
      timestamp,
    });
    scheduleCheckpoint();
    return {
      manuscript: { ...state.manuscript, ...portableState, metadata: nextMetadata, updatedAt: timestamp },
      pendingChangeSet,
    };
  });
}

function scheduleCheckpoint(): void {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => {
    checkpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CHECKPOINT_DELAY_MS);
}
