import { buildIdmlExport } from '../src/services/exportIdml.ts';
import assert from 'node:assert/strict';
import { MANUSCRIPT_IMPORT_ORIGIN } from '../src/model/manuscriptImportOrigin.ts';
import { parseOmiJson, parsePortableOmiState, toPortableOmiState } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { publicPublicationManuscript } from '../src/model/publicationAnnotations.ts';
import { commitManuscriptRevision, extractManuscriptState, revertManuscriptToRevision } from '../src/model/versioning.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { inspectOmiContainer } from '../src/services/omiContainerImport.ts';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readZipParts, registerMasterFormattingContract } from './docx-master-formatting-contract.ts';
import { registerAdvancedFormattingContracts } from './docx-advanced-formatting-contract.ts';
import { registerParagraphNumberingExportContracts } from './paragraph-numbering-export-contract.ts';

import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from '@xmldom/xmldom';

import { parseDocxManuscript, type DocxManuscriptImportPlan } from '../src/services/docxManuscriptImport.ts';
import { attachImportedDocumentSource, selfAuthoredExternalOrigin } from '../src/model/importedDocumentSource.ts';
import { applyDocxImportPlan } from '../src/app/docxImportActions.ts';
import { applyPdfImportResult } from '../src/app/pdfImportActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { buildContinuousManuscriptDocument, projectContinuousManuscriptDocument } from '../src/editor/continuousManuscriptDocument.ts';
import type { PdfImportResult } from '../src/services/pdfImport.ts';
import { parseDocxMonograph } from '../src/services/docxMonographImport.ts';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { parseOdtForStudio } from '../src/services/odtImport.ts';
import { registerFormattingExportContracts } from './formatting-export-contract.ts';

installXmlDomGlobals();
registerFormattingExportContracts();

test('does not create an undeletable synthetic heading for an untitled DOCX section', async () => {
  const file = makeDocx('<w:p><w:r><w:t>First imported paragraph</w:t></w:r></w:p>');

  const plan = await parseDocxManuscript(file);
  const section = plan.sections[0];

  assert.ok(section);
  assert.equal(section.title, '');
  assert.equal(blockText(section.blocks[0]!), 'First imported paragraph');

  const editorDocument = buildContinuousManuscriptDocument(plan.sections);
  assert.equal(editorDocument.content?.some((node) => node.type === 'heading'), false);

  const projectedSections = projectContinuousManuscriptDocument(editorDocument, plan.sections);
  assert.equal(projectedSections[0]?.title, '');
  assert.equal(projectedSections[0]?.blocks.length, 1);

  const legacySections = [{
    id: 'legacy-imported-section',
    title: 'Imported content',
    blocks: section.blocks,
  }];
  const legacyEditorDocument = buildContinuousManuscriptDocument(legacySections);
  legacyEditorDocument.content = legacyEditorDocument.content?.filter((node) => node.type !== 'heading');
  const afterLegacyHeadingDeletion = projectContinuousManuscriptDocument(legacyEditorDocument, legacySections);
  assert.equal(afterLegacyHeadingDeletion[0]?.title, '');
  assert.equal(afterLegacyHeadingDeletion[0]?.blocks.length, 1);
});

test('imports block content nested in Word content controls in document order', async () => {
  const file = makeDocx(`
    <w:p><w:r><w:t>Before control</w:t></w:r></w:p>
    <w:sdt>
      <w:sdtPr><w:alias w:val="Editorial content"/></w:sdtPr>
      <w:sdtContent>
        <w:p><w:r><w:t>Inside control</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Controlled cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        <w:sdt><w:sdtContent>
          <w:p><w:r><w:drawing><wp:inline>
            <wp:docPr id="1" name="Controlled image"/>
            <a:graphic><a:graphicData><a:blip r:embed="rIdImage"/></a:graphicData></a:graphic>
          </wp:inline></w:drawing></w:r></w:p>
        </w:sdtContent></w:sdt>
      </w:sdtContent>
    </w:sdt>
    <w:p><w:r><w:t>After control</w:t></w:r></w:p>
  `, {
    relationships: '<Relationship Id="rIdImage" Target="media/image.png"/>',
    entries: [{ name: 'word/media/image.png', bytes: new Uint8Array([137, 80, 78, 71]) }],
  });

  const plan = await parseDocxManuscript(file);
  const blocks = plan.sections.flatMap((section) => section.blocks);

  assert.deepEqual(blocks.map((block) => block.type), [
    'paragraph',
    'paragraph',
    'table',
    'image',
    'paragraph',
  ]);
  assert.deepEqual(blocks.filter((block) => block.type === 'paragraph').map(blockText), [
    'Before control',
    'Inside control',
    'After control',
  ]);
  assert.deepEqual(blocks[2]?.visual?.kind === 'table' ? blocks[2].visual.cells : [], [
    ['Controlled cell'],
  ]);
  assert.equal(plan.stats.tables, 1);
  assert.equal(plan.stats.images, 1);
  assert.ok(plan.warnings.some((item) => item.code === 'content-controls-flattened'));
});

test('preserves Word table header styling and paragraph boundaries inside cells', async () => {
  const file = makeDocx(`
    <w:tbl>
      <w:tblPr><w:tblLook w:firstRow="1"/></w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Column heading</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Source</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>1234</w:t></w:r></w:p></w:tc>
        <w:tc>
          <w:p><w:r><w:t>Primary record</w:t></w:r></w:p>
          <w:p><w:r><w:t>Additional note</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `);

  const plan = await parseDocxManuscript(file);
  const table = plan.sections.flatMap((section) => section.blocks)
    .find((block) => block.type === 'table');

  assert.equal(table?.visual?.kind, 'table');
  if (table?.visual?.kind !== 'table') return;
  assert.equal(table.visual.headerRows, 1);
  assert.deepEqual(table.visual.cells, [
    ['Column heading', 'Source'],
    ['1234', 'Primary record\nAdditional note'],
  ]);
});

