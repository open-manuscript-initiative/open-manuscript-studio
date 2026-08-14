import { useId } from 'react';
import { type JSONContent } from '@tiptap/react';

import type { EditorCapabilities } from '../editor/editorCapabilities';
import { useTranslation } from '../i18n';
import type {
  ReviewInlineSemantic,
  ReviewInlineSpan,
  ReviewManuscriptBlock,
} from '../services/peerReviewApi';
import { BlockEditor } from './BlockEditor';

export type ReviewTextBlock = Extract<
  ReviewManuscriptBlock,
  { type: 'heading' | 'paragraph' | 'note' | 'list' }
>;

type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export function ReviewerRichTextEditor({
  block,
  disabled,
  capabilities,
  manuscriptLanguage,
  onChange,
}: {
  block: ReviewTextBlock;
  disabled: boolean;
  capabilities: EditorCapabilities;
  manuscriptLanguage?: string;
  onChange: (block: ReviewTextBlock) => void;
}) {
  const { locale } = useTranslation();
  const reactId = useId();
  const blockId = `review-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const renderCapabilities = block.type === 'heading' && !capabilities.editStructure
    ? { ...capabilities, editStructure: true }
    : capabilities;

  return (
    <div className="omi-continuous-blocks review-mode__studio-block-flow">
      <BlockEditor
        blockId={blockId}
        blockType={block.type}
        content={JSON.stringify(blockToDocument(block))}
        onUpdate={(_id, content) => {
          const document = parseDocument(content);
          const { text, richText } = documentToReviewContent(document);
          onChange({
            ...block,
            text,
            ...(richText.length ? { richText } : { richText: undefined }),
          } as ReviewTextBlock);
        }}
        editable={!disabled}
        capabilities={renderCapabilities}
        manuscriptLanguage={manuscriptLanguage ?? locale}
        className={`review-mode__studio-block-editor review-mode__studio-block-editor--${block.type}`}
      />
    </div>
  );
}

function blockToDocument(block: ReviewTextBlock): JSONContent {
  const inlineContent: JSONContent[] | undefined = block.richText?.length
    ? block.richText.map(spanToNode)
    : block.text
      ? [{ type: 'text', text: block.text }]
      : undefined;

  if (block.type === 'heading') {
    return {
      type: 'doc',
      content: [{
        type: 'heading',
        attrs: { level: clampHeadingLevel(block.level) },
        ...(inlineContent?.length ? { content: inlineContent } : {}),
      }],
    };
  }

  if (block.type === 'list') {
    return {
      type: 'doc',
      content: [{
        type: block.ordered ? 'orderedList' : 'bulletList',
        ...(block.ordered && block.ordinal ? { attrs: { start: block.ordinal } } : {}),
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            ...(inlineContent?.length ? { content: inlineContent } : {}),
          }],
        }],
      }],
    };
  }

  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      ...(inlineContent?.length ? { content: inlineContent } : {}),
    }],
  };
}

function clampHeadingLevel(level?: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const normalized = Math.max(1, Math.min(6, Math.trunc(level ?? 1)));
  return normalized as 1 | 2 | 3 | 4 | 5 | 6;
}

function spanToNode(span: ReviewInlineSpan): JSONContent {
  const marks: TiptapMark[] = [];
  for (const semantic of span.semantics ?? []) {
    const type = semanticToMark(semantic);
    if (type) marks.push({ type });
  }
  if (span.language) marks.push({ type: 'omiLanguage', attrs: { lang: span.language } });
  return {
    type: 'text',
    text: span.text,
    ...(marks.length ? { marks } : {}),
  };
}

function parseDocument(content: string): JSONContent {
  try {
    const parsed = JSON.parse(content) as JSONContent;
    if (parsed?.type === 'doc') return parsed;
  } catch {
    // BlockEditor emits JSON; this fallback only protects stale content.
  }
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function documentToReviewContent(document: JSONContent): {
  text: string;
  richText: ReviewInlineSpan[];
} {
  const spans: ReviewInlineSpan[] = [];
  collectText(document, spans);
  return {
    text: spans.map((span) => span.text).join(''),
    richText: mergeAdjacentSpans(spans),
  };
}

function collectText(node: JSONContent, spans: ReviewInlineSpan[]): void {
  if (node.type === 'text' && typeof node.text === 'string') {
    const semantics: ReviewInlineSemantic[] = [];
    let language: string | undefined;
    for (const mark of node.marks ?? []) {
      const semantic = markToSemantic(mark.type ?? '');
      if (semantic) semantics.push(semantic);
      if (mark.type === 'omiLanguage' && typeof mark.attrs?.lang === 'string') {
        language = mark.attrs.lang;
      }
    }
    spans.push({
      text: node.text,
      ...(semantics.length ? { semantics } : {}),
      ...(language ? { language } : {}),
    });
    return;
  }
  if (node.type === 'hardBreak') {
    spans.push({ text: '\n' });
    return;
  }
  for (const child of node.content ?? []) collectText(child, spans);
}

function mergeAdjacentSpans(spans: ReviewInlineSpan[]): ReviewInlineSpan[] {
  const merged: ReviewInlineSpan[] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (
      previous &&
      JSON.stringify(previous.semantics ?? []) === JSON.stringify(span.semantics ?? []) &&
      previous.language === span.language
    ) {
      previous.text += span.text;
    } else {
      merged.push({ ...span, semantics: span.semantics ? [...span.semantics] : undefined });
    }
  }
  return merged;
}

function semanticToMark(semantic: ReviewInlineSemantic): string | undefined {
  if (semantic === 'strong') return 'bold';
  if (semantic === 'emphasis') return 'italic';
  if (semantic === 'strike') return 'strike';
  if (semantic === 'underline') return 'omiUnderline';
  if (semantic === 'small-caps') return 'omiSmallCaps';
  if (semantic === 'superscript') return 'omiSuperscript';
  if (semantic === 'subscript') return 'omiSubscript';
  if (semantic === 'code') return 'code';
  return undefined;
}

function markToSemantic(mark: string): ReviewInlineSemantic | undefined {
  if (mark === 'bold') return 'strong';
  if (mark === 'italic') return 'emphasis';
  if (mark === 'strike') return 'strike';
  if (mark === 'omiUnderline') return 'underline';
  if (mark === 'omiSmallCaps') return 'small-caps';
  if (mark === 'omiSuperscript') return 'superscript';
  if (mark === 'omiSubscript') return 'subscript';
  if (mark === 'code') return 'code';
  return undefined;
}
