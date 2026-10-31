import type { OmiBlock, OmiSection } from '../types/omi';

/**
 * Preorder traversal of both supported OMI representations: flat sections
 * with parentSectionId, and embedded section/block child trees.
 *
 * Cycles are ignored here; the validator diagnoses malformed structure.
 * Traversal never changes manuscript data or interprets author text.
 */
export function* walkManuscriptStructure(
  sections: readonly OmiSection[],
): Generator<
  | { kind: 'section'; section: OmiSection }
  | { kind: 'block'; section: OmiSection; block: OmiBlock }
> {
  const active = new Set<object>();

  function* visitBlock(section: OmiSection, block: OmiBlock): Generator<{ kind: 'block'; section: OmiSection; block: OmiBlock }> {
    if (active.has(block)) return;
    active.add(block);
    yield { kind: 'block', section, block };
    for (const child of block.children ?? []) yield* visitBlock(section, child);
    active.delete(block);
  }

  function* visitSection(section: OmiSection): Generator<
    | { kind: 'section'; section: OmiSection }
    | { kind: 'block'; section: OmiSection; block: OmiBlock }
  > {
    if (active.has(section)) return;
    active.add(section);
    yield { kind: 'section', section };
    for (const block of section.blocks) yield* visitBlock(section, block);
    for (const child of section.children ?? []) yield* visitSection(child);
    active.delete(section);
  }

  for (const section of sections) yield* visitSection(section);
}

/** Apply an inline-block transformation at any depth, preserving unchanged objects. */
export function mapManuscriptBlocks(
  sections: readonly OmiSection[],
  transform: (block: OmiBlock) => OmiBlock,
): OmiSection[] {
  const active = new Set<object>();

  function mapBlock(block: OmiBlock): OmiBlock {
    if (active.has(block)) return block;
    active.add(block);
    const children = block.children?.map(mapBlock);
    active.delete(block);
    const withChildren = children && children.some((child, index) => child !== block.children?.[index])
      ? { ...block, children }
      : block;
    return transform(withChildren);
  }

  function mapSection(section: OmiSection): OmiSection {
    if (active.has(section)) return section;
    active.add(section);
    const blocks = section.blocks.map(mapBlock);
    const children = section.children?.map(mapSection);
    active.delete(section);
    const blocksChanged = blocks.some((block, index) => block !== section.blocks[index]);
    const childrenChanged = children?.some((child, index) => child !== section.children?.[index]) ?? false;
    return blocksChanged || childrenChanged
      ? { ...section, ...(blocksChanged ? { blocks } : {}), ...(childrenChanged ? { children } : {}) }
      : section;
  }

  return sections.map(mapSection);
}