test('preserves a paragraph that contains only a footnote reference', async () => {
  const file = makeDocx(
    '<w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p>',
    {
      footnotes: `
        <w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:footnote w:id="1"><w:p><w:r><w:t>Note-only paragraph body</w:t></w:r></w:p></w:footnote>
        </w:footnotes>`,
    },
  );

  const plan = await parseDocxManuscript(file);
  const blocks = plan.sections.flatMap((section) => section.blocks);
  const content = JSON.parse(blocks[0]?.content ?? '{}') as TiptapNode;

  assert.equal(plan.stats.notes, 1);
  assert.equal(plan.stats.paragraphs, 1);
  assert.equal(plan.annotations[0]?.body, 'Note-only paragraph body');
  assert.ok(findNodeTypes(content).includes('omiNote'));
});

test('preserves rich footnotes and endnotes in both Word import modes and OMI files', async () => {
  const formatted = `<w:p><w:r><w:footnoteRef/></w:r>
    <w:r><w:rPr><w:rStyle w:val="NoteEmphasis"/><w:b/></w:rPr><w:t>Styled note</w:t></w:r>
    <w:r><w:rPr><w:rStyle w:val="NoteEmphasis"/><w:i w:val="0"/></w:rPr><w:t xml:space="preserve"> plain</w:t></w:r>
    <w:r><w:rPr><w:u w:val="single"/><w:smallCaps/><w:strike/></w:rPr><w:t xml:space="preserve"> underlined</w:t></w:r>
    <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>
    <w:r><w:br/><w:t>New line</w:t><w:tab/><w:t>tab</w:t></w:r>
    <w:fldSimple w:instr='HYPERLINK "https://source.example/simple"'><w:r><w:t>Simple link</w:t></w:r></w:fldSimple>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK "https://source.example/complex"</w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Complex link</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:del><w:r><w:delText>Deleted text</w:delText></w:r></w:del>
    <w:r><w:instrText>HIDDEN INSTRUCTION</w:instrText></w:r>
    </w:p><w:p><w:hyperlink r:id="note-link"><w:r><w:t>Source link</w:t></w:r></w:hyperlink></w:p>`;
  const file = makeDocx('<w:p><w:r><w:t>Body</w:t><w:footnoteReference w:id="1"/><w:endnoteReference w:id="2"/></w:r></w:p>', {
    relationships: '<Relationship Id="note-link" Target="https://wrong-document-link.example/"/>',
    footnotes: `<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:footnote w:id="1">${formatted}</w:footnote></w:footnotes>`,
    entries: [
      textZipEntry('word/styles.xml', '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="BaseNote"><w:rPr><w:i/></w:rPr></w:style><w:style w:styleId="NoteEmphasis"><w:basedOn w:val="BaseNote"/></w:style></w:styles>'),
      textZipEntry('word/endnotes.xml', '<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:endnote w:id="2"><w:p><w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>End note</w:t></w:r></w:p></w:endnote></w:endnotes>'),
      textZipEntry('word/_rels/footnotes.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="note-link" Target="https://source.example/note" TargetMode="External"/></Relationships>'),
    ],
  });
  for (const parse of [parseDocxManuscript, parseDocxMonograph, parseDocxForStudio]) {
    const plan = await parse(file);
    assert.equal(plan.annotations.length, 2);
    const note = plan.annotations.find((item) => item.noteKind === 'footnote')!;
    const doc = JSON.parse(note.bodyContent!);
    const textNodes = findNodes(doc, 'text') as Array<{ text: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }>;
    const marksFor = (text: string) => textNodes.find((item) => item.text === text)?.marks ?? [];
    assert.deepEqual(marksFor('Styled note').map((mark) => mark.type), ['italic', 'bold']);
    assert.deepEqual(marksFor(' plain'), []);
    assert.deepEqual(marksFor(' underlined').map((mark) => mark.type), ['omiUnderline', 'strike', 'omiSmallCaps']);
    assert.equal(marksFor('2')[0]?.type, 'omiSuperscript');
    assert.deepEqual(marksFor('Source link'), [{ type: 'omiLink', attrs: { href: 'https://source.example/note' } }]);
    assert.deepEqual(marksFor('Simple link'), [{ type: 'omiLink', attrs: { href: 'https://source.example/simple' } }]);
    assert.deepEqual(marksFor('Complex link'), [{ type: 'omiLink', attrs: { href: 'https://source.example/complex' } }]);
    assert.equal(doc.content.length, 2);
    assert.ok(findNodeTypes(doc).includes('hardBreak'));
    assert.match(note.body, /New line\ttabSimple linkComplex link\nSource link$/);
    assert.doesNotMatch(note.body, /Deleted|HIDDEN/);
    assert.equal(JSON.parse(plan.annotations.find((item) => item.noteKind === 'endnote')!.bodyContent!).content[0].content[0].marks[0].type, 'omiSubscript');
    const manuscript = { ...useStudioStore.getState().manuscript, title: plan.title, sections: plan.sections, annotations: plan.annotations };
    const restored = parseOmiJson(serializeOmiJson(manuscript));
    assert.equal(restored.annotations[0]?.bodyContent, note.bodyContent);
  }
});

test('keeps Word footnote IDs and marker order across an XE field', async () => {
  const file = makeDocx(`
    <w:p>
      <w:r><w:t>Greek text: ἱεράρχης </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r>
      <w:r><w:instrText xml:space="preserve"> XE "Jézus" </w:instrText></w:r>
      <w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:r><w:t xml:space="preserve">and then</w:t></w:r>
      <w:r><w:footnoteReference w:id="14"/></w:r>
      <w:r><w:t xml:space="preserve">; final note</w:t></w:r>
      <w:r><w:footnoteReference w:id="8"/></w:r>
    </w:p>
  `, {
    footnotes: `
      <w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:footnote w:id="14"><w:p><w:r><w:t>Word note fourteen.</w:t></w:r></w:p></w:footnote>
        <w:footnote w:id="12"><w:p><w:r><w:t>Unreferenced note.</w:t></w:r></w:p></w:footnote>
      </w:footnotes>`,
  });

  const plan = await parseDocxManuscript(file);
  const block = plan.sections.flatMap((section) => section.blocks)[0];
  const content = JSON.parse(block?.content ?? '{}') as TiptapNode;
  const noteMarkers = findNodes(content, 'omiNote');

  assert.equal(plan.stats.notes, 2);
  assert.deepEqual(noteMarkers.map((node) => node.attrs?.label), ['1', '2']);
  assert.deepEqual(plan.annotations.map((annotation) => annotation.body), [
    'Word note fourteen.',
    '',
  ]);
  assert.ok(plan.warnings.some((item) => item.code === 'missing-note-body'));
  assert.equal(blockText(block), 'Greek text: ἱεράρχης and then; final note');
});

