import { wordDirectFormatting, mergeWordDirectFormatting } from './docxDirectFormatting';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { parseWordHyperlinkInstruction, wordCharacterStyleSemantics } from '../model/docxImport';
import { noteBodyPlainText, type NoteJsonNode } from '../model/noteRichText';
import { normalizeExternalHref, normalizeInlineLanguageTag } from '../model/richText';

export interface ImportedNoteBody {
  body: string;
  bodyContent: string;
}

interface WordNoteArchive {
  has(path: string): boolean;
  text(path: string): Promise<string>;
}

type Mark = NonNullable<NoteJsonNode['marks']>[number];

/** Shared by the full and large-document importers: never flatten note runs. */
export async function readDocxNotes(archive: WordNoteArchive): Promise<{
  footnotes: Map<string, ImportedNoteBody>;
  endnotes: Map<string, ImportedNoteBody>;
}> {
  const styles = new Map<string, Element>();
  let defaults: Element | undefined;
  if (archive.has('word/styles.xml')) {
    const root = parseXml(await archive.text('word/styles.xml'));
    for (const style of descendants(root, 'style')) {
      const id = attr(style, 'styleId');
      if (id) styles.set(id, style);
    }
    defaults = descendants(root, 'rPrDefault')[0];
  }

  function styleMarks(id: string | undefined, inherited: Mark[], seen = new Set<string>()): Mark[] {
    if (!id || seen.has(id)) return inherited;
    seen.add(id);
    const style = styles.get(id);
    const marks = styleMarks(attr(child(style, 'basedOn'), 'val'), inherited, seen);
    const names: Record<string, string> = {
      strong: 'bold', emphasis: 'italic', underline: 'omiUnderline',
      'small-caps': 'omiSmallCaps', superscript: 'omiSuperscript',
      subscript: 'omiSubscript', strike: 'strike', code: 'code',
    };
    const semanticMarks = wordCharacterStyleSemantics(id, attr(child(style, 'name'), 'val'))
      .map((semantic) => ({ type: names[semantic] })).filter((mark) => Boolean(mark.type));
    return applyProperties(child(style, 'rPr'), mergeMarks(marks, semanticMarks));
  }

  async function read(kind: 'footnote' | 'endnote'): Promise<Map<string, ImportedNoteBody>> {
    const part = `word/${kind}s.xml`;
    const result = new Map<string, ImportedNoteBody>();
    if (!archive.has(part)) return result;
    const relationships = new Map<string, string>();
    const relsPart = `word/_rels/${kind}s.xml.rels`;
    if (archive.has(relsPart)) {
      for (const relationship of descendants(parseXml(await archive.text(relsPart)), 'Relationship')) {
        const id = attr(relationship, 'Id');
        const href = normalizeExternalHref(attr(relationship, 'Target'));
        if (id && href) relationships.set(id, href);
      }
    }

    for (const note of descendants(parseXml(await archive.text(part)), kind)) {
      const id = attr(note, 'id');
      if (!id || Number(id) < 1) continue;
      const content = descendants(note, 'p').map((paragraph): NoteJsonNode => {
        const base = styleMarks(attr(child(child(paragraph, 'pPr'), 'pStyle'), 'val'),
          applyProperties(child(defaults, 'rPr'), []));
        const inline: NoteJsonNode[] = [];
        const fields: Array<{ instruction: string; result: boolean }> = [];
        const visit = (element: Element, inherited: Mark[]): void => {
          // Keep cached field results, not instructions, deleted revisions or
          // Word's automatic note-number run (footnoteRef/endnoteRef).
          if (['del', 'moveFrom', 'rPr', 'pPr', 'footnoteRef', 'endnoteRef'].includes(element.localName ?? '')) return;
          if (element.localName === 'fldChar') {
            const kind = attr(element, 'fldCharType');
            if (kind === 'begin') fields.push({ instruction: '', result: false });
            else if (kind === 'separate' && fields.length) fields.at(-1)!.result = true;
            else if (kind === 'end') fields.pop();
            return;
          }
          if (element.localName === 'instrText') {
            if (fields.length) fields.at(-1)!.instruction += element.textContent ?? '';
            return;
          }
          let marks = inherited;
          if (element.localName === 'r') {
            const properties = child(element, 'rPr');
            marks = applyProperties(properties, styleMarks(attr(child(properties, 'rStyle'), 'val'), inherited));
          }
          if (element.localName === 'hyperlink') {
            const href = relationships.get(attr(element, 'id') ?? '');
            if (href) marks = mergeMarks(marks, [{ type: 'omiLink', attrs: { href } }]);
          }
          const instruction = element.localName === 'fldSimple'
            ? attr(element, 'instr')
            : [...fields].reverse().find((field) => field.result)?.instruction;
          const fieldHref = instruction ? normalizeExternalHref(parseWordHyperlinkInstruction(instruction)) : undefined;
          if (fieldHref) marks = mergeMarks(marks, [{ type: 'omiLink', attrs: { href: fieldHref } }]);
          if (element.localName === 't') {
            if (fields.some((field) => !field.result)) return;
            const text = element.textContent ?? '';
            if (text) inline.push({ type: 'text', text, ...(marks.length ? { marks } : {}) });
            return;
          }
          if (element.localName === 'tab') { inline.push({ type: 'text', text: '\t', ...(marks.length ? { marks } : {}) }); return; }
          if (element.localName === 'br' || element.localName === 'cr') { inline.push({ type: 'hardBreak' }); return; }
          for (const item of elements(element)) visit(item, marks);
        };
        for (const item of elements(paragraph)) visit(item, base);
        return { type: 'paragraph', content: inline };
      });
      const document: NoteJsonNode = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
      result.set(id, { body: noteBodyPlainText(document), bodyContent: JSON.stringify(document) });
    }
    return result;
  }

  return { footnotes: await read('footnote'), endnotes: await read('endnote') };
}

