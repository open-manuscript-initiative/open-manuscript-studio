import { DOMParser, type Element } from '@xmldom/xmldom';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
export interface SourceReviewAnnotation {
  id: string; body: string; paragraphText: string; targetText: string;
  status: 'open' | 'resolved'; authorName?: string; replyToCommentId?: string; createdAt?: string;
}

/** Preserve every source comment, even when a Word range crosses paragraphs or is dangling. */
export function readDocxReviewAnnotations(documentXml: string, commentsXml?: string, extendedXml?: string): SourceReviewAnnotation[] {
  if (!commentsXml) return [];
  const parse = (xml: string) => {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Entities are not allowed in DOCX review annotations.');
    return new DOMParser().parseFromString(xml, 'application/xml');
  };
  const text = (element: Element) => Array.from(element.getElementsByTagNameNS(W, 't')).map(item => item.textContent ?? '').join('');
  const extended = new Map<string, { parent: string; done: boolean }>();
  if (extendedXml) for (const node of Array.from(parse(extendedXml).getElementsByTagNameNS(W15, 'commentEx'))) {
    extended.set(node.getAttributeNS(W15, 'paraId') ?? '', { parent: node.getAttributeNS(W15, 'paraIdParent') ?? '', done: node.getAttributeNS(W15, 'done') === '1' });
  }
  const ranges = new Map<string, { paragraphText: string; targetText: string }>();
  const active = new Set<string>();
  let paragraphText = '';
  const visit = (element: Element): void => {
    if (element.namespaceURI === W) {
      if (element.localName === 'del' || element.localName === 'moveFrom') return;
      if (element.localName === 'p') paragraphText = text(element);
      const id = element.getAttributeNS(W, 'id');
      if (element.localName === 'commentRangeStart' && id) {
        active.add(id); ranges.set(id, { paragraphText, targetText: '' });
      }
      if (element.localName === 'commentRangeEnd' && id) active.delete(id);
      if (element.localName === 'commentReference' && id && !ranges.has(id)) ranges.set(id, { paragraphText, targetText: '' });
      if (element.localName === 't') {
        for (const id of active) { const range = ranges.get(id); if (range) range.targetText += element.textContent ?? ''; }
        return;
      }
    }
    for (let node = element.firstChild; node; node = node.nextSibling) if (node.nodeType === 1) visit(node as Element);
  };
  visit(parse(documentXml).documentElement!);
  const comments = Array.from(parse(commentsXml).getElementsByTagNameNS(W, 'comment'));
  const paragraphIds = new Map<string, string>();
  for (const comment of comments) for (const p of Array.from(comment.getElementsByTagNameNS(W, 'p'))) {
    const paraId = p.getAttributeNS(W14, 'paraId');
    if (paraId) paragraphIds.set(paraId, comment.getAttributeNS(W, 'id') ?? '');
  }
  return comments.slice(0, 10_000).flatMap(comment => {
    const id = comment.getAttributeNS(W, 'id');
    const body = Array.from(comment.getElementsByTagNameNS(W, 'p')).map(text).join('\n');
    if (!id || !body.trim()) return [];
    const paraIds = Array.from(comment.getElementsByTagNameNS(W, 'p')).map(p => p.getAttributeNS(W14, 'paraId')).filter(Boolean);
    const meta = extended.get(paraIds.at(-1) ?? '');
    const parent = meta?.parent ? paragraphIds.get(meta.parent) : undefined;
    const range = ranges.get(id) ?? (parent ? ranges.get(parent) : undefined);
    const authorName = comment.getAttributeNS(W, 'author') ?? undefined;
    const date = comment.getAttributeNS(W, 'date');
    return [{ id: `word-comment-${id}`, body, paragraphText: range?.paragraphText ?? '', targetText: range?.targetText ?? '',
      status: meta?.done ? 'resolved' as const : 'open' as const,
      ...(parent ? { replyToCommentId: `word-comment-${parent}` } : {}),
      ...(authorName ? { authorName } : {}),
      ...(date && Number.isFinite(Date.parse(date)) ? { createdAt: new Date(date).toISOString() } : {}),
    }];
  });
}
