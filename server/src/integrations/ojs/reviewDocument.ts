import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, ExternalHyperlink, LevelFormat, AlignmentType, CommentRangeStart, CommentRangeEnd, CommentReference,
  type ParagraphChild, type FileChild,
} from 'docx';
import { authorVisibleReviewManuscript, type ReviewManuscriptBlock, type ReviewManuscriptSnapshot, type ReviewInlineSpan } from '../../services/reviewManuscriptModel.js';

export const REVIEW_DOCX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** A shareable Word revision. Confidential annotations stay in the native editor-only review comment. */
export async function buildReviewDocx(input: ReviewManuscriptSnapshot, openIdentity: boolean, participantName: string): Promise<Buffer> {
  const snapshot = authorVisibleReviewManuscript(input, openIdentity);
  const annotations = snapshot.annotations ?? [];
  function runs(spans: ReviewInlineSpan[]): ParagraphChild[] {
    return spans.map(span => {
      const kinds = new Set(span.semantics);
      const run = new TextRun({ text: span.text, bold: kinds.has('strong'), italics: kinds.has('emphasis'),
        strike: kinds.has('strike'), smallCaps: kinds.has('small-caps'),
        superScript: kinds.has('superscript'), subScript: kinds.has('subscript'),
        ...(kinds.has('underline') ? { underline: {} } : {}),
        ...(kinds.has('code') ? { font: 'Courier New' } : {}),
        ...(span.language ? { language: { value: span.language } } : {}),
      });
      return span.href ? new ExternalHyperlink({ link: span.href, children: [run] }) : run;
    });
  }
  function textBlock(block: Extract<ReviewManuscriptBlock, { text: string }>): Paragraph {
    const commentIndices = annotations.flatMap((item, index) => item.targetBlockId === block.id ? [index] : []);
    const content: ParagraphChild[] = [];
    const spans = block.richText?.length && block.richText.map(span => span.text).join('') === block.text ? block.richText : [{ text: block.text }];
    const ranges = commentIndices.map(index => {
      const note = annotations[index]!;
      const offset = note.targetStart !== undefined && block.text.slice(note.targetStart, note.targetStart + note.targetText.length) === note.targetText
        ? note.targetStart : note.targetText ? block.text.indexOf(note.targetText) : -1;
      return { index, start: offset < 0 ? 0 : offset, end: offset < 0 ? block.text.length : offset + note.targetText.length };
    });
    let offset = 0;
    for (const span of spans) {
      const end = offset + span.text.length;
      const points = [...new Set([offset, end, ...ranges.flatMap(range => [range.start, range.end]).filter(point => point > offset && point < end)])].sort((a, b) => a - b);
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i]!, to = points[i + 1]!;
        for (const range of ranges.filter(range => range.start === from)) content.push(new CommentRangeStart(range.index));
        content.push(...runs([{ ...span, text: span.text.slice(from - offset, to - offset) }]));
        for (const range of ranges.filter(range => range.end === to).reverse()) content.push(new CommentRangeEnd(range.index), new TextRun({ children: [new CommentReference(range.index)] }));
      }
      offset = end;
    }
    if (!block.text) for (const index of commentIndices) content.push(new CommentRangeStart(index), new CommentRangeEnd(index), new TextRun({ children: [new CommentReference(index)] }));
    return new Paragraph({ children: content,
      ...(block.type === 'heading' ? { heading: `Heading${block.level ?? 2}` as 'Heading1' } : {}),
      ...(block.type === 'list' ? { indent: { left: (block.listLevel + 1) * 360 },
        ...(block.ordered ? { numbering: { reference: `review-list-${snapshot.blocks.indexOf(block)}`, level: Math.min(8, block.listLevel) } } : { bullet: { level: Math.min(8, block.listLevel) } }) } : {}),
    });
  }
  const content: FileChild[] = [new Paragraph({ text: snapshot.title, heading: 'Title' })];
  if (openIdentity && snapshot.authors?.length) content.push(new Paragraph(snapshot.authors.map(item => item.name).join(', ')));
  if (snapshot.subtitle) content.push(new Paragraph(snapshot.subtitle));
  if (snapshot.abstract) content.push(new Paragraph(snapshot.abstract));
  if (snapshot.keywords.length) content.push(new Paragraph(snapshot.keywords.join('; ')));
  for (const block of snapshot.blocks) {
    if ('text' in block) { content.push(textBlock(block)); continue; }
    if (block.type === 'table' || block.type === 'chart') {
      if (block.type === 'chart' && block.title) content.push(new Paragraph(block.title));
      content.push(new Table({ rows: block.cells.map((row, index) => new TableRow({
        ...(block.type === 'table' && index < block.headerRows ? { tableHeader: true } : {}),
        children: row.map(text => new TableCell({ children: [new Paragraph(text)] })),
      })) }));
      continue;
    }
    if (block.type === 'image') {
      const match = /^data:image\/(png|jpeg|gif|bmp);base64,([\s\S]+)$/.exec(block.src);
      if (!match) throw new Error('The review image cannot be returned to Word without embedded image data.');
      content.push(new Paragraph({ children: [new ImageRun({ type: match[1] === 'jpeg' ? 'jpg' : match[1] as 'png' | 'gif' | 'bmp',
        data: Buffer.from(match[2]!, 'base64'), transformation: { width: 480, height: 320 },
        altText: { title: block.alt ?? '', description: block.alt ?? '', name: 'Article image' } })] }));
    }
  }
  for (const [index, note] of annotations.entries()) {
    if (snapshot.blocks.some(block => block.id === note.targetBlockId && 'text' in block)) continue;
    content.push(new Paragraph({ children: [new CommentRangeStart(index), new TextRun(note.targetText || 'Comment'),
      new CommentRangeEnd(index), new TextRun({ children: [new CommentReference(index)] })] }));
  }
  return Packer.toBuffer(new Document({ title: snapshot.title,
    creator: openIdentity ? participantName : 'Reviewer', lastModifiedBy: openIdentity ? participantName : 'Reviewer',
    numbering: { config: snapshot.blocks.flatMap((block, index) => block.type === 'list' && block.ordered ? [{
      reference: `review-list-${index}`, levels: Array.from({ length: 9 }, (_, level) => ({ level, format: LevelFormat.DECIMAL, text: `%${level + 1}.`, start: block.ordinal ?? 1, alignment: AlignmentType.LEFT })),
    }] : []) },
    comments: { children: annotations.map((item, id) => ({ id,
      author: openIdentity ? item.authorName ?? participantName : 'Reviewer',
      children: [new Paragraph(`${item.targetText ? `“${item.targetText}”\n` : ''}${item.body}\n[${item.id}; ${item.status}${item.replyToCommentId ? `; reply: ${item.replyToCommentId}` : ''}]`)],
    })) }, sections: [{ children: content }],
  }));
}
