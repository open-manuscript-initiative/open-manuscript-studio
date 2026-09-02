import { createSectionHeadingBlock } from './atomicTextBlocks';
import {
  EMPTY_SECTION_CONTENT,
  getParentSectionId,
  getSectionDepth,
  withParentSectionId,
} from './sectionStructure';
import type { OmiStudyMetadata } from './studyMetadata';
import type { OmiAsset } from '../types/assets';
import type {
  OmiBlock,
  OmiManuscriptState,
  OmiSection,
} from '../types/omi';

export interface OmiStudyImportOptions {
  sourceFileName?: string;
  importedAt?: string;
  createId?: () => string;
}

export interface OmiStudyImportResult {
  state: OmiManuscriptState;
  rootSectionId: string;
  importedSections: OmiSection[];
  importedAgents: OmiManuscriptState['agents'];
  importedContributions: OmiManuscriptState['contributions'];
  idMap: ReadonlyMap<string, string>;
  assetIdMap: ReadonlyMap<string, string>;
}

interface ImportPayload {
  sections: OmiSection[];
  agents: OmiManuscriptState['agents'];
  contributions: OmiManuscriptState['contributions'];
  annotations: OmiManuscriptState['annotations'];
  bibliographicRecords: NonNullable<OmiManuscriptState['bibliographicRecords']>;
  citations: OmiManuscriptState['citations'];
  citationClusters: NonNullable<OmiManuscriptState['citationClusters']>;
  crossReferences: NonNullable<OmiManuscriptState['crossReferences']>;
  assets: OmiAsset[];
  namedAnchors: NonNullable<OmiManuscriptState['namedAnchors']>;
  indexDefinitions: NonNullable<OmiManuscriptState['indexDefinitions']>;
  indexEntries: NonNullable<OmiManuscriptState['indexEntries']>;
  generatedIndexes: NonNullable<OmiManuscriptState['generatedIndexes']>;
  semanticFields: NonNullable<OmiManuscriptState['semanticFields']>;
  computedFields: NonNullable<OmiManuscriptState['computedFields']>;
}

/**
 * Inserts one complete OMI document as one independently editable study.
 * Imported internal identities are re-keyed while external scholarly values
 * such as DOI, ORCID and ROR remain unchanged.
 */
