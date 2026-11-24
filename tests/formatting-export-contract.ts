import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { parseOdtForStudio } from '../src/services/odtImport.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

type Mark = { type: string; attrs?: Record<string, unknown> };
type RichNode = { type?: string; text?: string; marks?: Mark[]; content?: RichNode[] };
const cases = [
  { id: 'C01', mark: 'bold', html: 'strong', jats: 'bold', idml: 'Strong', odt: 'OMIStrong', odtProperty: ['font-weight', 'bold'], idmlProperty: ['FontStyle', 'Bold'] },
  { id: 'C02', mark: 'italic', html: 'em', jats: 'italic', idml: 'Emphasis', odt: 'OMIEmphasis', odtProperty: ['font-style', 'italic'], idmlProperty: ['FontStyle', 'Italic'] },
  { id: 'C03', mark: 'omiUnderline', html: 'u', jats: 'underline', idml: 'Underline', odt: 'OMIUnderline', odtProperty: ['text-underline-style', 'solid'], idmlProperty: ['Underline', 'true'] },
  { id: 'C07', mark: 'strike', html: 'del', jats: 'strike', idml: 'Strike', odt: 'OMIStrike', odtProperty: ['text-line-through-style', 'solid'], idmlProperty: ['StrikeThru', 'true'] },
  { id: 'C09', mark: 'omiSmallCaps', html: 'span', jats: 'sc', idml: 'Small Caps', odt: null, odtProperty: ['font-variant', 'small-caps'], idmlProperty: ['Capitalization', 'SmallCaps'] },
  { id: 'C11', mark: 'omiSuperscript', html: 'sup', jats: 'sup', idml: 'Superscript', odt: null, odtProperty: ['text-position', 'super'], idmlProperty: ['Position', 'Superscript'] },
  { id: 'C12', mark: 'omiSubscript', html: 'sub', jats: 'sub', idml: 'Subscript', odt: null, odtProperty: ['text-position', 'sub'], idmlProperty: ['Position', 'Subscript'] },
];
const sample = 'Árvíztűrő tükörfúrógép – Manuscript 123';
const strict = process.env.OMI_FORMATTING_STRICT === '1';
function todo(reason: string): string | false { return strict ? false : reason; }

// These two exporters use stored ZIP entries (no compression/data descriptors).
// Read their actual emitted XML rather than searching for XML in binary bytes.
function storedParts(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const parts = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0, 'Expected stored ZIP entry');
    assert.equal(buffer.readUInt16LE(offset + 6) & 8, 0, 'Unexpected descriptor');
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    assert.ok(start + size <= buffer.length, 'Truncated ZIP part');
    parts.set(name, buffer.toString('utf8', start, start + size));
    offset = start + size;
  }
  assert.ok(parts.size > 0);
  return parts;
}
function xml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml') as unknown as Document;
}
function elements(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(el => el.localName === local);
}
function attr(el: Element, local: string): string | undefined {
  return Array.from(el.attributes).find(a => a.localName === local)?.value;
}
function part(parts: Map<string, string>, name: string): string {
  const result = parts.get(name);
  assert.ok(result, 'Missing ' + name);
  return result;
}
function nodes(node: RichNode): RichNode[] { return [node, ...(node.content ?? []).flatMap(nodes)]; }
function textContent(node: RichNode): string {
  return node.type === 'hardBreak' ? '\n' : (node.text ?? '') + (node.content ?? []).map(textContent).join('');
}
function hasProperty(el: Element, name: string, value: string): boolean {
  return [el, ...Array.from(el.getElementsByTagName('*'))].some(child => {
    const actual = attr(child, name);
    return actual === value || (name === 'text-position' && actual?.startsWith(value + ' '))
      || (child.localName === name && child.textContent === value);
  });
}
function assertIdmlStyle(parts: Map<string, string>, text: string, style: string, property: string[]): void {
  const stories = [...parts].filter(([name]) => /^Stories\/.*\.xml$/.test(name)).map(([, source]) => xml(source));
  const ranges = stories.flatMap(story => elements(story, 'CharacterStyleRange')).filter(el =>
    attr(el, 'AppliedCharacterStyle') === 'CharacterStyle/OMI ' + style);
  assert.ok(ranges.some(range => range.textContent?.includes(text)), 'Sample does not use the required IDML style');
  const styles = xml(part(parts, 'Resources/Styles.xml'));
  const definition = elements(styles, 'CharacterStyle').find(el => attr(el, 'Name') === 'OMI ' + style);
  assert.ok(definition && hasProperty(definition, property[0]!, property[1]!), 'Missing actual IDML style property');
}
function assertOdtStyle(parts: Map<string, string>, text: string, property: string[], expectedStyle?: string): void {
  const content = xml(part(parts, 'content.xml'));
  const styles = [content, xml(part(parts, 'styles.xml'))].flatMap(doc => elements(doc, 'style'));
  // Adjacent runs with identical formatting may be merged, including the bold case label.
  const spans = elements(content, 'span').filter(el => el.textContent?.includes(text));
  assert.ok(spans.some(span => {
    const name = attr(span, 'style-name');
    if (expectedStyle && name !== expectedStyle) return false;
    return styles.some(style => attr(style, 'name') === name && hasProperty(style, property[0]!, property[1]!));
  }), 'Sample does not have the required ODT text property');
}

