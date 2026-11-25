import {
  createCitationOccurrence,
  createStableCitationId,
} from './citations.ts';
import {
  DEFAULT_CITATION_STYLE,
  renderCitationCluster,
} from './cslRendering.ts';
import type {
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationCluster,
  OmiCitationLocator,
  OmiCitationStyleId,
  OmiSection,
} from '../types/omi.ts';
import { cellNestedTable, tableCellDocument, tableCellPlainText, tableMergeLayout, parseTableCellContent } from './tableLayout';
import type { OmiTableBlockData } from '../types/omi';
import type { NoteJsonNode } from './noteRichText';
import { mapManuscriptBlocks, walkManuscriptStructure } from './manuscriptTreeTraversal';

export interface CitationClusterItemInput {
  target: string;
  locator?: OmiCitationLocator;
  prefix?: string;
  suffix?: string;
  intent?: string;
}

export interface CitationClusterCreation {
  cluster: OmiCitationCluster;
  citations: OmiCitation[];
}

export interface CitationAnchorReference {
  citationId: string;
  citationIds: string[];
  clusterId?: string;
  anchorId: string;
  targetBlockId: string;
}

export function createCitationCluster(
  items: readonly CitationClusterItemInput[],
  targetBlockId: string,
  timestamp = new Date().toISOString(),
): CitationClusterCreation {
  if (items.length === 0) {
    throw new Error('A citation cluster must contain at least one citation.');
  }

  const clusterId = createStableClusterId();
  const anchorId = createStableCitationId('anchor');
  const citations = items.map((item) => ({
    ...createCitationOccurrence(
      {
        target: item.target,
        targetBlockId,
        anchorId,
        locator: item.locator,
        prefix: item.prefix,
        suffix: item.suffix,
        intent: item.intent,
      },
      timestamp,
    ),
    clusterId,
  }));

  return {
    cluster: {
      id: clusterId,
      anchorId,
      targetBlockId,
      citationIds: citations.map((citation) => citation.id),
      createdAt: timestamp,
      modifiedAt: timestamp,
    },
    citations,
  };
}

export function collectCitationAnchors(
  sections: readonly OmiSection[],
): CitationAnchorReference[] {
  const anchors: CitationAnchorReference[] = [];

  for (const occurrence of walkManuscriptStructure(sections)) {
    if (occurrence.kind !== 'block') continue;
    const { block } = occurrence;
    const visit=(node:JsonNode)=>{
      if (node.type !== 'omiCitation' || !isRecord(node.attrs)) return;
      const citationIds = citationIdsFromAttributes(node.attrs);
      const anchorId = stringValue(node.attrs.anchorId);
      const clusterId = stringValue(node.attrs.clusterId);
      if (citationIds.length === 0 || !anchorId) return;
      for (const citationId of citationIds) {
        anchors.push({ citationId, citationIds, clusterId, anchorId, targetBlockId: block.id });
      }
    };
    walkStructuredContent(block.content,visit);
    if(block.visual?.kind==='table')walkTableNodes(block.visual,visit);
  }

  return anchors;
}

/**
 * Removes one citation occurrence from its inline marker. If the occurrence is
 * the final member of that marker, the marker itself disappears. Otherwise the
 * marker remains and carries the surviving citation IDs in their existing
 * order.
 */
export function removeCitationFromSections(
  sections: readonly OmiSection[],
  citationId: string,
): OmiSection[] {
  return mapManuscriptBlocks(sections, (block) => {
    return transformCitationBlock(block, (node) => {
      if (node.type !== 'omiCitation' || !isRecord(node.attrs)) return node;
      const citationIds = citationIdsFromAttributes(node.attrs);
      if (!citationIds.includes(citationId)) return node;
      const remaining = citationIds.filter((candidate) => candidate !== citationId);
      if (remaining.length === 0) return null;
      return {
        ...node,
        attrs: { ...node.attrs, citationId: remaining[0], citationIds: remaining },
      };
    });
  });
}

export function removeCitationClusterFromSections(
  sections: readonly OmiSection[],
  clusterId: string,
): OmiSection[] {
  return mapManuscriptBlocks(sections, (block) => {
    return transformCitationBlock(block, (node) => {
      if (node.type === 'omiCitation' && isRecord(node.attrs) &&
          stringValue(node.attrs.clusterId) === clusterId) return null;
      return node;
    });
  });
}

/**
 * Synchronizes only derived inline display labels and anchor membership.
 * Bibliographic metadata, locators and cluster order stay in semantic objects.
 */
export function synchronizeCitationLabels(
  sections: readonly OmiSection[],
  citations: readonly OmiCitation[],
  records: readonly OmiBibliographicRecord[],
  clusters: readonly OmiCitationCluster[] = [],
  style: OmiCitationStyleId = DEFAULT_CITATION_STYLE,
  locale = 'en',
): OmiSection[] {
  const citationMap = new Map(citations.map((citation) => [citation.id, citation]));
  const clusterMap = new Map(clusters.map((cluster) => [cluster.id, cluster]));

  return mapManuscriptBlocks(sections, (block) => {
    return transformCitationBlock(block, (node) => {
        if (node.type !== 'omiCitation' || !isRecord(node.attrs)) {
          return node;
        }

        const inlineIds = citationIdsFromAttributes(node.attrs);
        const clusterId = stringValue(node.attrs.clusterId);
        const cluster = clusterId ? clusterMap.get(clusterId) : undefined;
        const orderedIds = cluster?.citationIds.length
          ? cluster.citationIds
          : inlineIds;
        const clusterCitations = orderedIds
          .map((citationId) => citationMap.get(citationId))
          .filter((citation): citation is OmiCitation => Boolean(citation));

        if (clusterCitations.length === 0) {
          return node;
        }

        const anchorId = cluster?.anchorId || clusterCitations[0]!.anchorId;
        const resolvedClusterId = cluster?.id || clusterCitations[0]!.clusterId;

        return {
          ...node,
          attrs: {
            ...node.attrs,
            citationId: clusterCitations[0]!.id,
            citationIds: clusterCitations.map((citation) => citation.id),
            clusterId: resolvedClusterId,
            anchorId,
            label: renderCitationCluster(
              clusterCitations,
              records,
              style,
              locale,
            ),
          },
        };
      });
  });
}

