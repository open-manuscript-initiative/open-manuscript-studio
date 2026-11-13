import validateTextBoxContent from '../schemas/generated/textBoxContent.js';
import type { OmiTextBox } from '../types/omi';
/** Bounded experimental portable text-box profile. No editor/runtime imports. */
export const TEXT_BOX_CONTENT_PROFILE = 'https://openmanuscript.org/profiles/text-box-content/0.1';
export const TEXT_BOX_SOURCE_EXTENSION = 'https://openmanuscript.org/extensions/text-box-source/1';
export interface TextBoxEditorNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: TextBoxEditorNode[];
}
export interface TextBoxContent {
  format: 'omi-text-box-content';
  version: '0.1.0';
  paragraphs: Array<{
    alignment: 'left' | 'center' | 'right' | 'justify';
    lineHeight: number; spaceBefore: number; spaceAfter: number;
    runs: Array<{ text: string; emphasis: string[]; presentation?: { fontFamily: string; fontSize: number; color: string } }>;
  }>;
}
const markMap: Record<string, string> = { bold: 'strong', italic: 'emphasis', underline: 'underline', strike: 'strike',
  omiSuperscript: 'superscript', omiSubscript: 'subscript', omiSmallCaps: 'small-caps' };
const reverseMarks = Object.fromEntries(Object.entries(markMap).map(([a,b]) => [b,a]));
const alignments = ['left', 'center', 'right', 'justify'];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
const font = (v: unknown) => typeof v === 'string' && v.length < 150 && /^[\p{L}\p{N} _,-]+$/u.test(v) ? v : 'Times New Roman';
const color = (v: unknown) => typeof v === 'string' && /^#[\da-f]{6}$/iu.test(v) ? v : '#000000';
export function isTextBoxContent(value: unknown): value is TextBoxContent {
  return validateTextBoxContent(value);
}
export function encodeTextBoxContent(document: TextBoxEditorNode): string {
  const portable: TextBoxContent = { format: 'omi-text-box-content', version: '0.1.0', paragraphs: (document.content ?? []).slice(0,10000).map(p => ({
    alignment: (alignments.includes(String(p.attrs?.textAlign)) ? p.attrs?.textAlign : 'left') as TextBoxContent['paragraphs'][number]['alignment'],
    lineHeight: finite(p.attrs?.lineHeight,1.15,0.5,10), spaceBefore: finite(p.attrs?.spaceBefore,0,0,1000), spaceAfter: finite(p.attrs?.spaceAfter,0,0,1000),
    runs: (p.content ?? []).filter(n => n.type === 'text' || n.type === 'hardBreak').map(n => {
      const style = n.marks?.find(m => m.type === 'textBoxStyle')?.attrs;
      return { text: n.type === 'hardBreak' ? '\n' : n.text ?? '', emphasis: (n.marks ?? []).flatMap(m => Object.hasOwn(markMap,m.type) ? [markMap[m.type]!] : []),
        ...(style ? { presentation: { fontFamily: font(style.fontFamily), fontSize: finite(style.fontSize,16,1,400), color: color(style.color) } } : {}) };
    }),
  })) };
  return JSON.stringify(portable);
}
/** Decoding is non-mutating. Unknown data remains in the caller's original string. */
export function decodeTextBoxContent(content: string, profile?: string): { document: TextBoxEditorNode; diagnostics: string[] } {
  const fallback = (message: string, diagnostics: string[]) => ({ document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: message }] }] }, diagnostics });
  if (profile !== undefined && profile !== TEXT_BOX_CONTENT_PROFILE) return fallback('Unsupported text-box profile', ['text-box-unknown-profile']);
  let value: unknown;
  try { value = JSON.parse(content); } catch {
    return fallback(content, profile ? ['text-box-invalid-content'] : []);
  }
  if (profile === TEXT_BOX_CONTENT_PROFILE || (record(value) && value.format === 'omi-text-box-content')) {
    if (!isTextBoxContent(value)) return fallback('Invalid text-box content', ['text-box-invalid-content']);
    const document: TextBoxEditorNode = { type: 'doc', content: value.paragraphs.map(p => ({ type: 'paragraph', attrs: {
      textAlign: p.alignment, lineHeight: p.lineHeight, spaceBefore: p.spaceBefore, spaceAfter: p.spaceAfter,
    }, content: p.runs.flatMap(r => {
      const marks: NonNullable<TextBoxEditorNode['marks']> = r.presentation ? [{ type: 'textBoxStyle', attrs: { ...r.presentation } }] : [];
      marks.push(...r.emphasis.map(m => ({ type: reverseMarks[m]! })));
      return r.text.split('\n').flatMap((text,i) => [...(i ? [{ type: 'hardBreak' }] : []), ...(text ? [{ type: 'text', text, marks }] : [])]);
    }) })) };
    // Unknown additive members are preserved on open/save; explicit editing needs a loss notice.
    const known = (o: object, keys: string[]) => Object.keys(o).every(k => keys.includes(k));
    const loss = !known(value,['format','version','paragraphs']) || value.paragraphs.some(p => !known(p,['alignment','lineHeight','spaceBefore','spaceAfter','runs'])
      || p.runs.some(r => !known(r,['text','emphasis','presentation']) || (r.presentation && !known(r.presentation,['fontFamily','fontSize','color']))));
    return { document, diagnostics: loss ? ['text-box-unknown-fields'] : [] };
  }
  // Explicit legacy import adapter for existing unprofiled Studio documents.
  if (!record(value) || value.type !== 'doc' || !Array.isArray(value.content)) return fallback(content, ['text-box-legacy-unsupported-content']);
  const diagnostics = new Set<string>();
  if (value.content.length > 10000) diagnostics.add('text-box-unsupported-node');
  const visit = (node: unknown) => {
    if (!record(node)) { diagnostics.add('text-box-unsupported-node'); return; }
    if (!['doc','paragraph','text','hardBreak'].includes(String(node.type))) diagnostics.add('text-box-unsupported-node');
    if (Array.isArray(node.marks)) for (const m of node.marks) if (!record(m) || !(Object.hasOwn(markMap,String(m.type)) || m.type === 'textBoxStyle')) diagnostics.add('text-box-unsupported-mark');
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(value);
  return { document: value as unknown as TextBoxEditorNode, diagnostics: [...diagnostics] };
}

/** The caller must obtain informed consent before replacing a lossy/unknown view. */
export function editedTextBox(previous: OmiTextBox, document: TextBoxEditorNode): OmiTextBox {
  const loss = decodeTextBoxContent(previous.content, previous.contentProfile).diagnostics.length > 0;
  return { ...previous, content: encodeTextBoxContent(document), contentProfile: TEXT_BOX_CONTENT_PROFILE,
    ...(loss ? { extensions: { ...previous.extensions,
      [TEXT_BOX_SOURCE_EXTENSION]: previous.extensions?.[TEXT_BOX_SOURCE_EXTENSION] ?? {
        content: previous.content, ...(previous.contentProfile ? { contentProfile: previous.contentProfile } : {}),
      },
    } } : {}),
  };
}
