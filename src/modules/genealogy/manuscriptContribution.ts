import { buildAttributedVisualImport } from '../../model/externalObjectSources';
import { createImageBlock } from '../../model/visualBlocks';
import type { OmiBibliographicRecord } from '../../types/omi';
import type { GraphWorkspace } from './model';

/** Only selected diagram records contribute source suggestions; never raw GEDCOM or private notes. */
export function diagramSourceSuggestion(workspace: GraphWorkspace): string {
  return [...new Set([...workspace.nodes, ...workspace.edges].map(row => row.source.trim()).filter(Boolean))].join('; ').slice(0,20000);
}
export function buildGraphDiagramContribution(input: {
  svg: string; title: string; width: number; height: number; source: string;
  selfAuthored: boolean; approved: boolean; sourceLabel: string; timestamp: string;
  existingRecords?: readonly OmiBibliographicRecord[]; newId?: () => string;
}) {
  if (!input.approved || (!input.selfAuthored && !input.source.trim()) || input.source.length > 20000) {
    throw new Error('Review the diagram and its source before insertion.');
  }
  const bytes = new TextEncoder().encode(input.svg);
  let binary = '';
  for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  const block = createImageBlock({ src: `data:image/svg+xml;base64,${btoa(binary)}`,
    mediaType: 'image/svg+xml', fileName: 'research-diagram.svg', alt: input.title, caption: input.title,
    width: input.width, height: input.height });
  const result = buildAttributedVisualImport([{ block, source: input.source, selfAuthoredExternal: input.selfAuthored }],
    input.sourceLabel, input.timestamp, input.newId, input.existingRecords);
  if (input.selfAuthored) for (const annotation of result.annotations) {
    annotation.targetText = 'omi:research-origin';
    annotation.body = JSON.stringify({ format: 'omi-research-origin', version: '0.1.0',
      assertion: 'author-declared:own-research-data', source: input.source.trim() });
  }
  return result;
}
