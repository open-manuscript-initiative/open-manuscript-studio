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

  const estimatedLines = Math.max(1, Math.ceil(previewText.length / 95));
  return (
    <div
      ref={hostRef}
      className="omi-block-editor omi-block-editor--deferred"
      data-block-id={blockId}
      id={`omi-target-${blockId}`}
      style={{ minHeight: `${Math.min(estimatedLines * 1.55, 18)}rem` }}
      aria-label="Deferred manuscript paragraph"
    >
      <p>{previewText}</p>
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