test('does not classify a paragraph with a Word note marker as a heading', async () => {
  const file = makeDocx(`
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Heading with a note</w:t></w:r>
      <w:r><w:footnoteReference w:id="14"/></w:r>
    </w:p>
  `, {
    footnotes: `
      <w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:footnote w:id="14"><w:p><w:r><w:t>Heading note body.</w:t></w:r></w:p></w:footnote>
      </w:footnotes>`,
  });

  for (const parse of [parseDocxManuscript, parseDocxMonograph]) {
    const plan = await parse(file);
    const block = plan.sections.flatMap((section) => section.blocks)
      .find((item) => item.type === 'paragraph');
    const content = JSON.parse(block?.content ?? '{}') as TiptapNode;

    assert.equal(plan.stats.notes, 1);
    assert.equal(plan.annotations[0]?.body, 'Heading note body.');
    assert.equal(findNodes(content, 'omiNote')[0]?.attrs?.label, '1');
  }
});

test('flattens text-box paragraphs into the editable main text flow', async () => {
  const file = makeDocx(`
    <w:p>
      <w:r><w:pict><v:shape><v:textbox><w:txbxContent>
        <w:p><w:r><w:t>First text box</w:t></w:r></w:p>
      </w:txbxContent></v:textbox></v:shape></w:pict></w:r>
      <w:r><w:pict><v:shape><v:textbox><w:txbxContent>
        <w:p><w:r><w:t>Second text box</w:t></w:r></w:p>
      </w:txbxContent></v:textbox></v:shape></w:pict></w:r>
    </w:p>
  `);

  const plan = await parseDocxManuscript(file);
  const block = plan.sections.flatMap((section) => section.blocks)[0];
  const content = JSON.parse(block?.content ?? '{}') as TiptapNode;

  assert.equal(blockText(block), 'First text boxSecond text box');
  assert.equal(findNodeTypes(content).filter((type) => type === 'hardBreak').length, 1);
  assert.ok(plan.warnings.some((item) => item.code === 'text-boxes-flattened'));
});

test('large-document mode also preserves note-only paragraphs', async () => {
  const file = makeDocx(
    '<w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p>',
    {
      footnotes: `
        <w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:footnote w:id="1"><w:p><w:r><w:t>Large-mode note body</w:t></w:r></w:p></w:footnote>
        </w:footnotes>`,
    },
  );

  const plan = await parseDocxMonograph(file);
  const block = plan.sections.flatMap((section) => section.blocks)[0];

  assert.equal(plan.stats.notes, 1);
  assert.equal(plan.stats.paragraphs, 1);
  assert.equal(plan.annotations[0]?.body, 'Large-mode note body');
  assert.ok(findNodeTypes(JSON.parse(block?.content ?? '{}') as TiptapNode).includes('omiNote'));
});

test('large-document mode flattens text boxes before matching paragraphs', async () => {
  const file = makeDocx(`
    <w:p>
      <w:r><w:pict><v:shape><v:textbox><w:txbxContent>
        <w:p><w:r><w:t>First large text box</w:t></w:r></w:p>
      </w:txbxContent></v:textbox></v:shape></w:pict></w:r>
      <w:r><w:pict><v:shape><v:textbox><w:txbxContent>
        <w:p><w:r><w:t>Second large text box</w:t></w:r></w:p>
      </w:txbxContent></v:textbox></v:shape></w:pict></w:r>
    </w:p>
  `);

  const plan = await parseDocxMonograph(file);
  const block = plan.sections.flatMap((section) => section.blocks)[0];

  assert.equal(blockText(block), 'First large text boxSecond large text box');
  assert.equal(plan.stats.paragraphs, 1);
  assert.ok(plan.warnings.some((item) => item.code === 'text-boxes-flattened'));
});

