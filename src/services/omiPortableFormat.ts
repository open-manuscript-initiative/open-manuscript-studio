import {
  OMI_FILE_FORMAT_PROFILES,
  OMI_FILE_FORMAT_SPECIFICATIONS,
  OMI_FILE_FORMAT_VERSION,
  OMI_MANUSCRIPT_SCHEMA_URI,
  type OmiManuscriptSchemaUri,
} from '../model/omiFormatConstants';
import type {
  OmiFileFormatEnvelope,
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';
export type { OmiFileFormatEnvelope } from '../types/omi';
import { validateOmiManuscriptSchema } from './omiSchemaValidation';

export type PortableOmiState = Omit<OmiManuscriptState, 'schema'> & {
  schema: OmiManuscriptSchemaUri;
  omi: OmiFileFormatEnvelope;
};

export type PortableOmiManuscript = Omit<OmiManuscript, 'schema'> & {
  schema: OmiManuscriptSchemaUri;
  omi: OmiFileFormatEnvelope;
};

export type OmiPortableFormatErrorCode =
  | 'invalid-json'
  | 'invalid-document'
  | 'unsupported-schema'
  | 'unsupported-version'
  | 'schema-validation'
  | 'duplicate-json-member';

export class OmiPortableFormatError extends Error {
  readonly code: OmiPortableFormatErrorCode;

  constructor(
    code: OmiPortableFormatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OmiPortableFormatError';
    this.code = code;
  }
}

export function createOmiFileFormatEnvelope(
  includeHistory = true,
): OmiFileFormatEnvelope {
  return {
    format: 'manuscript',
    version: OMI_FILE_FORMAT_VERSION,
    profiles: includeHistory
      ? [...OMI_FILE_FORMAT_PROFILES]
      : ['core-snapshot'],
    specifications: { ...OMI_FILE_FORMAT_SPECIFICATIONS },
  };
}

/**
 * Converts Studio's internal manuscript state into the canonical portable
 * OMI-SPEC-320@0.3.0 representation.
 *
 * Pre-0.3 standalone JSON is rejected and is not silently migrated. The
 * application release version and the portable file-format version are
 * independent values.
 */
export function toPortableOmiState(
  state: OmiManuscriptState,
): PortableOmiState {
  const portable = {
    ...state,
    schema: OMI_MANUSCRIPT_SCHEMA_URI,
    omi: createOmiFileFormatEnvelope(false),
    sourceAttributions: state.sourceAttributions ?? [],
    tombstones: (state.tombstones ?? []).map((tombstone) => ({
      ...tombstone,
      id: tombstoneId(tombstone),
    })),
  } as PortableOmiState & { authors?: unknown };

  // The legacy embedded-author representation is not part of the canonical
  // Studio 0.3 wire format.
  delete portable.authors;

  assertPortableOmiManuscript(portable);
  return portable;
}

export function toPortableOmiManuscript(
  manuscript: OmiManuscript,
): PortableOmiManuscript {
  const {
    omi: sourceEnvelope,
    versioningModelVersion,
    headRevisionId,
    revisionHistory,
    ...state
  } = manuscript;
  const portable = {
    ...toPortableOmiState(state),
    omi: mergeOmiFileFormatEnvelope(sourceEnvelope, true),
    versioningModelVersion,
    headRevisionId,
    revisionHistory: portableRevisionHistory(manuscript, revisionHistory),
  } as PortableOmiManuscript;

  assertPortableOmiManuscript(portable);
  return portable;
}

function mergeOmiFileFormatEnvelope(
  source: OmiFileFormatEnvelope | undefined,
  includeHistory: boolean,
): OmiFileFormatEnvelope {
  const canonical = createOmiFileFormatEnvelope(includeHistory);
  if (!source) return canonical;

  return {
    ...canonical,
    ...source,
    format: canonical.format,
    version: canonical.version,
    profiles: [...new Set([...source.profiles, ...canonical.profiles])],
    specifications: {
      ...canonical.specifications,
      ...source.specifications,
    },
  };
}

export function parseOmiJson(raw: string): OmiManuscript {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new OmiPortableFormatError(
      'invalid-json',
      'The selected file is not valid JSON.',
    );
  }

  const duplicateMemberPaths = findDuplicateJsonMemberKeys(raw);
  if (duplicateMemberPaths.length > 0) {
    throw new OmiPortableFormatError('duplicate-json-member', `Duplicate JSON member name at ${duplicateMemberPaths.join(', ')}.`);
  }
  validateJsonInteroperability(value);
  return parsePortableOmiManuscript(value);
}

