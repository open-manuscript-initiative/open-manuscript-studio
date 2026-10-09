import type { OmiSection } from '../types/omi';

export function attachImportedDocumentSource(
  sections: readonly OmiSection[],
  source: string,
  label: string,
  createId: () => string = () => crypto.randomUUID(),
): OmiSection[] {
  const normalized = source.trim();
  if (!normalized) throw new Error('Imported document requires a source.');
  const first = sections[0];
  if (!first) throw new Error('Imported document has no section.');
  const notice = {
    id: createId(),
    type: 'paragraph' as const,
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: `${label}: ${normalized}` }],
      }],
    }),
  };
  const insertAt = first.blocks[0]?.type === 'heading' ? 1 : 0;
  return [
    { ...first, blocks: [
      ...first.blocks.slice(0, insertAt), notice, ...first.blocks.slice(insertAt),
    ] },
    ...sections.slice(1),
  ];
}

export function importedDocumentSourceLabel(locale: string): string {
  const language = locale.toLowerCase().split('-')[0];
  return language === 'hu' ? 'Forrás' : language === 'de' ? 'Quelle' : 'Source';
}

/**
 * An author may bring their own work from another editor without publishing a
 * spurious citation to a local filename. This self-attestation travels with
 * canonical OMI annotations, but is deliberately not publication text.
 */
export function selfAuthoredExternalOrigin(
  sections: readonly OmiSection[],
  timestamp: string,
  createId: () => string = () => crypto.randomUUID(),
): import('../types/omi').OmiAnnotation {
  const target = sections.flatMap((section) => section.blocks)[0];
  if (!target) throw new Error('Imported document has no content to attribute.');
  return {
    id: createId(),
    type: 'semantic',
    targetBlockId: target.id,
    targetText: 'omi:source-origin',
    body: 'author-declared:self-authored-outside-omi',
    renderingHint: 'hidden',
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}
