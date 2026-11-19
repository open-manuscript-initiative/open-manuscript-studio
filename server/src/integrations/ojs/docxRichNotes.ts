import { DOMParser, type Element } from '@xmldom/xmldom';

interface NoteJsonNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: NoteJsonNode[];
}

type Mark = NonNullable<NoteJsonNode['marks']>[number];

/** Server-side DOCX notes retain rich content throughout the OJS launch payload. */
export function extractRichDocxNotes(
  xml: string, kind: 'footnote' | 'endnote', stylesXml?: string, relationshipsXml?: string,
): Array<{ id: string; text: string; bodyContent: string }> {
  const styles = new Map<string, Element>();
  let defaults: Element | undefined;
  if (stylesXml) {
    const root = parseXml(stylesXml);
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
      .flatMap((semantic): Mark[] => names[semantic] ? [{ type: names[semantic]! }] : []);
    return applyProperties(child(style, 'rPr'), mergeMarks(marks, semanticMarks));
  }

  function read(): Array<{ id: string; text: string; bodyContent: string }> {
    const result: Array<{ id: string; text: string; bodyContent: string }> = [];
    const relationships = new Map<string, string>();
    if (relationshipsXml) {
      for (const relationship of descendants(parseXml(relationshipsXml), 'Relationship')) {
        const id = attr(relationship, 'Id');
        const href = normalizeExternalHref(attr(relationship, 'Target'));
        if (id && href) relationships.set(id, href);
      }
    }

    for (const note of descendants(parseXml(xml), kind)) {
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
      result.push({ id, text: noteBodyPlainText(document), bodyContent: JSON.stringify(document) });
    }
    return result;
  }

  return read();
}

function applyProperties(properties: Element | undefined, inherited: Mark[]): Mark[] {
  let marks = [...inherited];
  for (const [property, type] of [
    ['b', 'bold'], ['i', 'italic'], ['u', 'omiUnderline'],
    ['strike', 'strike'], ['dstrike', 'strike'], ['smallCaps', 'omiSmallCaps'],
  ]) {
    const item = child(properties, property!);
    if (!item) continue;
    marks = marks.filter((mark) => mark.type !== type);
    if (!/^(?:0|false|off|none)$/i.test(attr(item, 'val') ?? 'true')) marks.push({ type: type! });
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
  return marks;
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

function wordCharacterStyleSemantics(
  styleId: string | undefined,
  styleName: string | undefined,
): string[] {
  const value = [styleId, styleName]
    .filter((item): item is string => Boolean(item?.trim()))
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (!value) return [];

  const result: string[] = [];
  if (/(?:^|\W)(?:strong|bold|fett|felkover)(?:\W|$)/.test(value)) result.push('strong');
  if (/(?:emphasis|emphasized|italic|italics|kursiv|dolt)/.test(value)) result.push('emphasis');
  if (/(?:small\s*caps?|smallcaps|kiskapitalis|kapitalchen)/.test(value)) result.push('small-caps');
  if (/(?:underline|underlined|unterstrichen|alahuz)/.test(value)) result.push('underline');
  if (/(?:strikethrough|strike|durchgestrichen|athuz)/.test(value)) result.push('strike');
  if (/(?:superscript|hochgestellt|felso\s*index)/.test(value)) result.push('superscript');
  if (/(?:subscript|tiefgestellt|also\s*index)/.test(value)) result.push('subscript');
  if (/(?:source\s*code|inline\s*code|monospace|code|quellcode|kod)/.test(value)) result.push('code');
  return Array.from(new Set(result));
}

function parseWordHyperlinkInstruction(
  instruction: string | undefined,
): string | undefined {
  const input = (instruction ?? '').replace(/\s+/g, ' ').trim();
  const match = /^HYPERLINK\s+(?:"([^"]+)"|'([^']+)'|([^\s\\]+))/i.exec(input);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

function normalizeExternalHref(
  value: string | undefined,
): string | undefined {
  const input = (value ?? '').trim();
  if (!input) return undefined;

  const candidate = /^(https?:|mailto:)/i.test(input)
    ? input
    : `https://${input}`;

  try {
    const url = new URL(candidate);
    const protocol = url.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:') {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Normalizes a BCP 47 language tag without restricting manuscript authors to
 * the three Studio UI languages.
 */
function normalizeInlineLanguageTag(
  value: string | undefined,
): string | undefined {
  const input = (value ?? '').trim();
  if (!input) return undefined;

  try {
    const [canonical] = Intl.getCanonicalLocales(input);
    return canonical;
  } catch {
    return undefined;
  }
}


function noteBodyPlainText(node: NoteJsonNode): string {
  const text = (current: NoteJsonNode): string => {
    if (current.type === 'text') return current.text ?? '';
    if (current.type === 'hardBreak') return '\n';
    return (current.content ?? []).map(text).join('') + (current.type === 'paragraph' ? '\n' : '');
  };
  return text(node).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
