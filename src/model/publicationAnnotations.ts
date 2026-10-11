import type { OmiAnnotation, OmiManuscript } from '../types/omi';

/** Workflow visibility and hidden provenance are never public publication notes. */
export function isPublicPublicationNote(annotation: OmiAnnotation): boolean {
  return annotation.type === 'note' && annotation.renderingHint !== 'hidden' && !annotation.visibility;
}

/**
 * Non-mutating publication projection. Portable save/history must use the original
 * manuscript: this view deliberately omits private annotation bodies and anchors.
 * Unresolved anchors remain for the renderer's existing diagnostics.
 */
export function publicPublicationManuscript(manuscript: OmiManuscript): OmiManuscript {
  const privateIds = new Set(manuscript.annotations
    .filter((annotation) => !isPublicPublicationNote(annotation))
    .map((annotation) => annotation.id));
  if (!privateIds.size) return manuscript;

  function contentView(content: string): string {
    type Node = { type?: string; attrs?: { noteId?: unknown }; content?: Node[] };
    function visit(node: Node): Node | undefined {
      if (node.type === 'omiNote' && typeof node.attrs?.noteId === 'string'
        && privateIds.has(node.attrs.noteId)) return undefined;
      return node.content ? { ...node, content: node.content.flatMap((child) => {
        const projected = visit(child);
        return projected ? [projected] : [];
      }) } : node;
    }
    try {
      const parsed = JSON.parse(content) as Node;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return content;
      return JSON.stringify(visit(parsed) ?? { type: 'doc', content: [] });
    } catch {
      // Legacy plain text has no structured annotation anchor to remove.
      return content;
    }
  }

  return {
    ...manuscript,
    annotations: manuscript.annotations.filter(isPublicPublicationNote),
    sections: manuscript.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => ({ ...block, content: contentView(block.content) })),
    })),
  };
}
