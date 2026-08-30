import { useEffect, useMemo, useRef, useState } from 'react';

import { BlockEditor } from './BlockEditor';
import './LazyBlockEditor.css';

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
  const editorContent = useMemo(
    () => normalizeLegacyBlockContent(blockType, content),
    [blockType, content],
  );
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
        content={editorContent}
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

function normalizeLegacyBlockContent(blockType: string, content: string): string {
  if (blockType !== 'heading') return content;

  try {
    const parsed: unknown = JSON.parse(content);
    if (isTiptapDocument(parsed)) return content;
  } catch {
    // Imported/legacy heading content may still be stored as plain text.
  }

  return JSON.stringify({
    type: 'doc',
    content: [
      content.length === 0
        ? { type: 'heading', attrs: { level: 1 } }
        : {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: content }],
          },
    ],
  });
}

function isTiptapDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const node = value as { type?: unknown; content?: unknown };
  return node.type === 'doc' &&
    (node.content === undefined || Array.isArray(node.content));
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