export function mergeOmiDocumentAsStudy(
  volume: OmiManuscriptState,
  source: OmiManuscriptState,
  options: OmiStudyImportOptions = {},
): OmiStudyImportResult {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const usedIds = collectReservedIds(volume);
  const nextId = () => uniqueId(createId, usedIds);
  const rootSectionId = nextId();
  const payload = importPayload(source);
  const idMap = new Map<string, string>([[source.id, rootSectionId]]);

  collectDeclaredIds(payload).forEach((sourceId) => {
    if (!idMap.has(sourceId)) idMap.set(sourceId, nextId());
  });

  const remapped = remapPortableValue(payload, idMap);
  remapped.sections = remapped.sections.map((section) => ({
    ...section,
    blocks: remapStructuredBlockContent(section.blocks, idMap),
  }));
  const title = normalizedStudyTitle(source.title, options.sourceFileName);
  const root: OmiSection = {
    id: rootSectionId,
    title,
    blocks: [createSectionHeadingBlock(title, 1, nextId())],
    studyMetadata: studyMetadata(source, title, options),
  };

  if (remapped.sections.length === 0) {
    root.blocks.push({
      id: nextId(),
      type: 'paragraph',
      content: EMPTY_SECTION_CONTENT,
    });
  }

  const importedSectionIds = new Set(remapped.sections.map((section) => section.id));
  const nestedSections = remapped.sections.map((section) => {
    const parentId = getParentSectionId(section);
    return withParentSectionId(
      section,
      parentId && importedSectionIds.has(parentId) ? parentId : rootSectionId,
    );
  });
  const importedSections = normalizeImportedHeadingLevels([root, ...nestedSections]);
  const validContributionTargets = new Set([
    rootSectionId,
    ...importedSectionIds,
  ]);
  const importedContributions = remapped.contributions.filter(
    (contribution) => validContributionTargets.has(contribution.targetId),
  );
  const importedAgentIds = new Set([
    ...importedContributions.map((contribution) => contribution.agentId),
    ...remapped.annotations.flatMap((annotation) =>
      annotation.creatorAgentId ? [annotation.creatorAgentId] : [],
    ),
  ]);
  const importedAgents = remapped.agents.filter((agent) => importedAgentIds.has(agent.id));
  const assetIdMap = new Map<string, string>();
  for (const asset of source.assets ?? []) {
    const mapped = idMap.get(asset.id);
    if (mapped) assetIdMap.set(asset.id, mapped);
  }

  return {
    state: {
      ...volume,
      sections: [...volume.sections, ...importedSections],
      agents: [...volume.agents, ...importedAgents],
      contributions: [...volume.contributions, ...importedContributions],
      annotations: [...volume.annotations, ...remapped.annotations],
      bibliographicRecords: [
        ...(volume.bibliographicRecords ?? []),
        ...remapped.bibliographicRecords,
      ],
      citations: [...volume.citations, ...remapped.citations],
      citationClusters: [
        ...(volume.citationClusters ?? []),
        ...remapped.citationClusters,
      ],
      crossReferences: [
        ...(volume.crossReferences ?? []),
        ...remapped.crossReferences,
      ],
      assets: [...(volume.assets ?? []), ...remapped.assets],
      namedAnchors: [
        ...(volume.namedAnchors ?? []),
        ...remapped.namedAnchors,
      ],
      indexDefinitions: [
        ...(volume.indexDefinitions ?? []),
        ...remapped.indexDefinitions,
      ],
      indexEntries: [...(volume.indexEntries ?? []), ...remapped.indexEntries],
      generatedIndexes: [
        ...(volume.generatedIndexes ?? []),
        ...remapped.generatedIndexes,
      ],
      semanticFields: [
        ...(volume.semanticFields ?? []),
        ...retargetManuscriptSemanticFields(remapped.semanticFields, rootSectionId),
      ],
      computedFields: [
        ...(volume.computedFields ?? []),
        ...remapped.computedFields,
      ],
    },
    rootSectionId,
    importedSections,
    importedAgents,
    importedContributions,
    idMap,
    assetIdMap,
  };
}

function importPayload(source: OmiManuscriptState): ImportPayload {
  return {
    sections: source.sections,
    agents: source.agents,
    contributions: source.contributions,
    annotations: source.annotations,
    bibliographicRecords: source.bibliographicRecords ?? [],
    citations: source.citations ?? [],
    citationClusters: source.citationClusters ?? [],
    crossReferences: source.crossReferences ?? [],
    assets: source.assets ?? [],
    namedAnchors: source.namedAnchors ?? [],
    indexDefinitions: source.indexDefinitions ?? [],
    indexEntries: source.indexEntries ?? [],
    generatedIndexes: source.generatedIndexes ?? [],
    semanticFields: source.semanticFields ?? [],
    computedFields: source.computedFields ?? [],
  };
}

function studyMetadata(
  source: OmiManuscriptState,
  title: string,
  options: OmiStudyImportOptions,
): OmiStudyMetadata {
  return {
    modelVersion: '0.1.0-alpha.1',
    title,
    ...(source.subtitle?.trim() ? { subtitle: source.subtitle } : {}),
    ...(source.abstract?.trim() ? { abstract: source.abstract } : {}),
    keywords: [...(source.keywords ?? [])],
    locale: source.locale,
    ...(source.abstracts ? { abstracts: structuredClone(source.abstracts) } : {}),
    ...(source.keywordsByLocale
      ? { keywordsByLocale: structuredClone(source.keywordsByLocale) }
      : {}),
    ...(source.metadata
      ? { scholarlyMetadata: structuredClone(source.metadata) }
      : {}),
    source: {
      format: 'omi',
      manuscriptId: source.id,
      ...(options.sourceFileName ? { fileName: options.sourceFileName } : {}),
      importedAt: options.importedAt ?? new Date().toISOString(),
    },
  };
}

