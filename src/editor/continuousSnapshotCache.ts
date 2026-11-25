import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface CachedNode {
  json: JSONContent;
  serialized: string;
}

/** ProseMirror nodes are immutable and structurally shared between transactions.
 * Keep one JSON projection per surviving top-level node; weak keys release old
 * revisions automatically. Never mutate the returned JSON projection. */
export class ContinuousSnapshotCache {
  private readonly nodes = new WeakMap<ProseMirrorNode, CachedNode>();

  snapshot(doc: ProseMirrorNode): { document: JSONContent; serialized: string } {
    // Keep arbitrary root attributes/marks on the exact native serialization path.
    if (doc.type.name !== 'doc' || Object.keys(doc.attrs).length || doc.marks.length || !doc.childCount) {
      const document = doc.toJSON() as JSONContent;
      return { document, serialized: JSON.stringify(document) };
    }
    const content: JSONContent[] = [];
    const serialized: string[] = [];
    doc.forEach((node) => {
      let cached = this.nodes.get(node);
      if (!cached) {
        const json = node.toJSON() as JSONContent;
        cached = { json, serialized: JSON.stringify(json) };
        this.nodes.set(node, cached);
      }
      content.push(cached.json);
      serialized.push(cached.serialized);
    });
    return {
      document: { type: 'doc', content },
      serialized: '{"type":"doc","content":[' + serialized.join(',') + ']}',
    };
  }
}