export function citationIdsFromAttributes(
  attributes: Record<string, unknown>,
): string[] {
  const raw = attributes.citationIds;

  if (Array.isArray(raw)) {
    return uniqueStrings(raw);
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const values = uniqueStrings(parsed);
        if (values.length) return values;
      }
    } catch {
      const values = raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length) return [...new Set(values)];
    }
  }

  const legacyId = stringValue(attributes.citationId);
  return legacyId ? [legacyId] : [];
}

function createStableClusterId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `cluster-${crypto.randomUUID()}`;
  }

  return `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueStrings(values: readonly unknown[]): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

type JsonNode = {
  type?: string;
  attrs?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

function walkStructuredContent(
  content: string,
  visitor: (node: JsonNode) => void,
): void {
  const root = parseStructuredContent(content);

  if (!root) return;
  walkNode(root, visitor);
}

function walkNode(node: JsonNode, visitor: (node: JsonNode) => void): void {
  visitor(node);
  if(node.type==='omiCellTable'){
    const nested=cellNestedTable(node as NoteJsonNode);
    if(nested)walkTableNodes(nested,visitor);
  }
  if (!Array.isArray(node.content)) return;

  for (const child of node.content) {
    if (isRecord(child)) {
      walkNode(child as JsonNode, visitor);
    }
  }
}

function transformStructuredContent(
  content: string,
  transform: (node: JsonNode) => JsonNode | null,
): string {
  const root = parseStructuredContent(content);
  if (!root) return content;

  const transformed = transformNode(root, transform);
  return transformed ? JSON.stringify(transformed) : content;
}

function transformNode(
  node: JsonNode,
  transform: (node: JsonNode) => JsonNode | null,
): JsonNode | null {
  const transformed = transform(node);
  if (!transformed) return null;
  if(transformed.type==='omiCellTable'){
    const nested=cellNestedTable(transformed as NoteJsonNode);
    if(nested){const next=transformTable(nested,transform);return next===nested?transformed:{...transformed,attrs:{table:next}};}
  }
  if (!Array.isArray(transformed.content)) return transformed;

  return {
    ...transformed,
    content: transformed.content
      .map((child) =>
        isRecord(child) ? transformNode(child as JsonNode, transform) : child,
      )
      .filter((child) => child !== null),
  };
}

function parseStructuredContent(content: string): JsonNode | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? (parsed as JsonNode) : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function walkTableNodes(table:OmiTableBlockData,visitor:(node:JsonNode)=>void):void{
  const layout=tableMergeLayout(table.cells,table.cellMerges,table.headerRows);
  for(let r=0;r<table.cells.length;r++)for(let c=0;c<(table.cells[r]?.length??0);c++){
    if(layout.covered(r,c))continue;
    const doc=tableCellDocument(table,r,c);
    if(doc)walkNode(doc as JsonNode,visitor);
  }
}
function transformTable(table:OmiTableBlockData,transform:(node:JsonNode)=>JsonNode|null):OmiTableBlockData{
  if(!table.cellContent)return table;
  const cellContent={...table.cellContent};
  let changed=false;
  const layout=tableMergeLayout(table.cells,table.cellMerges,table.headerRows);
  for(let r=0;r<table.cells.length;r++)for(let c=0;c<(table.cells[r]?.length??0);c++){
    if(layout.covered(r,c))continue;
    const doc=tableCellDocument(table,r,c);
    if(!doc)continue;
    const next=transformNode(doc as JsonNode,transform);
    if(!next||JSON.stringify(next)===JSON.stringify(doc))continue;
    const valid=parseTableCellContent(JSON.stringify(next));
    if(!valid||tableCellPlainText(valid)!==table.cells[r]?.[c])throw new Error('Invalid table citation transformation.');
    cellContent[r+':'+c]=JSON.stringify(valid);changed=true;
  }
  return changed?{...table,cellContent}:table;
}
function transformCitationBlock(block:import('../types/omi').OmiBlock,transform:(node:JsonNode)=>JsonNode|null):import('../types/omi').OmiBlock{
  const content=transformStructuredContent(block.content,transform);
  const visual=block.visual?.kind==='table'?transformTable(block.visual,transform):block.visual;
  return content===block.content&&visual===block.visual?block:{...block,content,...(visual?{visual}:{})};
}
export function tableCitationAnchors(table:OmiTableBlockData):CitationAnchorReference[]{
  return collectCitationAnchors([{id:'table',title:'',blocks:[{id:'table',type:'table',content:'',visual:table}]}]);
}
export function citationAnchorInventory(anchors:readonly CitationAnchorReference[]):string[]{
  return anchors.map(a=>JSON.stringify([a.citationId,a.anchorId,a.clusterId??'',a.citationIds])).sort();
}
export function sameTableCitationAnchors(previous:OmiTableBlockData,next:OmiTableBlockData):boolean{
  return JSON.stringify(citationAnchorInventory(tableCitationAnchors(previous)))===JSON.stringify(citationAnchorInventory(tableCitationAnchors(next)));
}