/**
 * Accepts only the exact canonical file-format generation implemented by this
 * Studio build. Earlier experimental JSON layouts are not auto-migrated.
 */
export function parsePortableOmiState(value: unknown): OmiManuscriptState {
  assertPortableOmiManuscript(value);
  const record = value as PortableOmiState & Record<string, unknown>;
  const {
    omi: _omi,
    publicationSignatures: _publicationSignatures,
    versioningModelVersion: _versioningModelVersion,
    headRevisionId: _headRevisionId,
    revisionHistory: _revisionHistory,
    ...state
  } = record;

  return stripPortableTombstoneIds(state) as OmiManuscriptState;
}

export function parsePortableOmiManuscript(value: unknown): OmiManuscript {
  assertPortableOmiManuscript(value);
  const record = value as PortableOmiManuscript & Record<string, unknown>;

  if (
    !record.revisionHistory
    || !record.headRevisionId
    || !record.versioningModelVersion
    || !record.omi.profiles.includes('history-exchange')
  ) {
    throw new OmiPortableFormatError(
      'invalid-document',
      'Studio working manuscripts require the OMI history-exchange profile.',
    );
  }

  const {
    publicationSignatures: _publicationSignatures,
    ...manuscript
  } = record;
  return restoreHistoricalRevisionActors(
    stripPortableTombstoneIds(manuscript),
  ) as OmiManuscript;
}

