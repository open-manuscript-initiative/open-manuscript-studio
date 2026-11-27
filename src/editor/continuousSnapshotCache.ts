import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import { createDerivedCache, editorMemoryPool, type DerivedCache } from '../model/derivedMemoryCache';

interface CachedNode {
  json: JSONContent;
  serialized: string;
}

function estimateNode(value: CachedNode): number { return 512 + value.serialized.length * 8; }
function supportsProjection(doc: ProseMirrorNode): boolean {
  return doc.type.name === 'doc' && !Object.keys(doc.attrs).length && !doc.marks.length && !!doc.childCount;
}

/** ProseMirror nodes are immutable and structurally shared between transactions.
 * Keep one JSON projection per surviving top-level node; weak keys release old
 * revisions automatically. Never mutate the returned JSON projection. */
export class ContinuousSnapshotCache {
  private readonly nodes: DerivedCache<ProseMirrorNode, CachedNode>;
  private readonly pool: typeof editorMemoryPool;
  constructor(pool = editorMemoryPool) {
    this.pool = pool;
    this.nodes = createDerivedCache(estimateNode, pool);
  }

  /** Populate a bounded batch without evicting demand-cached entries or counting synthetic hits. */
  warmSlice(doc: ProseMirrorNode, start = 0, maxNodes = 16): number | undefined {
    if (!supportsProjection(doc) || this.pool.budgetBytes === 0) return undefined;
    const ceiling = Math.floor(this.pool.budgetBytes * 0.75);
    const end = Math.min(doc.childCount, start + maxNodes);
    for (let index = start; index < end; index++) {
      if (this.pool.estimatedBytes >= ceiling) return undefined;
      const node = doc.child(index);
      if (this.nodes.get(node, false)) continue;
      // Avoid serializing exceptionally large single nodes during background warming.
      if (node.nodeSize > 65536) continue;
      const json = node.toJSON() as JSONContent;
      const cached = { json, serialized: JSON.stringify(json) };
      if (this.pool.estimatedBytes + estimateNode(cached) <= ceiling) this.nodes.set(node, cached);
    }
    return end < doc.childCount ? end : undefined;
  }

  snapshot(doc: ProseMirrorNode): { document: JSONContent; serialized: string } {
    // Keep arbitrary root attributes/marks on the exact native serialization path.
    if (!supportsProjection(doc)) {
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