function normalizedStudyTitle(title: string, fileName?: string): string {
  const normalized = title.trim();
  if (normalized) return normalized;
  const fromFile = (fileName ?? '')
    .replace(/\.omi(?:\.json)?$/i, '')
    .replace(/\.json$/i, '')
    .trim();
  return fromFile || 'Untitled study';
}

function normalizeImportedHeadingLevels(sections: OmiSection[]): OmiSection[] {
  return sections.map((section) => {
    const first = section.blocks[0];
    if (!first || first.type !== 'heading') return section;
    const level = Math.max(1, Math.min(6, getSectionDepth(sections, section.id) + 1));
    return {
      ...section,
      blocks: [withHeadingLevel(first, level), ...section.blocks.slice(1)],
    };
  });
}

function withHeadingLevel(block: OmiBlock, level: number): OmiBlock {
  try {
    const document = JSON.parse(block.content) as {
      type?: string;
      content?: Array<Record<string, unknown>>;
    };
    if (document.type !== 'doc' || !Array.isArray(document.content)) return block;
    return {
      ...block,
      content: JSON.stringify({
        ...document,
        content: document.content.map((node) =>
          node.type === 'heading'
            ? { ...node, attrs: { ...(node.attrs as object | undefined), level } }
            : node,
        ),
      }),
    };
  } catch {
    return block;
  }
}

function retargetManuscriptSemanticFields(
  fields: NonNullable<OmiManuscriptState['semanticFields']>,
  rootSectionId: string,
): NonNullable<OmiManuscriptState['semanticFields']> {
  return fields.map((field) =>
    field.scope === 'section' && field.sectionId
      ? field
      : { ...field, scope: 'section', sectionId: rootSectionId },
  );
}

function collectReservedIds(volume: OmiManuscriptState): Set<string> {
  const ids = collectDeclaredIds(volume);
  ids.add(volume.id);
  for (const tombstone of volume.tombstones ?? []) ids.add(tombstone.objectId);
  return ids;
}

function collectDeclaredIds(value: unknown): Set<string> {
  const result = new Set<string>();
  walk(value, (key, item) => {
    if ((key === 'id' || key === 'anchorId') && typeof item === 'string' && item) {
      result.add(item);
    }
    if (key === 'content' && typeof item === 'string') {
      const structured = parsePortableJson(item);
      if (structured) {
        for (const id of collectDeclaredIds(structured)) result.add(id);
      }
    }
  });
  return result;
}

function walk(
  value: unknown,
  visitor: (key: string, value: unknown) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    visitor(key, item);
    walk(item, visitor);
  }
}

function remapPortableValue<T>(value: T, idMap: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') return (idMap.get(value) ?? value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => remapPortableValue(item, idMap)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      remapPortableValue(item, idMap),
    ]),
  ) as T;
}

function remapStructuredBlockContent(
  blocks: readonly OmiBlock[],
  idMap: ReadonlyMap<string, string>,
): OmiBlock[] {
  return blocks.map((block) => {
    const structured = parsePortableJson(block.content);
    return {
      ...block,
      content: structured
        ? JSON.stringify(remapPortableValue(structured, idMap))
        : block.content,
      ...(block.children
        ? { children: remapStructuredBlockContent(block.children, idMap) }
        : {}),
    };
  });
}

function parsePortableJson(value: string): unknown | undefined {
  const normalized = value.trim();
  if (!normalized.startsWith('{') && !normalized.startsWith('[')) return undefined;
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    return undefined;
  }
}

function uniqueId(createId: () => string, usedIds: Set<string>): string {
  let candidate = createId().trim();
  while (!candidate || usedIds.has(candidate)) candidate = createId().trim();
  usedIds.add(candidate);
  return candidate;
}