export function assertPortableOmiManuscript(
  value: unknown,
): asserts value is PortableOmiManuscript {
  if (!isRecord(value)) {
    invalid('The OMI document root must be an object.');
  }

  if (value.schema !== OMI_MANUSCRIPT_SCHEMA_URI) {
    throw new OmiPortableFormatError(
      'unsupported-schema',
      `Unsupported OMI schema. Expected ${OMI_MANUSCRIPT_SCHEMA_URI}.`,
    );
  }

  const envelope = value.omi;
  if (!isRecord(envelope) || envelope.format !== 'manuscript') {
    invalid('The OMI format envelope is missing or invalid.');
  }
  if (envelope.version !== OMI_FILE_FORMAT_VERSION) {
    throw new OmiPortableFormatError(
      'unsupported-version',
      `Unsupported OMI file-format version. Expected ${OMI_FILE_FORMAT_VERSION}.`,
    );
  }

  const schemaErrors = validateOmiManuscriptSchema(value);
  if (schemaErrors.length > 0) {
    throw new OmiPortableFormatError('schema-validation', `The manuscript does not satisfy the canonical OMI-SPEC-320@0.3.0 schema: ${schemaErrors.join('; ')}`);
  }

  const profiles = envelope.profiles;
  if (
    !Array.isArray(profiles)
    || !profiles.every((profile) => typeof profile === 'string')
    || !profiles.includes('core-snapshot')
  ) {
    invalid('The OMI format envelope must declare the core-snapshot profile.');
  }
  if (
    value.revisionHistory !== undefined
    && !profiles.includes('history-exchange')
  ) {
    invalid('Documents carrying revisionHistory must declare history-exchange.');
  }

  const specifications = envelope.specifications;
  if (!isRecord(specifications)) {
    invalid('The OMI format envelope must declare specification versions.');
  }
  for (const required of ['OMI-SPEC-100', 'OMI-SPEC-120', 'OMI-SPEC-140']) {
    if (typeof specifications[required] !== 'string') {
      invalid(`The OMI format envelope is missing ${required}.`);
    }
  }
  if (
    profiles.includes('history-exchange')
    && typeof specifications['OMI-SPEC-160'] !== 'string'
  ) {
    invalid('history-exchange requires OMI-SPEC-160.');
  }

  requireNonEmptyString(value.id, 'id');
  requireNonEmptyString(value.locale, 'locale');
  if (
    typeof value.locale !== 'string'
    || value.locale.length > 255
    || !isWellFormedBcp47(value.locale)
  ) {
    invalid('/locale must be a well-formed BCP 47 language tag.');
  }
  requireNonEmptyString(value.title, 'title');
  requireTimestamp(value.createdAt, 'createdAt');
  requireTimestamp(value.updatedAt, 'updatedAt');

  if (Date.parse(value.updatedAt as string) < Date.parse(value.createdAt as string)) {
    invalid('updatedAt must not precede createdAt.');
  }

  if (!Array.isArray(value.sections)) {
    invalid('sections must be an array.');
  }
  validateAbsoluteAssetUris(value);

  const indexes = {
    all: new Map<string, string>(),
    blocks: new Map<string, string>(),
    agents: new Map<string, string>(),
    bibliographicRecords: new Map<string, string>(),
    citations: new Map<string, string>(),
    revisions: new Map<string, string>(),
  };

  addAddressable(value, '/', indexes.all);
  value.sections.forEach((section, index) =>
    validateSection(section, `/sections/${index}`, indexes),
  );

  for (const [collection, target] of [
    ['agents', indexes.agents],
    ['contributions', null],
    ['annotations', null],
    ['bibliographicRecords', indexes.bibliographicRecords],
    ['sourceAttributions', null],
    ['citations', indexes.citations],
    ['citationClusters', null],
    ['crossReferences', null],
    ['assets', null],
    ['publicationCorrections', null],
  ] as const) {
    const items = optionalArray(value[collection], collection);
    items.forEach((item, index) => {
      const path = `/${collection}/${index}`;
      addAddressable(item, path, indexes.all);
      if (target) addAddressable(item, path, target);
    });
  }

  for (const [index, relation] of optionalArray(value.sourceAttributions, 'sourceAttributions').entries()) {
    if (!isRecord(relation)) invalid(`/sourceAttributions/${index} must be an object.`);
    requireNonEmptyString(relation.sourceObjectId, `/sourceAttributions/${index}/sourceObjectId`);
    requireNonEmptyString(relation.targetBibliographicRecordId, `/sourceAttributions/${index}/targetBibliographicRecordId`);
    if (!indexes.all.has(String(relation.sourceObjectId))) invalid(`/sourceAttributions/${index} has an unresolved sourceObjectId.`);
    if (!indexes.bibliographicRecords.has(String(relation.targetBibliographicRecordId))) invalid(`/sourceAttributions/${index} has an unresolved bibliographic record.`);
  }

  validateTombstones(value.tombstones, indexes.all);
  validateReferences(value, indexes);
  validateHistory(value, indexes);
  rejectCredentialFields(value);
}

function validateSection(
  value: unknown,
  path: string,
  indexes: {
    all: Map<string, string>;
    blocks: Map<string, string>;
  },
): void {
  if (!isRecord(value)) invalid(`${path} must be an object.`);
  requireNonEmptyString(value.id, `${path}/id`);
  if (typeof value.title !== 'string') invalid(`${path}/title must be a string.`);
  if (value.language !== undefined) requireLanguageTag(value.language, `${path}/language`);
  if (!Array.isArray(value.blocks)) invalid(`${path}/blocks must be an array.`);
  addAddressable(value, path, indexes.all);

  if (value.layout !== undefined) {
    validateSectionLayout(value.layout, `${path}/layout`);
  }

  value.blocks.forEach((block, index) =>
    validateBlock(block, `${path}/blocks/${index}`, indexes),
  );
  optionalArray(value.children, `${path}/children`).forEach((child, index) =>
    validateSection(child, `${path}/children/${index}`, indexes),
  );
}