function applyProperties(properties: Element | undefined, inherited: Mark[]): Mark[] {
  let marks = [...inherited];
  for (const [property, type] of [
    ['b', 'bold'], ['i', 'italic'], ['u', 'omiUnderline'],
    ['strike', 'strike'], ['smallCaps', 'omiSmallCaps'],
  ]) {
    const item = child(properties, property!);
    if (!item) continue;
    marks = marks.filter((mark) => mark.type !== type);
    if (!/^(?:0|false|off|none)$/i.test(attr(item, 'val') ?? 'true')) marks.push({ type });
  }
  const vertical = child(properties, 'vertAlign');
  if (vertical) {
    marks = marks.filter((mark) => !['omiSuperscript', 'omiSubscript'].includes(mark.type ?? ''));
    const value = attr(vertical, 'val');
    if (value === 'superscript' || value === 'subscript') marks.push({ type: value === 'superscript' ? 'omiSuperscript' : 'omiSubscript' });
  }
  const lang = normalizeInlineLanguageTag(attr(child(properties, 'lang'), 'val'));
  if (lang) marks = mergeMarks(marks, [{ type: 'omiLanguage', attrs: { lang } }]);
  const fonts = child(properties, 'rFonts');
  const family = attr(fonts, 'ascii') ?? attr(fonts, 'hAnsi');
  if (family) marks = mergeMarks(marks, [{ type: 'omiSourceFont', attrs: { family } }]);
  return mergeWordDirectFormatting(marks, wordDirectFormatting(
    (property, attribute = 'val') => attr(child(properties, property), attribute),
    (property) => Boolean(child(properties, property)),
  ));
}

function mergeMarks(left: Mark[], right: Mark[]): Mark[] {
  const byType = new Map(left.map((mark) => [mark.type, mark]));
  right.forEach((mark) => byType.set(mark.type, mark));
  return [...byType.values()];
}

function parseXml(xml: string): Element {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) throw new Error('DOCX note XML declarations and entities are not supported.');
  const root = new DOMParser({ onError: () => { throw new Error('Invalid DOCX note XML.'); } }).parseFromString(xml, 'application/xml').documentElement;
  if (!root) throw new Error('Invalid DOCX note XML.');
  return root;
}

function elements(element: Element): Element[] {
  return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1);
}

function descendants(root: Element, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS('*', name));
}

function child(element: Element | undefined, name: string): Element | undefined {
  return element ? elements(element).find((item) => item.localName === name) : undefined;
}

function attr(element: Element | undefined, name: string): string | undefined {
  return element ? Array.from(element.attributes).find((item) => item.localName === name)?.value : undefined;
}
