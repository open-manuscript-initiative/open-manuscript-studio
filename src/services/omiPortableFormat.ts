import {
  OMI_FILE_FORMAT_PROFILES,
  OMI_FILE_FORMAT_SPECIFICATIONS,
  OMI_FILE_FORMAT_VERSION,
  OMI_MANUSCRIPT_SCHEMA_URI,
  type OmiManuscriptSchemaUri,
} from '../model/omiFormatConstants';
import type { OmiManuscript } from '../types/omi';

export interface OmiFileFormatEnvelope {
  format: 'manuscript';
  version: typeof OMI_FILE_FORMAT_VERSION;
  profiles: string[];
  specifications: Record<string, string>;
}

export type PortableOmiManuscript = Omit<OmiManuscript, 'schema'> & {
  schema: OmiManuscriptSchemaUri;
  omi: OmiFileFormatEnvelope;
};

export type OmiPortableFormatErrorCode =
  | 'invalid-json'
  | 'invalid-document'
  | 'unsupported-schema'
  | 'unsupported-version';

export class OmiPortableFormatError extends Error {
  constructor(
    public readonly code: OmiPortableFormatErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OmiPortableFormatError';
  }
}

export function createOmiFileFormatEnvelope(): OmiFileFormatEnvelope {
  return {
    format: 'manuscript',
    version: OMI_FILE_FORMAT_VERSION,
    profiles: [...OMI_FILE_FORMAT_PROFILES],
    specifications: { ...OMI_FILE_FORMAT_SPECIFICATIONS },
  };
}

/**
 * Converts Studio's internal manuscript state into the canonical portable
 * OMI-SPEC-320@0.2.0 representation.
 *
 * Pre-0.2 standalone JSON is intentionally not emitted or migrated. The
 * application release version and the portable file-format version are
 * independent values.
 */
export function toPortableOmiManuscript(
  manuscript: OmiManuscript,
): PortableOmiManuscript {
  const portable = {
    ...manuscript,
    schema: OMI_MANUSCRIPT_SCHEMA_URI,
    omi: createOmiFileFormatEnvelope(),
    tombstones: manuscript.tombstones.map((tombstone) => ({
      id: tombstoneId(tombstone),
      ...tombstone,
    })),
    revisionHistory: {
      ...manuscript.revisionHistory,
      ...(manuscript.revisionHistory.completeness === 'shallow'
        ? {
            omissionNotice:
              'Revision history is intentionally shallow in this Studio manuscript.',
          }
        : {}),
    },
  } as PortableOmiManuscript & { authors?: unknown };

  // The legacy embedded-author representation is not part of the canonical
  // Studio 0.2 wire format.
  delete portable.authors;

  assertPortableOmiManuscript(portable);
  return portable;
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

  return parsePortableOmiManuscript(value);
}

/**
 * Accepts only the exact canonical file-format generation implemented by this
 * Studio build. Earlier experimental JSON layouts are not auto-migrated.
 */
export function parsePortableOmiManuscript(value: unknown): OmiManuscript {
  assertPortableOmiManuscript(value);
  const record = value as PortableOmiManuscript & Record<string, unknown>;
  const { omi: _omi, publicationSignatures: _publicationSignatures, ...manuscript } = record;

  return manuscript as OmiManuscript;
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
  requireNonEmptyString(value.title, 'title');
  requireTimestamp(value.createdAt, 'createdAt');
  requireTimestamp(value.updatedAt, 'updatedAt');

  if (Date.parse(value.updatedAt as string) < Date.parse(value.createdAt as string)) {
    invalid('updatedAt must not precede createdAt.');
  }

  if (!Array.isArray(value.sections)) {
    invalid('sections must be an array.');
  }

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
  if (!Array.isArray(value.blocks)) invalid(`${path}/blocks must be an array.`);
  addAddressable(value, path, indexes.all);

  value.blocks.forEach((block, index) =>
    validateBlock(block, `${path}/blocks/${index}`, indexes),
  );
  optionalArray(value.children, `${path}/children`).forEach((child, index) =>
    validateSection(child, `${path}/children/${index}`, indexes),
  );
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
  indexes: { revisions: Map<string, string>; agents: Map<string, string> },
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
    invalid(`Duplicate OMI identifier ${value.id} at ${path}.`);
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

function optionalArray(value: unknown, path: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalid(`${path} must be an array.`);
  return value;
}

function requireNonEmptyString(value: unknown, path: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(`${path} must be a non-empty string.`);
  }
}

function requireTimestamp(value: unknown, path: string): void {
  requireNonEmptyString(value, path);
  if (Number.isNaN(Date.parse(value as string))) {
    invalid(`${path} must be an RFC 3339 timestamp.`);
  }
}

function rejectCredentialFields(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectCredentialFields(item, `${path}/${index}`));
    return;
  }

  const forbidden = /^(?:password|accessToken|refreshToken|sessionToken|clientSecret|privateKey)$/i;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    if (forbidden.test(key)) {
      invalid(`Portable OMI documents must not contain credential field ${childPath}.`);
    }
    rejectCredentialFields(child, childPath);
  }
}

function tombstoneId(tombstone: OmiManuscript['tombstones'][number]): string {
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