function validateSectionLayout(
  value: unknown,
  path: string,
): void {
  if (!isRecord(value)) invalid(`${path} must be an object.`);

  if (value.columns !== undefined) {
    const columns = Number(value.columns);
    if (!Number.isInteger(columns) || columns < 1 || columns > 3) {
      invalid(`${path}/columns must be 1, 2, or 3.`);
    }
  }

  if (value.columnGapMm !== undefined) {
    const gap = Number(value.columnGapMm);
    if (!Number.isFinite(gap) || gap < 0 || gap > 50) {
      invalid(`${path}/columnGapMm must be between 0 and 50 millimetres.`);
    }
  }

  if (value.tabStopsMm !== undefined) {
    if (!Array.isArray(value.tabStopsMm)) {
      invalid(`${path}/tabStopsMm must be an array.`);
    }
    let previous = 0;
    for (const [index, raw] of value.tabStopsMm.entries()) {
      const stop = Number(raw);
      if (!Number.isFinite(stop) || stop <= 0 || stop > 240) {
        invalid(`${path}/tabStopsMm/${index} must be between 0 and 240 millimetres.`);
      }
      if (stop <= previous) {
        invalid(`${path}/tabStopsMm must be strictly increasing.`);
      }
      previous = stop;
    }
  }
}

function validateBlock(
  value: unknown,
  path: string,
  indexes: {
    all: Map<string, string>;
    blocks: Map<string, string>;
  },
): void {
  if (!isRecord(value)) invalid(`${path} must be an object.`);
  requireNonEmptyString(value.id, `${path}/id`);
  requireNonEmptyString(value.type, `${path}/type`);
  if (value.language !== undefined) requireLanguageTag(value.language, `${path}/language`);
  addAddressable(value, path, indexes.all);
  addAddressable(value, path, indexes.blocks);
  optionalArray(value.children, `${path}/children`).forEach((child, index) =>
    validateBlock(child, `${path}/children/${index}`, indexes),
  );
}

