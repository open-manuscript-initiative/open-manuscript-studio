import { useEffect, useMemo, useRef, useState } from 'react';

import { BlockEditor } from './BlockEditor';

interface LazyBlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
  lazy: boolean;
}

export function LazyBlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
  lazy,
}: LazyBlockEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(!lazy);
  const previewText = useMemo(() => storedPlainText(content), [content]);

  useEffect(() => {
    if (!lazy || active) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setActive(true);
        observer.disconnect();
      },
      { rootMargin: '1400px 0px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [active, lazy]);

  if (active) {
    return (
      <BlockEditor
        blockId={blockId}
        blockType={blockType}
        content={content}
        onUpdate={onUpdate}
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className="omi-block-editor omi-block-editor--deferred"
      data-block-id={blockId}
      id={`omi-target-${blockId}`}
      aria-label="Deferred manuscript paragraph"
    >
      <div
        className="omi-tiptap-editor omi-block-editor__deferred-preview"
        aria-hidden="true"
      >
        <p>{previewText}</p>
      </div>
    </div>
  );
}

function storedPlainText(content: string): string {
  try {
    return collectText(JSON.parse(content) as unknown);
  } catch {
    return content;
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectText).join('');
}
