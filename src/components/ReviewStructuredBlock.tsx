import { createElement, type ReactNode } from 'react';

import type {
  ReviewInlineSemantic,
  ReviewInlineSpan,
  ReviewManuscriptBlock,
} from '../services/peerReviewApi';
import './ReviewStructuredBlock.css';

export function ReviewStructuredBlock({
  block,
}: {
  block: ReviewManuscriptBlock;
}) {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(2, block.level ?? 2));
    return createElement(
      `h${level}`,
      { className: 'review-structured-heading' },
      renderInline(block),
    );
  }

  if (block.type === 'paragraph') {
    return <p className="review-structured-paragraph">{renderInline(block)}</p>;
  }

  if (block.type === 'note') {
    return <aside className="review-structured-note">{renderInline(block)}</aside>;
  }

  if (block.type === 'list') {
    return (
      <div
        className="review-structured-list-item"
        role="listitem"
        style={{ paddingInlineStart: `${Math.min(8, block.listLevel) * 1.25}rem` }}
      >
        <span className="review-structured-list-marker" aria-hidden="true">
          {block.ordered ? `${block.ordinal ?? 1}.` : '•'}
        </span>
        <span>{renderInline(block)}</span>
      </div>
    );
  }

  if (block.type === 'table') {
    return <ReviewTable cells={block.cells} headerRows={block.headerRows} />;
  }

  if (block.type === 'image') {
    return (
      <figure className="review-structured-figure">
        <img src={block.src} alt={block.alt ?? ''} />
        {block.alt || block.fileName ? (
          <figcaption>{block.alt || block.fileName}</figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure className="review-structured-chart">
      <figcaption>
        <strong>{block.title || 'Chart'}</strong>
        <span>{block.chartType} chart · source data</span>
      </figcaption>
      <ReviewTable cells={block.cells} headerRows={1} />
    </figure>
  );
}

export function isReviewTextBlock(
  block: ReviewManuscriptBlock,
): block is Extract<ReviewManuscriptBlock, { type: 'heading' | 'paragraph' | 'note' | 'list' }> {
  return block.type === 'heading' || block.type === 'paragraph' ||
    block.type === 'note' || block.type === 'list';
}

function ReviewTable({
  cells,
  headerRows,
}: {
  cells: string[][];
  headerRows: number;
}) {
  return (
    <div className="review-structured-table-wrap">
      <table className="review-structured-table">
        <tbody>
          {cells.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => {
                const Cell = rowIndex < headerRows ? 'th' : 'td';
                return <Cell key={columnIndex}>{cell}</Cell>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInline(
  block: Extract<ReviewManuscriptBlock, { type: 'heading' | 'paragraph' | 'note' | 'list' }>,
): ReactNode {
  if (!block.richText?.length) return block.text;
  return block.richText.map((span, index) => (
    <span key={index} lang={span.language}>{applySemantics(span, index)}</span>
  ));
}

function applySemantics(span: ReviewInlineSpan, key: number): ReactNode {
  let node: ReactNode = span.text;
  for (const semantic of span.semantics ?? []) {
    node = wrapSemantic(semantic, node, `${key}-${semantic}`);
  }
  return node;
}

function wrapSemantic(
  semantic: ReviewInlineSemantic,
  node: ReactNode,
  key: string,
): ReactNode {
  if (semantic === 'strong') return <strong key={key}>{node}</strong>;
  if (semantic === 'emphasis') return <em key={key}>{node}</em>;
  if (semantic === 'strike') return <s key={key}>{node}</s>;
  if (semantic === 'underline') return <u key={key}>{node}</u>;
  if (semantic === 'superscript') return <sup key={key}>{node}</sup>;
  if (semantic === 'subscript') return <sub key={key}>{node}</sub>;
  if (semantic === 'code') return <code key={key}>{node}</code>;
  return <span key={key} className="review-structured-small-caps">{node}</span>;
}