function validateTombstones(
  value: unknown,
  all: Map<string, string>,
): void {
  optionalArray(value, 'tombstones').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/tombstones/${index} must be an object.`);
    requireNonEmptyString(item.id, `/tombstones/${index}/id`);
    addAddressable(item, `/tombstones/${index}`, all);
  });
}

function validateReferences(
  document: Record<string, unknown>,
  indexes: {
    all: Map<string, string>;
    blocks: Map<string, string>;
    agents: Map<string, string>;
    bibliographicRecords: Map<string, string>;
    citations: Map<string, string>;
  },
): void {
  optionalArray(document.contributions, 'contributions').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/contributions/${index} must be an object.`);
    requireReference(item.agentId, indexes.agents, `/contributions/${index}/agentId`);
  });

  optionalArray(document.annotations, 'annotations').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/annotations/${index} must be an object.`);
    requireReference(item.targetBlockId, indexes.blocks, `/annotations/${index}/targetBlockId`);
    if (item.creatorAgentId !== undefined) {
      requireReference(item.creatorAgentId, indexes.agents, `/annotations/${index}/creatorAgentId`);
    }
  });

  optionalArray(document.citations, 'citations').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/citations/${index} must be an object.`);
    requireReference(item.targetBlockId, indexes.blocks, `/citations/${index}/targetBlockId`);
    requireReference(item.target, indexes.bibliographicRecords, `/citations/${index}/target`);
  });

  optionalArray(
    document.bibliographyAdditionalRecordIds,
    'bibliographyAdditionalRecordIds',
  ).forEach((recordId, index) => {
    requireReference(
      recordId,
      indexes.bibliographicRecords,
      `/bibliographyAdditionalRecordIds/${index}`,
    );
  });

  optionalArray(document.citationClusters, 'citationClusters').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/citationClusters/${index} must be an object.`);
    requireReference(item.targetBlockId, indexes.blocks, `/citationClusters/${index}/targetBlockId`);
    optionalArray(item.citationIds, `/citationClusters/${index}/citationIds`).forEach(
      (citationId, citationIndex) =>
        requireReference(
          citationId,
          indexes.citations,
          `/citationClusters/${index}/citationIds/${citationIndex}`,
        ),
    );
  });

  optionalArray(document.crossReferences, 'crossReferences').forEach((item, index) => {
    if (!isRecord(item)) invalid(`/crossReferences/${index} must be an object.`);
    requireReference(item.sourceBlockId, indexes.blocks, `/crossReferences/${index}/sourceBlockId`);
    requireReference(item.targetId, indexes.all, `/crossReferences/${index}/targetId`);
  });
}

function validateHistory(
  document: Record<string, unknown>,
  indexes: {
    all: Map<string, string>;
    revisions: Map<string, string>;
    agents: Map<string, string>;
  },
): void {
  if (document.revisionHistory === undefined) return;
  const history = document.revisionHistory;
  if (!isRecord(history)) invalid('revisionHistory must be an object.');

  requireNonEmptyString(document.headRevisionId, 'headRevisionId');
  requireNonEmptyString(history.rootRevisionId, '/revisionHistory/rootRevisionId');
  requireNonEmptyString(history.headRevisionId, '/revisionHistory/headRevisionId');
  if (document.headRevisionId !== history.headRevisionId) {
    invalid('headRevisionId must match revisionHistory.headRevisionId.');
  }

  const revisions = optionalArray(history.revisions, '/revisionHistory/revisions');
  if (revisions.length === 0) invalid('revisionHistory.revisions must not be empty.');

  revisions.forEach((revision, index) => {
    const path = `/revisionHistory/revisions/${index}`;
    if (!isRecord(revision)) invalid(`${path} must be an object.`);
    requireNonEmptyString(revision.id, `${path}/id`);
    requireTimestamp(revision.createdAt, `${path}/createdAt`);
    if (!Array.isArray(revision.parentRevisionIds)) {
      invalid(`${path}/parentRevisionIds must be an array.`);
    }
    addAddressable(revision, path, indexes.all);
    addAddressable(revision, path, indexes.revisions);
  });

  requireReference(history.rootRevisionId, indexes.revisions, '/revisionHistory/rootRevisionId');
  requireReference(history.headRevisionId, indexes.revisions, '/revisionHistory/headRevisionId');

  revisions.forEach((revision, index) => {
    const record = revision as Record<string, unknown>;
    const completeness = history.completeness;
    optionalArray(record.parentRevisionIds, `/revisionHistory/revisions/${index}/parentRevisionIds`)
      .forEach((parentId, parentIndex) => {
        if (completeness === 'complete' || indexes.revisions.has(String(parentId))) {
          requireReference(
            parentId,
            indexes.revisions,
            `/revisionHistory/revisions/${index}/parentRevisionIds/${parentIndex}`,
          );
        }
      });
    if (record.actorAgentId !== undefined) {
      requireReference(
        record.actorAgentId,
        indexes.agents,
        `/revisionHistory/revisions/${index}/actorAgentId`,
      );
    }
  });

  if (
    history.completeness === 'shallow'
    && (typeof history.omissionNotice !== 'string' || !history.omissionNotice.trim())
  ) {
    invalid('Shallow history requires revisionHistory.omissionNotice.');
  }
}

function addAddressable(
  value: unknown,
  path: string,
  index: Map<string, string>,
): void {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) {
    invalid(`${path}/id must be a non-empty string.`);
  }
  if (index.has(value.id)) {
    invalid(`Duplicate OMI identifier at ${path}.`);
  }
  index.set(value.id, path);
}

function requireReference(
  value: unknown,
  index: Map<string, string>,
  path: string,
): void {
  if (typeof value !== 'string' || !index.has(value)) {
    invalid(`Unresolved OMI reference at ${path}.`);
  }
}

function validateJsonInteroperability(root: unknown): void {
  const pending: Array<{ value: unknown; path: string }> = [{ value: root, path: '/' }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const { value, path } = current;
    if (typeof value === 'string') {
      if (containsUnpairedSurrogate(value)) {
        invalid(`JSON string at ${path} contains an unpaired Unicode surrogate.`);
      }
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        invalid(`JSON number at ${path} is not finite.`);
      }
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
        invalid(`JSON integer at ${path} exceeds the safe integer range.`);
      }
      continue;
    }
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: value[index], path: `${path}${index}` });
      }
      continue;
    }
    if (!isRecord(value)) continue;
    for (const [key, child] of Object.entries(value)) {
      if (containsUnpairedSurrogate(key)) {
        invalid(`JSON object at ${path} contains an unpaired Unicode surrogate in a member name.`);
      }
      pending.push({
        value: child,
        path: `${path}${escapeJsonPointerToken(key)}/`,
      });
    }
  }
}

function containsUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function validateAbsoluteAssetUris(document: Record<string, unknown>): void {
  optionalArray(document.assets, 'assets').forEach((asset, index) => {
    if (!isRecord(asset) || typeof asset.uri !== 'string') return;
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(asset.uri)) {
      invalid(`/assets/${index}/uri must be an absolute URI.`);
    }
  });
}

function escapeJsonPointerToken(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function optionalArray(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalid(`${path} must be an array.`);
  return value;
}

function requireLanguageTag(value: unknown, path: string): void {
  if (typeof value !== 'string' || !isWellFormedBcp47(value)) {
    invalid(`${path} must be a well-formed BCP 47 language tag.`);
  }
}

function isWellFormedBcp47(tag: string): boolean {
  const grandfathered = new Set([
    'art-lojban', 'cel-gaulish', 'en-gb-oed', 'i-ami', 'i-bnn', 'i-default',
    'i-enochian', 'i-hak', 'i-klingon', 'i-lux', 'i-mingo', 'i-navajo',
    'i-pwn', 'i-tao', 'i-tay', 'i-tsu', 'no-bok', 'no-nyn', 'sgn-be-fr',
    'sgn-be-nl', 'sgn-ch-de', 'zh-guoyu', 'zh-hakka', 'zh-min',
    'zh-min-nan', 'zh-xiang',
  ]);
  const lower = tag.toLowerCase();
  if (grandfathered.has(lower)) return true;
  if (/^x(?:-[a-z0-9]{1,8})+$/iu.test(tag)) return true;

  const parts = tag.split('-');
  let index = 0;
  const language = parts[index++];
  if (!language || !/^[a-z]{2,8}$/iu.test(language)) return false;

  if (language.length <= 3) {
    let extlangs = 0;
    while (extlangs < 3 && /^[a-z]{3}$/iu.test(parts[index] ?? '')) {
      index += 1;
      extlangs += 1;
    }
  }
  if (/^[a-z]{4}$/iu.test(parts[index] ?? '')) index += 1;
  if (/^(?:[a-z]{2}|[0-9]{3})$/iu.test(parts[index] ?? '')) index += 1;

  const variants = new Set<string>();
  while (/^(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3})$/iu.test(parts[index] ?? '')) {
    const variant = (parts[index] ?? '').toLowerCase();
    if (variants.has(variant)) return false;
    variants.add(variant);
    index += 1;
  }
  const extensionSingletons = new Set<string>();
  while (/^[0-9a-wy-z]$/iu.test(parts[index] ?? '')) {
    const singleton = (parts[index] ?? '').toLowerCase();
    if (extensionSingletons.has(singleton)) return false;
    extensionSingletons.add(singleton);
    index += 1;
    let extensionSubtags = 0;
    while (/^[a-z0-9]{2,8}$/iu.test(parts[index] ?? '')) {
      index += 1;
      extensionSubtags += 1;
    }
    if (extensionSubtags === 0) return false;
  }
  if (/^x$/iu.test(parts[index] ?? '')) {
    index += 1;
    let privateSubtags = 0;
    while (/^[a-z0-9]{1,8}$/iu.test(parts[index] ?? '')) {
      index += 1;
      privateSubtags += 1;
    }
    if (privateSubtags === 0) return false;
  }
  return index === parts.length;
}

function requireNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(`${path} must be a non-empty string.`);
  }
}

function isValidRfc3339Timestamp(value: string): boolean {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})[Tt](\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d+)?([Zz]|[+-]\\d{2}:\\d{2})$/u.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  if (day < 1 || day > daysInMonth) return false;
  if (zone !== 'Z' && zone !== 'z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function requireTimestamp(value: unknown, path: string): void {
  requireNonEmptyString(value, path);
  if (typeof value !== 'string' || !isValidRfc3339Timestamp(value)) {
    invalid(`${path} must be an RFC 3339 timestamp with an explicit timezone.`);
  }
}

function rejectCredentialFields(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCredentialFields(item, `${path}/${index}`));
    return;
  }

  const forbidden = /^(?:password|accessToken|refreshToken|session(?:Token|Id|Identifier)|clientSecret|privateKey)$/i;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (forbidden.test(key)) {
      invalid(`Portable OMI documents must not contain credential field ${childPath}.`);
    }
    rejectCredentialFields(child, childPath);
  }
}

function portableRevisionHistory(
  manuscript: OmiManuscript,
  revisionHistory: OmiManuscript['revisionHistory'],
): OmiManuscript['revisionHistory'] & { omissionNotice?: string } {
  const activeAgentIds = new Set(manuscript.agents.map((agent) => agent.id));
  const revisions = revisionHistory.revisions.map((revision) => {
    if (
      revision.actorAgentId === undefined
      || activeAgentIds.has(revision.actorAgentId)
    ) {
      return revision;
    }

    // OMI-SPEC-320 requires revision.actorAgentId to resolve against the
    // portable root agent collection. Studio retains the same attribution in
    // the revision changeSet, so an actor deleted from current state can omit
    // this optional wire-level shortcut without losing history.
    const { actorAgentId: _unresolvedActorAgentId, ...portableRevision } =
      revision;
    return portableRevision;
  });

  return {
    ...revisionHistory,
    revisions,
    ...(revisionHistory.completeness === 'shallow'
      ? {
          omissionNotice:
            'Revision history is intentionally shallow in this Studio manuscript.',
        }
      : {}),
  };
}

function restoreHistoricalRevisionActors<T extends Record<string, unknown>>(
  value: T,
): T {
  if (!isRecord(value.revisionHistory)) return value;
  const history = value.revisionHistory;
  if (!Array.isArray(history.revisions)) return value;

  return {
    ...value,
    revisionHistory: {
      ...history,
      revisions: history.revisions.map((revision) => {
        if (!isRecord(revision) || revision.actorAgentId !== undefined) {
          return revision;
        }
        if (
          !isRecord(revision.changeSet)
          || typeof revision.changeSet.actorAgentId !== 'string'
        ) {
          return revision;
        }
        return {
          ...revision,
          actorAgentId: revision.changeSet.actorAgentId,
        };
      }),
    },
  } as T;
}

function stripPortableTombstoneIds<T extends Record<string, unknown>>(
  value: T,
): T {
  if (!Array.isArray(value.tombstones)) return value;

  return {
    ...value,
    tombstones: value.tombstones.map((tombstone) => {
      if (!isRecord(tombstone)) return tombstone;
      const { id: _wireId, ...internalTombstone } = tombstone;
      return internalTombstone;
    }),
  } as T;
}

function tombstoneId(tombstone: OmiManuscriptState['tombstones'][number]): string {
  return [
    'tombstone',
    tombstone.objectId,
    tombstone.deletionRevisionId,
    tombstone.deletingChangeEventId,
  ].join(':');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new OmiPortableFormatError('invalid-document', message);
}


/** Runs the version-pinned OMI-SPEC-320 fixture validator and returns stable diagnostic codes. */
export function validateOmiConformanceJson(source: string): string[] {
  if (findDuplicateJsonMemberKeys(source).length > 0) return ['FMT-DUPLICATE-JSON-MEMBER'];
  let value: unknown;
  try { value = JSON.parse(source); } catch { return ['FMT-INVALID-JSON']; }
  try { assertPortableOmiManuscript(value); return []; }
  catch (error) { return [toConformanceDiagnosticCode(error)]; }
}
function toConformanceDiagnosticCode(error: unknown): string {
  if (!(error instanceof OmiPortableFormatError)) return 'FMT-SCHEMA';
  if (error.code === 'invalid-json') return 'FMT-INVALID-JSON';
  if (error.code === 'duplicate-json-member') return 'FMT-DUPLICATE-JSON-MEMBER';
  if (['unsupported-schema','unsupported-version','schema-validation'].includes(error.code)) return 'FMT-SCHEMA';
  if (/Duplicate OMI identifier/u.test(error.message)) return 'FMT-DUPLICATE-ID';
  if (/unpaired Unicode surrogate/u.test(error.message)) return 'FMT-INVALID-UNICODE';
  if (/not finite/u.test(error.message)) return 'FMT-NONFINITE-NUMBER';
  if (/safe integer range/u.test(error.message)) return 'FMT-UNSAFE-INTEGER';
  if (/asset URI must be an absolute URI/u.test(error.message)) return 'FMT-URI';
  if (/Unresolved OMI reference/u.test(error.message)) return 'FMT-UNRESOLVED-REFERENCE';
  if (/updatedAt must not precede createdAt/u.test(error.message)) return 'FMT-TIMESTAMP-ORDER';
  if (/headRevisionId must match revisionHistory\.headRevisionId/u.test(error.message)) return 'FMT-HISTORY-HEAD-MISMATCH';
  if (/credential field/u.test(error.message)) return 'FMT-FORBIDDEN-SECRET';
  return 'FMT-SCHEMA';
}
/** Detect duplicate object member names before JSON.parse discards them. */
function findDuplicateJsonMemberKeys(source: string): string[] {
  const duplicates: string[] = [];
  let cursor = 0;
  function skipWhitespace(): void { while (cursor < source.length && /\s/u.test(source[cursor] ?? '')) cursor += 1; }
  function readString(): string {
    const start = cursor++;
    while (cursor < source.length) {
      if (source[cursor] === '\\') cursor += 2;
      else if (source[cursor] === '"') { cursor++; break; }
      else cursor++;
    }
    const token = source.slice(start, cursor);
    try { return JSON.parse(token) as string; } catch { return token.slice(1, -1); }
  }
  function visit(path: string): void {
    skipWhitespace(); const token = source[cursor];
    if (token === '{') {
      cursor++; skipWhitespace(); const names = new Set<string>();
      while (cursor < source.length && source[cursor] !== '}') {
        if (source[cursor] !== '"') return;
        const name = readString(), memberPath = `${path}/${name.replaceAll('~','~0').replaceAll('/','~1')}`;
        if (names.has(name)) duplicates.push(memberPath);
        names.add(name); skipWhitespace(); if (source[cursor] !== ':') return;
        cursor++; visit(memberPath); skipWhitespace();
        if (source[cursor] === ',') { cursor++; skipWhitespace(); } else break;
      }
      if (source[cursor] === '}') cursor++;
      return;
    }
    if (token === '[') {
      cursor++; skipWhitespace(); let index=0;
      while (cursor < source.length && source[cursor] !== ']') {
        visit(`${path}/${index++}`); skipWhitespace();
        if (source[cursor] === ',') { cursor++; skipWhitespace(); } else break;
      }
      if (source[cursor] === ']') cursor++;
      return;
    }
    if (token === '"') { readString(); return; }
    while (cursor < source.length && !/[\s,}\]]/u.test(source[cursor] ?? '')) cursor++;
  }
  visit('');
  return duplicates;
}