test('one Studio import reads the immutable DOCX package only once', async () => {
  const source = makeDocx('<w:p><w:r><w:t>Single buffered read</w:t></w:r></w:p>');
  const readSource = source.arrayBuffer.bind(source);
  let reads = 0;
  const counted = new Proxy(source, {
    get(target, property) {
      if (property === 'arrayBuffer') {
        return async () => {
          reads += 1;
          return readSource();
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  const plan = await parseDocxForStudio(counted);

  assert.equal(reads, 1);
  assert.equal(plan.stats.paragraphs, 1);
});

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
}

interface ExtraDocxParts {
  relationships?: string;
  footnotes?: string;
  entries?: Array<{ name: string; bytes: Uint8Array }>;
}

function makeDocx(body: string, extras: ExtraDocxParts = {}): File {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
      xmlns:v="urn:schemas-microsoft-com:vml">
      <w:body>${body}</w:body>
    </w:document>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      ${extras.relationships ?? ''}
    </Relationships>`;
  const entries = [
    textZipEntry('word/document.xml', documentXml),
    textZipEntry('word/_rels/document.xml.rels', relationships),
    ...(extras.footnotes ? [textZipEntry('word/footnotes.xml', extras.footnotes)] : []),
    ...(extras.entries ?? []),
  ];
  const bytes = createStoreZip(entries);
  return new File([bytes], 'fidelity-fixture.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function blockText(block: { content?: string } | undefined): string {
  if (!block?.content) return '';
  return collectText(JSON.parse(block.content) as TiptapNode);
}

function collectText(node: TiptapNode): string {
  return (node.text ?? '') + (node.content ?? []).map(collectText).join('');
}

function findNodeTypes(node: TiptapNode): string[] {
  return [node.type, ...(node.content ?? []).flatMap(findNodeTypes)].filter(
    (value): value is string => Boolean(value),
  );
}

function findNodes(node: TiptapNode, type: string): TiptapNode[] {
  return [
    ...(node.type === type ? [node] : []),
    ...(node.content ?? []).flatMap((child) => findNodes(child, type)),
  ];
}

function installXmlDomGlobals(): void {
  const globals = globalThis as typeof globalThis & {
    DOMParser: typeof DOMParser;
    XMLSerializer: typeof XMLSerializer;
  };
  globals.DOMParser = XmlDomParser as unknown as typeof DOMParser;
  globals.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer;

  const probeDocument = new XmlDomParser().parseFromString('<root><child/></root>', 'application/xml');
  const elementPrototype = Object.getPrototypeOf(probeDocument.documentElement) as object;
  if (!Object.getOwnPropertyDescriptor(elementPrototype, 'children')) {
    Object.defineProperty(elementPrototype, 'children', {
      configurable: true,
      get(this: { childNodes: ArrayLike<{ nodeType: number }> }) {
        return Array.from(this.childNodes).filter((node) => node.nodeType === 1);
      },
    });
  }

  const documentPrototype = Object.getPrototypeOf(probeDocument) as object;
  if (!Object.getOwnPropertyDescriptor(documentPrototype, 'querySelector')) {
    Object.defineProperty(documentPrototype, 'querySelector', {
      configurable: true,
      value(this: { getElementsByTagName(name: string): ArrayLike<unknown> }, selector: string) {
        return Array.from(this.getElementsByTagName(selector))[0] ?? null;
      },
    });
  }
}

test('converted manuscript source is visible without replacing imported structure', () => {
  const sections = [{
    id: 'section-1', title: 'Synthetic study',
    blocks: [
      { id: 'heading-1', type: 'heading', content: 'Synthetic study' },
      { id: 'body-1', type: 'paragraph', content: 'Research text' },
    ],
  }];
  const result = attachImportedDocumentSource(sections, 'Public manuscript DOI:10.0000/example', 'Source', () => 'source-1');
  assert.deepEqual(result[0]?.blocks.map((block) => block.id), ['heading-1', 'source-1', 'body-1']);
  assert.match(result[0]!.blocks[1]!.content, /Source: Public manuscript DOI:10.0000\/example/);
  assert.deepEqual(sections[0]!.blocks.map((block) => block.id), ['heading-1', 'body-1']);
  assert.throws(() => attachImportedDocumentSource(sections, '   ', 'Source'), /requires a source/);
});

test('self-authored object-origin helper uses a hidden marker without exposing a filename', () => {
  const sections = [{
    id: 'section-1', title: 'Synthetic study',
    blocks: [{ id: 'body-1', type: 'paragraph', content: 'Research text' }],
  }];
  const annotation = selfAuthoredExternalOrigin(sections, '2026-10-09T00:00:00.000Z', () => 'origin-1');
  assert.equal(annotation.type, 'semantic');
  assert.equal(annotation.targetBlockId, 'body-1');
  assert.equal(annotation.targetText, 'omi:source-origin');
  assert.equal(annotation.body, 'author-declared:self-authored-outside-omi');
  assert.equal(annotation.renderingHint, 'hidden');
  assert.equal(sections[0]!.blocks.length, 1);
  assert.equal(JSON.stringify(annotation).includes('/home/'), false);
  assert.throws(() => selfAuthoredExternalOrigin([], '2026-10-09T00:00:00.000Z'), /no content/);
});

test('self-authored manuscript import does not anchor a hidden source marker to the first heading', async () => {
  const previous = useStudioStore.getState();
  try {
    const plan = {
      fileName: 'own-manuscript.docx',
      title: 'Imported manuscript',
      titleSource: 'title-style',
      locale: 'hu',
      keywords: [],
      authors: [{ givenName: 'Synthetic', familyName: 'Author', displayName: 'Synthetic Author' }],
      sections: [{
        id: 'imported-section',
        title: 'Első címsor',
        blocks: [
          { id: 'opening-heading', type: 'heading', content: 'Első címsor' },
          { id: 'body', type: 'paragraph', content: 'Szövegtörzs' },
        ],
      }],
      annotations: [],
      bibliographicRecords: [],
      citations: [],
      citationClusters: [],
      stats: {},
      warnings: [],
    } as unknown as DocxManuscriptImportPlan;

    applyDocxImportPlan(plan, { importDetectedAuthors: true, source: '', selfAuthoredExternal: true });
    const imported = useStudioStore.getState().manuscript;
    assert.deepEqual(imported.sections[0]?.blocks.map((block) => block.id), ['opening-heading', 'body']);
    assert.equal(imported.annotations.some((annotation) => annotation.targetBlockId === 'opening-heading'), false);
    assert.equal(imported.annotations.some((annotation) => annotation.targetText === 'omi:source-origin'), false);

    const editorDocument = buildContinuousManuscriptDocument(imported.sections);
    editorDocument.content = editorDocument.content?.filter((node) => node.type !== 'heading');
    const afterDelete = projectContinuousManuscriptDocument(editorDocument, imported.sections);
    assert.equal(afterDelete[0]?.blocks.some((block) => block.id === 'opening-heading'), false);
    const origin = imported.extensions?.[MANUSCRIPT_IMPORT_ORIGIN];
    assert.deepEqual(origin, {
      version: 1, sourceFormat: 'docx', importedAt: imported.createdAt,
      assertion: 'author-declared:self-authored-outside-omi',
    });
    // Editing/deleting every imported block and changing document/section titles
    // does not remove provenance or create a dangling content relationship.
    const edited = {
      ...imported, title: 'Rewritten title',
      sections: [{ ...imported.sections[0]!, title: '', blocks: [{ id: crypto.randomUUID(), type: 'paragraph' as const, content: 'Completely rewritten' }] }],
    };
    const reopened = parseOmiJson(serializeOmiJson(edited));
    assert.deepEqual(reopened.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
    assert.deepEqual(imported.revisionHistory.revisions[0]?.snapshot.state.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
    const committed = commitManuscriptRevision(imported, extractManuscriptState(edited), {
      summary: 'Replace imported content', timestamp: new Date().toISOString(),
      events: [{ operation: 'manuscript.title.set', targetId: imported.id, path: '/title', previousValue: imported.title, nextValue: edited.title }],
    });
    assert.deepEqual(committed.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
    const reverted = revertManuscriptToRevision(committed, imported.headRevisionId, { timestamp: new Date().toISOString() });
    assert.deepEqual(reverted.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
    const container = await buildOmiContainer(committed);
    assert.equal(container.validForExport, true, JSON.stringify(container.diagnostics));
    const containerImport = await inspectOmiContainer(container.bytes);
    assert.equal(containerImport.validForImport, true, JSON.stringify(containerImport.diagnostics));
    assert.deepEqual(containerImport.manuscript?.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);

    applyDocxImportPlan({ ...plan, fileName: 'own-manuscript.odt' }, { importDetectedAuthors: false, source: '', selfAuthoredExternal: true });
    const odt = useStudioStore.getState().manuscript;
    assert.equal((odt.extensions?.[MANUSCRIPT_IMPORT_ORIGIN] as { sourceFormat: string }).sourceFormat, 'odt');
    assert.equal(odt.annotations.some((annotation) => annotation.targetText === 'omi:source-origin'), false);
    assert.equal(reopened.sections[0]?.blocks[0]?.content, 'Completely rewritten');
    const snapshot = parsePortableOmiState(JSON.parse(JSON.stringify(toPortableOmiState(extractManuscriptState(reopened)))));
    assert.deepEqual(snapshot.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
    assert.equal(JSON.stringify(origin).includes('own-manuscript.docx'), false);
    assert.equal(publicPublicationManuscript(reopened).extensions?.[MANUSCRIPT_IMPORT_ORIGIN], undefined);
    assert.deepEqual(reopened.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], origin);
  } finally {
    useStudioStore.setState(previous);
  }
});

test('self-authored PDF import leaves the opening heading free of source annotations', () => {
  const previous = useStudioStore.getState();
  try {
    const result = {
      source: { fileName: 'own-manuscript.pdf' },
      title: 'Imported manuscript',
      blocks: [
        { kind: 'heading', headingLevel: 1, text: 'Első címsor' },
        { kind: 'paragraph', text: 'Szövegtörzs' },
      ],
      warnings: [],
    } as unknown as PdfImportResult;

    applyPdfImportResult(result, '', true);
    const imported = useStudioStore.getState().manuscript;
    const openingHeading = imported.sections[0]?.blocks[0];
    assert.equal((imported.extensions?.[MANUSCRIPT_IMPORT_ORIGIN] as { sourceFormat: string }).sourceFormat, 'pdf');
    assert.equal(openingHeading?.type, 'heading');
    assert.equal(imported.annotations.some((annotation) => annotation.targetBlockId === openingHeading?.id), false);
    assert.equal(imported.annotations.some((annotation) => annotation.targetText === 'omi:source-origin'), false);
  } finally {
    useStudioStore.setState(previous);
  }
});

for (const format of ['docx', 'odt', 'pdf'] as const) {
  test(`${format} import distinguishes editorial work, own-work attribution and citation without adding headings or numbering`, async () => {
    const previous = useStudioStore.getState();
    try {
      const plan = await parseDocxForStudio(makeDocx('<w:p><w:r><w:t>Opening paragraph without a heading</w:t></w:r></w:p>'));
      const pdf = {
        source: { fileName: 'manuscript.pdf' }, title: 'Manuscript', warnings: [],
        blocks: [{ kind: 'paragraph', text: 'Opening paragraph without a heading', page: 1, confidence: 1 }],
      } as unknown as PdfImportResult;
      const apply = (source: string, options: import('../src/model/documentImportMode.ts').DocumentImportSourceOptions) => {
        if (format === 'pdf') applyPdfImportResult(pdf, source, options);
        else applyDocxImportPlan({ ...plan, fileName: `manuscript.${format}` }, { importDetectedAuthors: false, source, ...options });
        return useStudioStore.getState().manuscript;
      };
      for (const importMode of ['editorial', 'own-work'] as const) {
        // A retained filename or checked source toggle cannot leak into editorial text.
        const imported = apply('PRIVATE_FILENAME', { importMode, includeSource: importMode === 'editorial' });
        assert.equal(imported.sectionNumberingStyle, 'none');
        assert.equal(imported.sections[0]?.title, '');
        assert.equal(JSON.stringify(imported.sections).includes('PRIVATE_FILENAME'), false);
        assert.equal(Boolean(imported.extensions?.[MANUSCRIPT_IMPORT_ORIGIN]), importMode === 'own-work');
        const editor = buildContinuousManuscriptDocument(imported.sections);
        assert.equal(editor.content?.[0]?.type, 'paragraph');
        const projected = projectContinuousManuscriptDocument(editor, imported.sections);
        assert.equal(buildContinuousManuscriptDocument(projected).content?.some(n => n.type === 'heading'), false);
        const reopened = parseOmiJson(serializeOmiJson(imported));
        assert.equal(buildContinuousManuscriptDocument(reopened.sections).content?.[0]?.type, 'paragraph');
      }
      const ownWithSource = apply('My earlier edition', { importMode: 'own-work', includeSource: true });
      assert.match(ownWithSource.sections[0]!.blocks[0]!.content, /My earlier edition/);
      assert.ok(ownWithSource.extensions?.[MANUSCRIPT_IMPORT_ORIGIN]);
      assert.throws(() => apply('', { importMode: 'own-work', includeSource: true }), /requires a source/);
      assert.throws(() => apply('', { importMode: 'citation', includeSource: false }), /requires a source/);
      const cited = apply('External edition', { importMode: 'citation' });
      assert.match(cited.sections[0]!.blocks[0]!.content, /External edition/);
      assert.equal(cited.extensions?.[MANUSCRIPT_IMPORT_ORIGIN], undefined);
    } finally { useStudioStore.setState(previous); }
  });
}

test('import defaults follow author and editorial workflow roles', async () => {
  const { defaultDocumentImportMode } = await import('../src/model/documentImportMode.ts');
  for (const role of ['editor', 'copyeditor', 'layout-editor'] as const) assert.equal(defaultDocumentImportMode(role), 'editorial');
  assert.equal(defaultDocumentImportMode('author'), 'own-work');
  assert.equal(defaultDocumentImportMode('general'), 'citation');
});

for (const format of ['docx', 'odt'] as const) {
  for (const hasNamedSection of [false, true]) {
    test(`${format} export/reimport preserves a paragraph opening with named section: ${hasNamedSection}`, async () => {
      // Use the same heading-free source as the browser regression. A generic
      // scholarly profile still numbers real headings, but an untitled body
      // container must not turn into an empty/number-only heading on export.
      const manuscript = createBlankManuscript({ kind: 'study', locale: 'en', title: 'Test manuscript' });
      manuscript.sections = [{ id: 'opening', title: '', blocks: [{ id: 'body', type: 'paragraph', content: 'Opening body paragraph.' }] }];
      if (hasNamedSection) manuscript.sections.push({ id: 'methods', title: 'Methods', blocks: [{ id: 'methods-body', type: 'paragraph', content: 'Methods text.' }] });
      const exported = format === 'docx' ? buildDocxExport(manuscript) : buildOdtExport(manuscript);
      const file = new File([exported.bytes], `candidate.${format}`);
      const plan = await (format === 'docx' ? parseDocxForStudio(file) : parseOdtForStudio(file));
      assert.equal(plan.sections[0]?.title, '');
      const editor = buildContinuousManuscriptDocument(plan.sections);
      assert.equal(editor.content?.[0]?.type, 'paragraph');
      assert.match(JSON.stringify(editor), /Opening body paragraph/);
      const headings = editor.content?.filter(node => node.type === 'heading') ?? [];
      assert.equal(headings.length, hasNamedSection ? 1 : 0);
      if (hasNamedSection) assert.match(JSON.stringify(headings[0]), /Methods/);
    });
  }
}


// The canonical Word fixture is deliberately independent of Studio's exporter.
const masterFixture = new URL('./fixtures/omi-formatting-master-test.docx', import.meta.url);
const masterManifest = JSON.parse(readFileSync(new URL('./fixtures/omi-formatting-test-manifest.json', import.meta.url), 'utf8')) as {
  version: string;
  cases: Array<{ id: string; feature: string; sample?: string; checks?: string[] }>;
  default_checks: string[];
};
const exactMasterMarks: Record<string, { type: string; attrs?: Record<string, unknown> }> = {
  C01: { type: 'bold' },
  C02: { type: 'italic' },
  C03: { type: 'omiUnderline' },
  C07: { type: 'strike' },
  C09: { type: 'omiSmallCaps' },
  C11: { type: 'omiSuperscript' },
  C12: { type: 'omiSubscript' },
  C18: { type: 'omiSourceFont', attrs: { family: 'Liberation Mono' } },
};

test('master formatting fixture declares all 65 distinct cases and five checks', () => {
  assert.equal(masterManifest.version, '1.0');
  assert.equal(masterManifest.cases.length, 65);
  assert.equal(new Set(masterManifest.cases.map(item => item.id)).size, 65);
  for (const item of masterManifest.cases) {
    assert.match(item.id, /^[A-Z][0-9]{2}$/);
    assert.deepEqual(item.checks ?? masterManifest.default_checks, ['import', 'edit', 'remove_or_reset', 'save_reopen', 'export_supported_formats']);
  }
});

function openMasterFixture(): File {
  return new File([new Uint8Array(readFileSync(masterFixture))], 'omi-formatting-master-test.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

type MasterTextNode = TiptapNode & { marks?: Array<{ type: string; attrs?: Record<string, unknown> }> };
function masterSampleNodes(sections: DocxManuscriptImportPlan['sections'], id: string, sample: string): MasterTextNode[] {
  for (const block of sections.flatMap(section => section.blocks)) {
    if (!block.content.includes(id + ' |')) continue;
    let node: TiptapNode;
    try { node = JSON.parse(block.content) as TiptapNode; } catch { continue; }
    if (!collectText(node).includes(id + ' |')) continue;
    return (findNodes(node, 'text') as MasterTextNode[]).filter(item => item.text?.includes(sample));
  }
  return [];
}

function hasMasterMark(nodes: MasterTextNode[], expected: { type: string; attrs?: Record<string, unknown> }): boolean {
  return nodes.some(node => node.marks?.some(mark => mark.type === expected.type
    && Object.entries(expected.attrs ?? {}).every(([key, value]) => mark.attrs?.[key] === value)));
}

test('imports supported master-fixture marks and preserves them through OMI save/reopen', async (t) => {
  const plan = await parseDocxForStudio(openMasterFixture());
  const manuscript = { ...createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Formatting master' }), sections: plan.sections, annotations: plan.annotations };
  const reopened = parseOmiJson(serializeOmiJson(manuscript));
  for (const item of masterManifest.cases.filter(item => exactMasterMarks[item.id])) {
    await t.test(item.id + ' ' + item.feature, () => {
      const expected = exactMasterMarks[item.id]!;
      assert.ok(hasMasterMark(masterSampleNodes(plan.sections, item.id, item.sample!), expected), 'Imported sample is missing the expected mark');
      assert.ok(hasMasterMark(masterSampleNodes(reopened.sections, item.id, item.sample!), expected), 'OMI save/reopen lost the mark');
    });
  }
});

test('DOCX export/reimport retains compound formatting and imported source typeface', async () => {
  const file = makeDocx('<w:p><w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:smallCaps/><w:rFonts w:ascii="Liberation Mono" w:hAnsi="Liberation Mono"/></w:rPr><w:t>Compound formatting</w:t></w:r></w:p>');
  const original = await parseDocxForStudio(file);
  const manuscript = { ...createBlankManuscript({ kind: 'study', locale: 'en', title: 'Compound formatting test' }), sections: original.sections };
  const exported = buildDocxExport(manuscript);
  const roundtrip = await parseDocxForStudio(new File([new Uint8Array(exported.bytes)], 'roundtrip.docx'));
  for (const plan of [original, roundtrip]) {
    const block = plan.sections.flatMap(section => section.blocks).find(block => block.content.includes('Compound formatting'));
    assert.ok(block);
    const nodes = findNodes(JSON.parse(block.content), 'text') as MasterTextNode[];
    for (const mark of [{ type: 'bold' }, { type: 'italic' }, { type: 'omiUnderline' }, { type: 'omiSmallCaps' }, { type: 'omiSourceFont', attrs: { family: 'Liberation Mono' } }]) {
      assert.ok(hasMasterMark(nodes, mark), 'Missing ' + mark.type);
    }
  }
});

test('inline enrichment retains formatted manual breaks, tabs and external hyperlinks', async () => {
  const file = makeDocx(
    '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>First line</w:t><w:br/><w:t>Second line</w:t><w:tab/><w:t>Value</w:t></w:r></w:p>'
    + '<w:p><w:hyperlink r:id="rIdLink"><w:r><w:rPr><w:i/></w:rPr><w:t>Linked source</w:t></w:r></w:hyperlink></w:p>',
    { relationships: '<Relationship Id="rIdLink" Target="https://example.org/source" TargetMode="External"/>' },
  );
  const plan = await parseDocxForStudio(file);
  const blocks = plan.sections.flatMap(section => section.blocks);
  const first = blocks.find(block => block.content.includes('First line'));
  const second = blocks.find(block => block.content.includes('Linked source'));
  assert.ok(first && second);
  const firstDoc = JSON.parse(first.content) as MasterTextNode;
  const secondDoc = JSON.parse(second.content) as MasterTextNode;
  assert.ok(findNodeTypes(firstDoc).includes('hardBreak'));
  assert.ok(collectText(firstDoc).includes('\t'));
  const textNodes = findNodes(firstDoc, 'text') as MasterTextNode[];
  assert.ok(hasMasterMark(textNodes.filter(node => node.text?.includes('First line')), { type: 'bold' }));
  assert.ok(hasMasterMark(textNodes.filter(node => node.text?.includes('Second line')), { type: 'bold' }));
  const linkNodes = findNodes(secondDoc, 'text') as MasterTextNode[];
  assert.ok(hasMasterMark(linkNodes, { type: 'italic' }));
  assert.ok(hasMasterMark(linkNodes, { type: 'omiLink', attrs: { href: 'https://example.org/source' } }));
});

registerMasterFormattingContract();
registerAdvancedFormattingContracts();

registerParagraphNumberingExportContracts();


test('DOCX to ODT retains compound typography, language and paragraph geometry after ODT reimport', async () => {
  const source = makeDocx('<w:p><w:pPr><w:spacing w:before="160" w:after="240" w:line="360" w:lineRule="auto"/><w:ind w:left="360" w:right="120" w:hanging="120"/><w:jc w:val="both"/></w:pPr>'
    + '<w:r><w:rPr><w:b/><w:i/><w:smallCaps/><w:u w:val="double"/><w:sz w:val="32"/><w:color w:val="A02040"/><w:spacing w:val="30"/><w:rFonts w:ascii="Liberation Serif"/><w:lang w:val="de-DE"/></w:rPr><w:t>Compound specimen</w:t></w:r>'
    + '<w:r><w:rPr><w:vertAlign w:val="superscript"/><w:highlight w:val="yellow"/></w:rPr><w:t>SUPSPEC</w:t></w:r>'
    + '<w:r><w:rPr><w:vertAlign w:val="subscript"/><w:shd w:val="clear" w:fill="B7DEE8"/></w:rPr><w:t>SUBSPEC</w:t></w:r></w:p>');
  const plan = await parseDocxForStudio(source);
  const manuscript = { ...createBlankManuscript({ kind: 'study', locale: 'en', title: 'ODT typography regression' }), sections: plan.sections };
  const result = buildOdtExport(manuscript);
  const parts = readZipParts(result.bytes);
  const xml = parts.get('content.xml')!.toString('utf8');
  const doc = new XmlDomParser().parseFromString(xml, 'application/xml');
  const elements = (name: string) => Array.from(doc.getElementsByTagNameNS('*', name));
  const styleFor = (tag: string, value: string) => {
    const node = elements(tag).find(item => item.textContent?.includes(value) && item.hasAttribute('text:style-name'));
    assert.ok(node, 'Missing styled specimen ' + value);
    const style = elements('style').find(item => item.getAttribute('style:name') === node.getAttribute('text:style-name'));
    assert.ok(style, 'Missing definition for ' + value);
    const props = Array.from(style.children)[0];
    assert.ok(props);
    return props;
  };
  const main = styleFor('span', 'Compound specimen');
  for (const [key, value] of Object.entries({
    'fo:font-weight': 'bold', 'fo:font-style': 'italic', 'fo:font-variant': 'small-caps',
    'style:text-underline-type': 'double', 'fo:font-size': '16pt', 'fo:color': '#A02040',
    'fo:letter-spacing': '1.5pt', 'fo:font-family': 'Liberation Serif', 'fo:language': 'de', 'fo:country': 'DE',
  })) assert.equal(main.getAttribute(key), value, key);
  assert.equal(styleFor('span', 'SUPSPEC').getAttribute('style:text-position'), 'super 58%');
  assert.equal(styleFor('span', 'SUBSPEC').getAttribute('style:text-position'), 'sub 58%');
  const paragraph = styleFor('p', 'Compound specimen');
  for (const [key, value] of Object.entries({
    'fo:text-align': 'justify', 'fo:margin-left': '18pt', 'fo:margin-right': '6pt',
    'fo:text-indent': '-6pt', 'fo:margin-top': '8pt', 'fo:margin-bottom': '12pt', 'fo:line-height': '150%',
  })) assert.equal(paragraph.getAttribute(key), value, key);
  const reopened = await parseOdtForStudio(new File([new Uint8Array(result.bytes)], 'roundtrip.odt'));
  const block = reopened.sections.flatMap(section => section.blocks).find(block => block.content.includes('Compound specimen'))!;
  assert.ok(block);
  const root = JSON.parse(block.content);
  const nodes = findNodes(root, 'text') as MasterTextNode[];
  const marks = (sample: string, expected: Array<{ type: string; attrs?: Record<string, unknown> }>) => {
    for (const mark of expected) assert.ok(hasMasterMark(nodes.filter(node => node.text?.includes(sample)), mark), 'Missing ' + mark.type + ' on ' + sample);
  };
  marks('Compound specimen', [
    {type:'bold'}, {type:'italic'}, {type:'omiSmallCaps'}, {type:'omiUnderline',attrs:{variant:'double'}},
    {type:'omiFontSize',attrs:{value:16}}, {type:'omiTextColor',attrs:{value:'#A02040'}}, {type:'omiTracking',attrs:{value:1.5}},
    {type:'omiSourceFont',attrs:{family:'Liberation Serif'}}, {type:'omiLanguage',attrs:{lang:'de-DE'}},
  ]);
  marks('SUPSPEC', [{type:'omiSuperscript'}, {type:'omiHighlight',attrs:{value:'yellow'}}]);
  marks('SUBSPEC', [{type:'omiSubscript'}, {type:'omiCharacterBackground',attrs:{value:'#B7DEE8'}}]);
  const attrs = root.content[0].attrs;
  assert.deepEqual(attrs, { omiAlign:'justify', omiLeftIndent:18, omiRightIndent:6, omiFirstLineIndent:-6,
    omiSpaceBefore:8, omiSpaceAfter:12, omiLineRule:'auto', omiLineSpacing:1.5 });
});

test('IDML native local typography points, tracking, scaling and color resources are attached to the actual run', async () => {
  const source = makeDocx('<w:p><w:pPr><w:spacing w:line="360" w:lineRule="exact"/><w:ind w:left="240"/><w:jc w:val="right"/></w:pPr>'
    + '<w:r><w:rPr><w:sz w:val="40"/><w:spacing w:val="20"/><w:position w:val="6"/><w:w w:val="90"/><w:color w:val="A02040"/><w:caps/></w:rPr><w:t>IDMLSPECIMEN</w:t></w:r></w:p>');
  const plan = await parseDocxForStudio(source);
  const manuscript = { ...createBlankManuscript({ kind:'study', locale:'en', title:'IDML typography regression' }), sections:plan.sections };
  const parts = readZipParts(buildIdmlExport(manuscript).bytes);
  const story = [...parts].find(([name]) => name.startsWith('Stories/'))![1];
  const document = new XmlDomParser().parseFromString(story.toString('utf8'), 'application/xml');
  const range = Array.from(document.getElementsByTagName('CharacterStyleRange')).find(node => node.textContent === 'IDMLSPECIMEN')!;
  assert.ok(range);
  for (const [key,value] of Object.entries({ PointSize:'20', Tracking:'50', BaselineShift:'3', HorizontalScale:'90', Capitalization:'AllCaps', FillColor:'Color/OMI-A02040' })) assert.equal(range.getAttribute(key),value,key);
  const parent = range.parentNode as unknown as Element;
  for (const [key,value] of Object.entries({ LeftIndent:'12', Leading:'18', Justification:'RightAlign' })) assert.equal(parent.getAttribute(key),value,key);
  const colors = new XmlDomParser().parseFromString(parts.get('Resources/Graphic.xml')!.toString('utf8'),'application/xml');
  const color = Array.from(colors.getElementsByTagName('Color')).find(node => node.getAttribute('Self') === range.getAttribute('FillColor'))!;
  assert.ok(color);
  assert.equal(color.getAttribute('Space'),'RGB');
  assert.equal(color.getAttribute('ColorValue'),'160 32 64');
});


test('P12–P14 native ODT paragraph decoration and tab-stop roundtrip', async () => {
  const file = makeDocx('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:color="74243B" w:space="4"/></w:pBdr><w:shd w:val="clear" w:fill="E2EFDA"/><w:tabs><w:tab w:val="right" w:pos="6803" w:leader="dot"/></w:tabs></w:pPr><w:r><w:t>Decoration specimen</w:t><w:tab/><w:t>123</w:t></w:r></w:p>');
  const plan = await parseDocxForStudio(file);
  const manuscript = {...createBlankManuscript({kind:'study',locale:'en',title:'Paragraph decorations'}),sections:plan.sections};
  const odt = buildOdtExport(manuscript);
  const parts = readZipParts(odt.bytes);
  const doc = new XmlDomParser().parseFromString(parts.get('content.xml')!.toString('utf8'),'application/xml');
  const paragraph = Array.from(doc.getElementsByTagName('text:p')).find(el=>el.textContent?.includes('Decoration specimen'))!;
  assert.ok(paragraph);
  const style = Array.from(doc.getElementsByTagName('style:style')).find(el=>el.getAttribute('style:name')===paragraph.getAttribute('text:style-name'))!;
  assert.ok(style);
  const props=style.getElementsByTagName('style:paragraph-properties').item(0)!;
  assert.equal(props.getAttribute('fo:background-color'),'#E2EFDA');
  assert.equal(props.getAttribute('fo:border-bottom'),'1pt solid #74243B');
  assert.equal(props.getAttribute('fo:padding-bottom'),'4pt');
  const tab=props.getElementsByTagName('style:tab-stop').item(0)!;
  assert.equal(tab.getAttribute('style:position'),'340.15pt');
  assert.equal(tab.getAttribute('style:type'),'right');
  assert.equal(tab.getAttribute('style:leader-text'),'.');
  assert.equal(paragraph.getElementsByTagName('text:tab').length,1);
  const reopened=await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'decorations.odt'));
  const block=reopened.sections.flatMap(s=>s.blocks).find(b=>b.content.includes('Decoration specimen'))!;
  assert.ok(block);
  const root=JSON.parse(block.content);
  assert.equal(root.content[0].attrs.omiParagraphBackground,'#E2EFDA');
  assert.equal(root.content[0].attrs.omiParagraphBorders,JSON.stringify({bottom:{style:'single',width:1,color:'#74243B',space:4}}));
  assert.equal(root.content[0].attrs.omiParagraphTabs,JSON.stringify([{position:340.15,alignment:'right',leader:'dot'}]));
});

test('paragraph decoration attributes reject invalid colors, CSS and duplicated tab stops', async () => {
  const {normalizeParagraphValue,paragraphFormattingCss,paragraphFormattingWordXml}=await import('../src/model/directParagraphFormatting.ts');
  assert.equal(normalizeParagraphValue('omiParagraphBackground','#000000;display:none'),undefined);
  assert.equal(normalizeParagraphValue('omiParagraphBorders',{bottom:{style:'single',width:1,color:'"><bad/>',space:4}}),undefined);
  assert.equal(normalizeParagraphValue('omiParagraphTabs',[{position:72,alignment:'left',leader:'none'},{position:72,alignment:'right',leader:'dot'}]),undefined);
  assert.equal(paragraphFormattingCss({omiParagraphBackground:'#000000;display:none'},'html'),'');
  assert.equal(paragraphFormattingWordXml({omiParagraphBackground:'"><bad/>'}),'');
});
