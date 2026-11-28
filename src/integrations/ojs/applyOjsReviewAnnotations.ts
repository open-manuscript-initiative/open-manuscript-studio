import type { OmiManuscript, OmiAnnotation } from '../../types/omi';
import type { OjsLaunchPayload } from './importOjsLaunch';

/** Rebind imported Word comments after structured blocks have received their final IDs. */
export function applyOjsReviewAnnotations(manuscript: OmiManuscript, launch: OjsLaunchPayload): OmiManuscript {
  const snapshot = launch.sourceDocument?.reviewSnapshot;
  const notes = snapshot ? (snapshot.annotations ?? []).map(note => ({ ...note,
    paragraphText: snapshot.blocks.find(block => block.id === note.targetBlockId && 'text' in block && Boolean(block.text)) }))
    .map(note => ({ ...note, paragraphText: note.paragraphText && 'text' in note.paragraphText ? note.paragraphText.text : '' }))
    : launch.sourceDocument?.reviewAnnotations;
  if (!notes?.length) return manuscript;
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const text = (value: unknown): string => {
    if (!value || typeof value !== 'object') return '';
    const node = value as { text?: string; content?: unknown[] };
    return node.text ?? (node.content ?? []).map(text).join('');
  };
  const blocks = manuscript.sections.flatMap(section => section.blocks).map(block => {
    let plain = block.content;
    try { plain = text(JSON.parse(block.content)); } catch { /* Plain text paragraphs are also supported. */ }
    return { block, plain: normalize(plain) };
  });
  const imported: OmiAnnotation[] = notes.map(note => {
    const target = blocks.find(item => note.paragraphText && item.plain === normalize(note.paragraphText)) ?? blocks[0];
    return { id: `ojs-review-${note.id}`, type: 'comment', targetBlockId: target?.block.id ?? '',
      targetText: note.targetText, body: note.body, renderingHint: 'popup', status: note.status,
      visibility: 'visibility' in note && note.visibility === 'author_and_editor' ? 'author_and_editor' : 'editor_only',
      ...('targetStart' in note && typeof note.targetStart === 'number' ? { targetRange: { from: note.targetStart, to: note.targetStart + note.targetText.length } } : {}),
      ...(note.createdAt ? { createdAt: note.createdAt } : {}),
      ...(note.replyToCommentId ? { replyToCommentId: `ojs-review-${note.replyToCommentId}` } : {}),
    };
  });
  return { ...manuscript, annotations: [...manuscript.annotations.filter(item => !item.id.startsWith('ojs-review-')), ...imported] };
}
