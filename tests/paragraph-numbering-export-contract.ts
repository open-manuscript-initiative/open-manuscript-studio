import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { advancedCases, createAdvancedDocx } from './generate-advanced-formatting-fixtures.ts';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { readZipParts } from './docx-master-formatting-contract.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';
import { clonePublicationStyleTemplate } from '../src/services/publicationStyleExport.ts';

const strict = process.env.OMI_FORMATTING_STRICT === '1';
function todo(reason: string): string | false { return strict ? false : reason; }
function xml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml') as unknown as Document;
}
function elements(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(e => e.localName === local);
}
function attr(el: Element, name: string): string | undefined {
  return Array.from(el.attributes).find(a => a.localName === name)?.value;
}
function depth(el: Element, local: string): number {
  let result = 0;
  let current: Node | null = el;
  while (current) {
    if (current.nodeType === 1 && (current as Element).localName === local) result++;
    current = current.parentNode;
  }
  return result;
}

export function registerParagraphNumberingExportContracts(): void {
  test('L06: native imported three-level numbering remains nested in semantic exports', async t => {
    const item = advancedCases.find(c => c.id === 'L06')!;
    const plan = await parseDocxForStudio(new File([new Uint8Array(createAdvancedDocx(item))], 'L06.docx'));
    const manuscript = createTestManuscript();
    manuscript.sections = plan.sections;
    const html = renderHtmlArticle(manuscript).html;
    // Check containment, not just the presence of three unrelated lists.
    await t.test('HTML nesting', () => {
      assert.match(html, /<ol\b[^>]*>[\s\S]*?Level one[\s\S]*?<ol\b[^>]*>[\s\S]*?Level two[\s\S]*?<ol\b[^>]*>[\s\S]*?Level three[\s\S]*?<\/ol>[\s\S]*?<\/ol>[\s\S]*?<\/ol>/);
    });
    await t.test('JATS nesting', () => {
      const document = xml(renderJatsArticle(manuscript).xml);
      const lists = elements(document, 'list').filter(e => attr(e, 'list-type') === 'order' && e.textContent?.includes('Level three'));
      assert.ok(lists.some(e => depth(e, 'list') === 3));
    });
    await t.test('ODT nesting', () => {
      const document = xml(readZipParts(buildOdtExport(manuscript).bytes).get('content.xml')!.toString('utf8'));
      assert.ok(elements(document, 'list').some(e => depth(e, 'list') === 3 && e.textContent?.includes('Level three')));
    });
  });

  test('L07–L09: native DOCX numbering restart, custom label and Roman format are exact export requirements', async t => {
    for (const id of ['L07', 'L08', 'L09']) {
      const item = advancedCases.find(c => c.id === id)!;
      const plan = await parseDocxForStudio(new File([new Uint8Array(createAdvancedDocx(item))], id + '.docx'));
      const manuscript = createTestManuscript();
      manuscript.sections = plan.sections;
      const exported = readZipParts(buildDocxExport(manuscript).bytes);
      await t.test(id, { todo: todo('Native DOCX numbering definitions are not yet round-tripped') }, () => {
        const numbering = exported.get('word/numbering.xml');
        assert.ok(numbering, 'Missing native numbering part');
        const doc = xml(numbering.toString('utf8'));
        const body = xml(exported.get('word/document.xml')!.toString('utf8'));
        const paragraph = (sample: string) => elements(body, 'p').find(e => e.textContent?.includes(sample));
        const numberId = (sample: string) => {
          const p = paragraph(sample);
          assert.ok(p);
          const num = elements(p, 'numId')[0];
          assert.ok(num);
          return attr(num, 'val');
        };
        const level = (sample: string) => {
          const num = elements(doc, 'num').find(e => attr(e, 'numId') === numberId(sample));
          assert.ok(num);
          const abstractId = attr(elements(num, 'abstractNumId')[0]!, 'val');
          const abstract = elements(doc, 'abstractNum').find(e => attr(e, 'abstractNumId') === abstractId);
          assert.ok(abstract);
          const result = elements(abstract, 'lvl').find(e => attr(e, 'ilvl') === '0');
          assert.ok(result);
          return { num, result };
        };
        if (id === 'L07') {
          assert.notEqual(numberId('First'), numberId('Restart'));
          const { num, result } = level('Restart');
          const restart = elements(num, 'startOverride')[0] ?? elements(result, 'start')[0];
          assert.ok(restart && attr(restart, 'val') === '1');
        } else if (id === 'L08') {
          assert.equal(attr(elements(level('Custom item').result, 'lvlText')[0]!, 'val'), 'Article %1)');
        } else {
          assert.equal(attr(elements(level('Roman item').result, 'numFmt')[0]!, 'val'), 'upperRoman');
        }
      });
    }
  });

  test('S03/S04: IDML uses the assigned custom style and retains inheritance, next style and exact geometry', () => {
    const style = clonePublicationStyleTemplate();
    const body = style.paragraphStyles.defaultStyleId;
    style.paragraphStyles.items.push(
      { id: 'qa-base', name: 'Base QA', basedOnId: body, nextStyleId: body, properties: { alignment: 'justify', leftIndent: 25.4, lineHeight: 16, hyphenation: true } },
      { id: 'qa-derived', name: 'Derived QA', basedOnId: 'qa-base', nextStyleId: 'qa-base', properties: { alignment: 'center', firstLineIndent: -12.7, spaceAfter: 6, hyphenation: false } },
    );
    const manuscript = createTestManuscript();
    manuscript.sections[0]!.blocks[0]!.paragraphStyleId = 'qa-derived';
    const parts = readZipParts(buildIdmlExport(manuscript, style).bytes);
    const doc = xml(parts.get('Resources/Styles.xml')!.toString('utf8'));
    const styles = elements(doc, 'ParagraphStyle');
    const base = styles.find(e => attr(e, 'Self') === 'ParagraphStyle/qa-base')!;
    const derived = styles.find(e => attr(e, 'Self') === 'ParagraphStyle/qa-derived')!;
    assert.ok(base && derived);
    assert.equal(attr(base, 'Justification'), 'LeftJustified');
    assert.equal(Number(attr(base, 'LeftIndent')), 72);
    assert.equal(Number(attr(base, 'Leading')), 16);
    assert.equal(attr(base, 'Hyphenation'), 'true');
    assert.equal(attr(derived, 'Justification'), 'CenterAlign');
    assert.equal(Number(attr(derived, 'FirstLineIndent')), -36);
    assert.equal(Number(attr(derived, 'SpaceAfter')), 6);
    assert.equal(attr(derived, 'Hyphenation'), 'false');
    assert.equal(attr(derived, 'NextStyle'), 'ParagraphStyle/qa-base');
    assert.equal(elements(derived, 'BasedOn')[0]?.textContent, 'ParagraphStyle/qa-base');
    assert.ok([...parts].filter(([name]) => name.startsWith('Stories/')).some(([, bytes]) =>
      elements(xml(bytes.toString('utf8')), 'ParagraphStyleRange').some(e => attr(e, 'AppliedParagraphStyle') === 'ParagraphStyle/qa-derived' && e.textContent?.includes('Test paragraph.'))));
  });
}
