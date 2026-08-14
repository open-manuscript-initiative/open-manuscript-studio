import { useEffect, useRef } from 'react';
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { OMI_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useTranslation } from '../i18n';
import type {
  ReviewInlineSemantic,
  ReviewInlineSpan,
  ReviewManuscriptBlock,
} from '../services/peerReviewApi';
import { RichTextToolbar } from './RichTextToolbar';

export type ReviewTextBlock = Extract<
  ReviewManuscriptBlock,
  { type: 'heading' | 'paragraph' | 'note' | 'list' }
>;

export function ReviewerRichTextEditor({
  block,
  disabled,
  onChange,
}: {
  block: ReviewTextBlock;
  disabled: boolean;
  onChange: (block: ReviewTextBlock) => void;
}) {
  const { locale } = useTranslation();
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    editable: !disabled,
    extensions: [StarterKit, ...OMI_RICH_TEXT_EXTENSIONS],
    content: blockToDocument(block),
    editorProps: {
      attributes: {
        class: 'omi-tiptap-editor review-mode__shared-editor',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const { text, richText } = documentToReviewContent(currentEditor.getJSON());
      onChangeRef.current({
        ...block,
        text,
        ...(richText.length ? { richText } : { richText: undefined }),
      } as ReviewTextBlock);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const incoming = blockToDocument(block);
    if (JSON.stringify(editor.getJSON()) === JSON.stringify(incoming)) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [block, editor]);

  if (!editor) return null;

  return (
    <div className="omi-block-editor review-mode__shared-block-editor">
      {block.type === 'list' ? (
        <span className="review-structured-list-marker" aria-hidden="true">
          {block.ordered ? `${block.ordinal ?? 1}.` : '•'}
        </span>
      ) : null}
      <EditorContent editor={editor} />
      {!disabled ? (
        <RichTextToolbar
          editor={editor}
          locale={locale}
          manuscriptLanguage={locale}
        />
      ) : null}
    </div>
  );
}

function blockToDocument(block: ReviewTextBlock): JSONContent {
  const content = block.richText?.length
    ? block.richText.map(spanToNode)
    : block.text
      ? [{ type: 'text', text: block.text }]
      : undefined;

  return {
    type: 'doc',
    content: [{ type: 'paragraph', ...(content?.length ? { content } : {}) }],
  };
}

function spanToNode(span: ReviewInlineSpan): JSONContent {
  const marks: JSONContent[] = [];
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
    if (previous && JSON.stringify(previous.semantics ?? []) === JSON.stringify(span.semantics ?? []) && previous.language === span.language) {
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