export function registerFormattingExportContracts(): void {
  test('canonical imported marks have explicit cross-format rendering contracts', async t => {
    const bytes = readFileSync(new URL('./fixtures/omi-formatting-master-test.docx', import.meta.url));
    const plan = await parseDocxForStudio(new File([new Uint8Array(bytes)], 'omi-formatting-master-test.docx'));
    const blocks = plan.sections.flatMap(section => section.blocks);
    const specimen = (id: string) => {
      const block = blocks.find(b => b.content.includes(id + ' |'));
      assert.ok(block, 'Missing imported case ' + id);
      const manuscript = createTestManuscript();
      manuscript.sections = [{ id: 'case-section', title: 'Case ' + id, blocks: [structuredClone(block)] }];
      return manuscript;
    };
    for (const item of cases) {
      const manuscript = specimen(item.id);
      const html = renderHtmlArticle(manuscript).html;
      const jats = renderJatsArticle(manuscript).xml;
      const print = buildPdfPrintDocument(manuscript);
      const odtResult = buildOdtExport(manuscript);
      const odt = storedParts(odtResult.bytes);
      const idml = storedParts(buildIdmlExport(manuscript).bytes);
      // In C01 the fixture label and sample are both bold. An exporter may
      // combine their adjacent identical runs. Accept either boundary, but
      // still require the entire sample to be inside the exact semantic tag.
      const markedSample = (tag: string, attributes = '') => [sample, ...(item.id === 'C01' ? ['C01 | Félkövér – ' + sample] : [])]
        .map(text => '<' + tag + attributes + '>' + text + '</' + tag + '>');
      const htmlSamples = markedSample(item.html, item.id === 'C09' ? ' style="font-variant:small-caps"' : '');
      const jatsSamples = markedSample(item.jats);
      await t.test(item.id + ' HTML5 exact sample markup', () => assert.ok(htmlSamples.some(value => html.includes(value))));
      await t.test(item.id + ' JATS exact sample markup', () => assert.ok(jatsSamples.some(value => jats.includes(value))));
      await t.test(item.id + ' PDF print HTML exact sample markup', () => assert.ok(htmlSamples.some(value => print.includes(value))));
      await t.test(item.id + ' IDML applied style and definition', () => assertIdmlStyle(idml, sample, item.idml, item.idmlProperty));
      await t.test(item.id + ' ODT applied style and reimport', { todo: item.odt ? false : todo('Exact ODT small caps or vertical position remains an acceptance gap') }, async () => {
        assertOdtStyle(odt, sample, item.odtProperty, item.odt ?? undefined);
        const reimport = await parseOdtForStudio(new File([new Uint8Array(odtResult.bytes)], 'case.odt'));
        const candidates = reimport.sections.flatMap(section => section.blocks).flatMap(block => {
          try { return nodes(JSON.parse(block.content) as RichNode); } catch { return []; }
        });
        assert.ok(candidates.some(n => n.text?.includes(sample) && n.marks?.some(m => m.type === item.mark)), 'ODT roundtrip lost the mark');
      });
    }

    const languages = [
      ['N01', 'hu-HU', 'Árvíztűrő tükörfúrógép'],
      ['N02', 'de-DE', 'Überlieferung und Quellenkritik'],
      ['N03', 'en-GB', 'Scholarly publishing'],
      ['N04', 'el-GR', 'Ελληνικά'],
      ['N05', 'he-IL', 'שלום עולם'],
      ['N06', 'ar-SA', 'مرحبا بالعالم'],
    ];
    for (const [id, lang, text] of languages) {
      const manuscript = specimen(id!);
      await t.test(id + ' HTML, JATS and PDF source language annotation', () => {
        const htmlSample = '<span lang="' + lang + '">' + text + '</span>';
        assert.ok(renderHtmlArticle(manuscript).html.includes(htmlSample));
        assert.ok(renderJatsArticle(manuscript).xml.includes('<named-content xml:lang="' + lang + '">' + text + '</named-content>'));
        assert.ok(buildPdfPrintDocument(manuscript).includes(htmlSample));
      });
      await t.test(id + ' IDML applied language on the sample', () => {
        const parts = storedParts(buildIdmlExport(manuscript).bytes);
        const ranges = [...parts].filter(([name]) => /^Stories\/.*\.xml$/.test(name)).flatMap(([, source]) => elements(xml(source), 'CharacterStyleRange'));
        assert.equal(ranges.filter(el => attr(el, 'AppliedLanguage') === lang).map(el => el.textContent).join('').includes(text!), true);
      });
      await t.test(id + ' ODT language reimport', { todo: todo('ODT export does not yet preserve the inline language mark') }, async () => {
        const result = buildOdtExport(manuscript);
        const plan = await parseOdtForStudio(new File([new Uint8Array(result.bytes)], 'language.odt'));
        const candidates = plan.sections.flatMap(s => s.blocks).flatMap(b => {
          try { return nodes(JSON.parse(b.content) as RichNode); } catch { return []; }
        });
        assert.ok(candidates.some(n => n.text?.includes(text!) && n.marks?.some(m => m.type === 'omiLanguage' && m.attrs?.lang === lang)));
      });
    }

    await t.test('N09 native line-break mapping in HTML, PDF source and ODT', async () => {
      const manuscript = specimen('N09');
      const html = renderHtmlArticle(manuscript).html;
      assert.match(html, /Első sor<br>Második sor/);
      assert.match(buildPdfPrintDocument(manuscript), /Első sor<br>Második sor/);
      const odt = buildOdtExport(manuscript);
      assert.match(part(storedParts(odt.bytes), 'content.xml'), /Első sor<text:line-break\/>Második sor/);
      const plan = await parseOdtForStudio(new File([new Uint8Array(odt.bytes)], 'break.odt'));
      assert.ok(plan.sections.flatMap(s => s.blocks).some(b => {
        try { return textContent(JSON.parse(b.content) as RichNode).includes('Első sor\nMásodik sor'); } catch { return false; }
      }));
    });
    await t.test('N09 JATS keeps the line-break character without inventing a visual layout', () => {
      const source = renderJatsArticle(specimen('N09')).xml;
      assert.ok(elements(xml(source), 'p').some(p => p.textContent?.includes('Első sor\nMásodik sor')), 'Decoded XML paragraph must preserve the exact line break');
    });
  });
}
