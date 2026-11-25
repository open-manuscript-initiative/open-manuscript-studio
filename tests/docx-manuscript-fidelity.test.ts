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


test('named character styles preserve identity, inherited color, and cancellation across DOCX reopen', async () => {
  const styles = '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:style w:type="character" w:styleId="SourceBase"><w:name w:val="Source base"/><w:rPr><w:color w:val="246B70"/></w:rPr></w:style>'
    + '<w:style w:type="character" w:styleId="SourceAccent"><w:name w:val="Source accent"/><w:basedOn w:val="SourceBase"/><w:rPr><w:i/></w:rPr></w:style></w:styles>';
  const source = makeDocx('<w:p><w:r><w:rPr><w:rStyle w:val="SourceAccent"/></w:rPr><w:t>Source accent specimen</w:t></w:r>'
    + '<w:r><w:rPr><w:rStyle w:val="SourceAccent"/><w:i w:val="0"/></w:rPr><w:t> Plain override specimen</w:t></w:r></w:p>',
    { entries:[textZipEntry('word/styles.xml',styles)] });
  const plan=await parseDocxForStudio(source);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Source styles regression'}),sections:plan.sections};
  const inspect=(sections:typeof plan.sections)=>{
    const block=sections.flatMap(section=>section.blocks).find(b=>b.content.includes('Source accent specimen'));
    assert.ok(block);
    const nodes=findNodes(JSON.parse(block.content),'text');
    const accent=nodes.find(n=>n.text==='Source accent specimen');
    const plain=nodes.find(n=>n.text===' Plain override specimen');
    assert.ok(accent&&plain);
    for(const node of [accent,plain]) {
      const mark=node.marks?.find(m=>m.type==='omiWordCharacterStyle');
      assert.ok(mark);
      const bundle=JSON.parse(String(mark.attrs?.definition));
      assert.equal(bundle.selected,'SourceAccent');
      assert.equal(bundle.styles.find((style:{id:string})=>style.id==='SourceAccent').basedOn,'SourceBase');
      assert.equal(node.marks?.find(m=>m.type==='omiTextColor')?.attrs?.value,'#246B70');
    }
    assert.ok(accent.marks?.some(m=>m.type==='italic'));
    assert.ok(!plain.marks?.some(m=>m.type==='italic'));
  };
  inspect(plan.sections);
  const result=buildDocxExport(manuscript);
  const parts=readZipParts(result.bytes);
  const document=new XmlDomParser().parseFromString(parts.get('word/document.xml')!.toString('utf8'),'application/xml');
  const run=Array.from(document.getElementsByTagName('w:r')).find(el=>el.textContent===' Plain override specimen')!;
  assert.ok(run);
  assert.equal(run.getElementsByTagName('w:rStyle').item(0)?.getAttribute('w:val'),'SourceAccent');
  assert.equal(run.getElementsByTagName('w:i').item(0)?.getAttribute('w:val'),'0');
  const exportedStyles=new XmlDomParser().parseFromString(parts.get('word/styles.xml')!.toString('utf8'),'application/xml');
  const accent=Array.from(exportedStyles.getElementsByTagName('w:style')).find(el=>el.getAttribute('w:styleId')==='SourceAccent')!;
  assert.ok(accent);
  assert.equal(accent.getElementsByTagName('w:basedOn').item(0)?.getAttribute('w:val'),'SourceBase');
  const reopened=await parseDocxForStudio(new File([new Uint8Array(result.bytes)],'source-styles.docx'));
  inspect(reopened.sections);
});

test('source style normalization rejects unsafe IDs and resolves inheritance cycles deterministically', async () => {
  const {normalizeSourceStyle,resolveSourceStyle}=await import('../src/model/sourceWordStyles.ts');
  assert.equal(normalizeSourceStyle({selected:'"><bad/>',styles:[]}),undefined);
  const bundle={selected:'A',styles:[{id:'A',name:'A',kind:'paragraph',basedOn:'B',italic:true},{id:'B',name:'B',kind:'paragraph',basedOn:'A',bold:true}]};
  assert.deepEqual(resolveSourceStyle(bundle),{bold:true,italic:true});
});


test('hidden Word text survives editable notes and is removed from public note bodies without changing the original', async () => {
  const source=makeDocx('<w:p><w:r><w:t>Public paragraph</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>',{
    footnotes:'<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="1"><w:p><w:r><w:t xml:space="preserve">Visible note </w:t></w:r><w:r><w:rPr><w:vanish/></w:rPr><w:t>HIDDEN-NOTE-SPECIMEN</w:t></w:r><w:r><w:rPr><w:vanish w:val="0"/></w:rPr><w:t>VISIBLE-OVERRIDE</w:t></w:r></w:p></w:footnote></w:footnotes>',
  });
  const plan=await parseDocxForStudio(source);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Hidden note regression'}),sections:plan.sections,annotations:plan.annotations};
  const note=manuscript.annotations.find(a=>a.noteKind==='footnote')!;
  assert.ok(note);
  assert.match(note.bodyContent??'',/omiHiddenText/);
  assert.match(note.body,/HIDDEN-NOTE-SPECIMEN/);
  const snapshot=JSON.stringify(manuscript);
  const projected=publicPublicationManuscript(manuscript);
  const publicNote=projected.annotations.find(a=>a.id===note.id)!;
  assert.ok(publicNote);
  assert.ok(!publicNote.body.includes('HIDDEN-NOTE-SPECIMEN'));
  assert.ok(!publicNote.bodyContent?.includes('HIDDEN-NOTE-SPECIMEN'));
  assert.match(publicNote.body,/VISIBLE-OVERRIDE/);
  assert.equal(JSON.stringify(manuscript),snapshot);
  const docx=buildDocxExport(manuscript);
  const parts=readZipParts(docx.bytes);
  assert.match(parts.get('word/footnotes.xml')!.toString('utf8'),/<w:vanish\/>/);
  assert.match(parts.get('word/footnotes.xml')!.toString('utf8'),/HIDDEN-NOTE-SPECIMEN/);
  assert.ok(docx.warnings.some(warning=>warning.includes('Hidden formatting is not redaction')));
});

test('DOCX roundtrip retains consecutive header rows, explicit off and both quarter-turns', async () => {
  const cell=(text:string,rotation='')=>'<w:tc>'+(rotation?'<w:tcPr><w:textDirection w:val="'+rotation+'"/></w:tcPr>':'')+'<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>';
  const row=(left:string,right:string,header:string)=>'<w:tr>'+header+left+right+'</w:tr>';
  const source=makeDocx('<w:p><w:r><w:t>Table specimen</w:t></w:r></w:p><w:tbl>'
    +row(cell('First header','btLr'),cell('Header B'),'<w:trPr><w:tblHeader/></w:trPr>')
    +row(cell('Second header','tbRl'),cell('Header D'),'<w:trPr><w:tblHeader w:val="1"/></w:trPr>')
    +row(cell('Body A'),cell('Body B'),'<w:trPr><w:tblHeader w:val="0"/></w:trPr>')
    +row(cell('Body C'),cell('Body D'),'<w:trPr><w:tblHeader/></w:trPr>')+'</w:tbl>');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const visual=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(visual?.kind==='table');
    assert.equal(visual.headerRows,2);
    assert.deepEqual(visual.cellFormats,{'0:0':{textRotation:-90},'1:0':{textRotation:90}});
    assert.deepEqual(visual.cells,[['First header','Header B'],['Second header','Header D'],['Body A','Body B'],['Body C','Body D']]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Native table regression'}),sections:plan.sections};
  const exported=buildDocxExport(manuscript);
  const xml=new XmlDomParser().parseFromString(readZipParts(exported.bytes).get('word/document.xml')!.toString('utf8'),'application/xml');
  const table=xml.getElementsByTagName('w:tbl').item(0);
  assert.ok(table);
  assert.equal(table.getElementsByTagName('w:tblHeader').length,2);
  assert.equal(table.getElementsByTagName('w:tr').length,4);
  assert.equal(table.getElementsByTagName('w:tc').length,8);
  const reopened=await parseDocxForStudio(new File([new Uint8Array(exported.bytes)],'native-table.docx'));
  inspect(reopened.sections);
});

test('native rectangular merged cells survive DOCX reopening without duplicating text', async () => {
  const tc=(text:string,props='')=>'<w:tc><w:tcPr>'+props+'</w:tcPr><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>';
  const row=(cells:string)=>'<w:tr>'+cells+'</w:tr>';
  const span='<w:gridSpan w:val="2"/>';
  const source=makeDocx('<w:p><w:r><w:t>Merge specimen</w:t></w:r></w:p><w:tbl>'
    +row(tc('Anchor',span+'<w:vMerge w:val="restart"/>')+tc('A'))
    +row(tc('',span+'<w:vMerge/>')+tc('B'))+'</w:tbl>');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cellMerges,[{row:0,column:0,rowSpan:2,colSpan:2}]);
    assert.deepEqual(v.cells,[['Anchor','','A'],['','','B']]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Merged cells'}),sections:plan.sections};
  const output=buildDocxExport(manuscript);
  const parts=readZipParts(output.bytes);
  const doc=new XmlDomParser().parseFromString(parts.get('word/document.xml')!.toString('utf8'),'application/xml');
  const table=doc.getElementsByTagName('w:tbl').item(0);
  assert.ok(table);
  assert.equal(table.getElementsByTagName('w:tc').length,4);
  assert.equal(table.getElementsByTagName('w:gridSpan').length,2);
  assert.equal(table.getElementsByTagName('w:vMerge').length,2);
  inspect((await parseDocxForStudio(new File([new Uint8Array(output.bytes)],'merged.docx'))).sections);
  const odtResult=buildOdtExport(manuscript);
  const odt=readZipParts(odtResult.bytes).get('content.xml')!.toString('utf8');
  inspect((await parseOdtForStudio(new File([new Uint8Array(odtResult.bytes)],'merged.odt'))).sections);
  assert.match(odt,/table:number-rows-spanned="2" table:number-columns-spanned="2"/);
  assert.equal((odt.match(/<table:covered-table-cell\/>/g)??[]).length,3);
});

test('Word and ODT preserve row pagination policies including explicit off and missing Word properties', async () => {
  const row=(text:string,props='')=>'<w:tr>'+(props?'<w:trPr>'+props+'</w:trPr>':'')+'<w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc></w:tr>';
  const source=makeDocx('<w:p><w:r><w:t>Pagination specimen</w:t></w:r></w:p><w:tbl>'
    +row('Header','<w:tblHeader/>')+row('Keep','<w:cantSplit/>')+row('Allow','<w:cantSplit w:val="0"/>')+row('Default')+'</w:tbl>');
  const plan=await parseDocxForStudio(source);
  const getTable=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table'); return v;
  };
  const original=getTable(plan.sections);
  assert.equal(original.rowSplitDefault,'allow');
  assert.deepEqual(original.rowSplitOverrides,{'1':'keep','2':'allow'});
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Row pagination'}),sections:plan.sections};
  const docx=buildDocxExport(manuscript);
  const word=new XmlDomParser().parseFromString(readZipParts(docx.bytes).get('word/document.xml')!.toString('utf8'),'application/xml');
  const table=word.getElementsByTagName('w:tbl').item(0);
  assert.ok(table);
  const rows=Array.from({length:4},(_,i)=>table.getElementsByTagName('w:tr').item(i)!);
  assert.deepEqual(rows.map(r=>r.getElementsByTagName('w:cantSplit').item(0)?.getAttribute('w:val')||''),['0','','0','0']);
  const odt=buildOdtExport(manuscript);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/<style:table-row-properties fo:keep-together="always"\/>/);
  assert.match(odtXml,/<style:table-row-properties fo:keep-together="auto"\/>/);
  const {tableRowSplitPolicy}=await import('../src/model/tableLayout.ts');
  for(const reopened of [await parseDocxForStudio(new File([new Uint8Array(docx.bytes)],'rows.docx')),await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'rows.odt'))]){
    const v=getTable(reopened.sections);
    assert.equal(v.headerRows,1);
    assert.deepEqual(v.cells,original.cells);
    assert.deepEqual(v.cells.map((_,i)=>tableRowSplitPolicy(v,i)),['allow','keep','allow','allow']);
  }
});

test('solid cell shading and alignment survive native Word and ODT roundtrips', async () => {
  const cell=(text:string,properties='',alignment='')=>'<w:tc><w:tcPr>'+properties+'</w:tcPr><w:p>'+(alignment?'<w:pPr><w:jc w:val="'+alignment+'"/></w:pPr>':'')+'<w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>';
  const source=makeDocx('<w:p><w:r><w:t>Appearance specimen</w:t></w:r></w:p><w:tbl><w:tr>'
    +cell('Value','<w:shd w:val="clear" w:fill="DCE6F1"/><w:vAlign w:val="center"/>','both')
    +cell('Other','<w:shd w:val="clear" w:fill="auto"/>','right')+'</w:tr></w:tbl>');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cellFormats?.['0:0'],{horizontalAlign:'justify',verticalAlign:'middle',backgroundColor:'#DCE6F1'});
    assert.deepEqual(v.cellFormats?.['0:1'],{horizontalAlign:'right'});
    assert.deepEqual(v.cells,[['Value','Other']]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Appearance'}),sections:plan.sections};
  const word=buildDocxExport(manuscript);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:shd w:val="clear" w:color="auto" w:fill="DCE6F1"\/>/);
  assert.match(xml,/<w:vAlign w:val="center"\/>/);
  assert.match(xml,/<w:jc w:val="both"\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'cell-appearance.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/style:vertical-align="middle" fo:background-color="#DCE6F1"/);
  assert.match(odtXml,/fo:text-align="justify"/);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'cell-appearance.odt'))).sections);
});

test('direct physical cell borders and margins survive DOCX and ODT reopening', async () => {
  const source=makeDocx('<w:p><w:r><w:t>Cell edges</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:color="AABBCC"/><w:right w:val="nil"/><w:bottom w:val="dashed" w:sz="8" w:color="112233"/></w:tcBorders><w:tcMar><w:left w:w="63" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:t>Value</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const table=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(table?.kind==='table');
    assert.deepEqual(table.cellFormats?.['0:0']?.borders,{top:{style:'solid',widthPt:0.5,color:'#AABBCC'},right:{style:'none'},bottom:{style:'dashed',widthPt:1,color:'#112233'}});
    assert.deepEqual(table.cellFormats?.['0:0']?.paddingPt,{right:0,left:3.15});
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Edges'}),sections:plan.sections};
  const docx=buildDocxExport(manuscript);
  const docxXml=readZipParts(docx.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(docxXml,/<w:top w:val="single" w:sz="4" w:color="AABBCC"\/>/);
  assert.match(docxXml,/<w:right w:val="nil"\/>/);
  assert.match(docxXml,/<w:left w:w="63" w:type="dxa"\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(docx.bytes)],'edges.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/fo:border-top="0.5pt solid #AABBCC"/);
  assert.match(odtXml,/fo:padding-right="0pt"/);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'edges.odt'))).sections);
});

test('native row height modes survive Word and ODT import and export', async () => {
  const row=(text:string,props:string)=>'<w:tr><w:trPr>'+props+'</w:trPr><w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc></w:tr>';
  const source=makeDocx('<w:p><w:r><w:t>Row height specimen</w:t></w:r></w:p><w:tbl>'+
    row('Minimum','<w:trHeight w:val="480" w:hRule="atLeast"/><w:cantSplit/>')+
    row('Exact','<w:trHeight w:val="360" w:hRule="exact"/>')+
    row('Auto','<w:trHeight w:val="720" w:hRule="auto"/>')+'</w:tbl>');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.rowHeights,{'0':{mode:'minimum',heightPt:24},'1':{mode:'exact',heightPt:18}});
    assert.equal(v.rowSplitOverrides?.['0'],'keep');
    assert.deepEqual(v.cells,[['Minimum'],['Exact'],['Auto']]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Row heights'}),sections:plan.sections};
  const word=buildDocxExport(manuscript);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:trHeight w:val="480" w:hRule="atLeast"\/>/);
  assert.match(xml,/<w:trHeight w:val="360" w:hRule="exact"\/>/);
  assert.equal((xml.match(/<w:trHeight /g)??[]).length,2);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'row-heights.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/style:min-row-height="24pt" style:use-optimal-row-height="true"/);
  assert.match(odtXml,/style:row-height="18pt" style:use-optimal-row-height="false"/);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'row-heights.odt'))).sections);
});

test('rich table cells retain individual runs and paragraph boundaries in Word and ODT', async () => {
  const source=makeDocx('<w:p><w:r><w:t>Rich cells</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="112233"/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> plain</w:t></w:r></w:p><w:p><w:r><w:rPr><w:i/><w:vertAlign w:val="superscript"/></w:rPr><w:t>Second</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
  const {tableCellDocument}=await import('../src/model/tableLayout.ts');
  const {extractOmiInlineRuns}=await import('../src/model/inlineSemantics.ts');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cells,[['Bold plain\nSecond']]);
    const doc=tableCellDocument(v,0,0);
    assert.ok(doc);
    assert.equal(doc.content?.length,2);
    const runs=extractOmiInlineRuns(JSON.stringify(doc));
    const bold=runs.find(r=>r.text==='Bold');
    assert.ok(bold?.semantics.includes('strong'));
    assert.equal(bold.directFormatting?.omiFontSize,14);
    assert.equal(bold.directFormatting?.omiTextColor,'#112233');
    assert.ok(runs.some(r=>r.text.includes('Second')&&r.semantics.includes('emphasis')&&r.semantics.includes('superscript')));
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Rich cells'}),sections:plan.sections};
  const word=buildDocxExport(manuscript);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:b\/>/);
  assert.match(xml,/<w:sz w:val="28"\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'rich-cell.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'rich-cell.odt'))).sections);
});

test('independent table paragraph properties survive DOCX and ODT roundtrip', async () => {
  const source=makeDocx('<w:p><w:r><w:t>Paragraph specimen</w:t></w:r></w:p><w:tbl><w:tr><w:tc>'+
    '<w:p><w:pPr><w:spacing w:before="60" w:after="100" w:line="280" w:lineRule="exact"/><w:ind w:left="240" w:hanging="120"/><w:jc w:val="right"/></w:pPr><w:r><w:t>First</w:t></w:r></w:p>'+
    '<w:p><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:r><w:t>Second</w:t></w:r></w:p>'+
    '</w:tc></w:tr></w:tbl>');
  const {tableCellDocument}=await import('../src/model/tableLayout.ts');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const v=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cells,[['First\nSecond']]);
    const doc=tableCellDocument(v,0,0);
    assert.ok(doc);
    assert.deepEqual(doc.content?.[0]?.attrs,{omiAlign:'right',omiLeftIndent:12,omiFirstLineIndent:-6,omiSpaceBefore:3,omiSpaceAfter:5,omiLineSpacing:14,omiLineRule:'exact'});
    assert.deepEqual(doc.content?.[1]?.attrs,{omiAlign:'left',omiSpaceAfter:0,omiLineSpacing:1.5,omiLineRule:'auto'});
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Cell paragraphs'}),sections:plan.sections};
  const word=buildDocxExport(manuscript);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:spacing w:before="60" w:after="100" w:line="280" w:lineRule="exact"\/>/);
  assert.match(xml,/<w:ind w:left="240" w:hanging="120"\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'cell-paragraph.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/fo:line-height="14pt"/);
  assert.match(odtXml,/fo:line-height="150%"/);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'cell-paragraph.odt'))).sections);
});

test('native table list numbering and nested bullet items survive Word and ODT reopening', async () => {
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {tableCellDocument,tableCellPlainText}=await import('../src/model/tableLayout.ts');
  const paragraph=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
  const doc={type:'doc',content:[{type:'orderedList',attrs:{start:4},content:[
    {type:'listItem',content:[paragraph('First'),{type:'bulletList',content:[{type:'listItem',content:[paragraph('Nested')]}]}]},
    {type:'listItem',content:[paragraph('Second')]}
  ]}]};
  const manuscript=createBlankManuscript({kind:'study',locale:'en',title:'Table list specimen'});
  manuscript.sections[0]!.blocks.push(createTableBlock([[tableCellPlainText(doc)]],{headerRows:0,cellContent:{'0:0':JSON.stringify(doc)}},'list-table'));
  const word=buildDocxExport(manuscript);
  const parts=readZipParts(word.bytes);
  const xml=parts.get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:numPr><w:ilvl w:val="0"\/>/);
  assert.match(xml,/<w:numPr><w:ilvl w:val="1"\/>/);
  assert.match(parts.get('word/numbering.xml')!.toString('utf8'),/<w:start w:val="4"\/>/);
  const odt=buildOdtExport(manuscript);
  assert.match(readZipParts(odt.bytes).get('content.xml')!.toString('utf8'),/<text:list-item text:start-value="4">/);
  for(const plan of [await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'table-list.docx')),await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'table-list.odt'))]){
    const v=plan.sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cells,[['First\nNested\nSecond']]);
    const tree=tableCellDocument(v,0,0);
    const list=tree?.content?.[0];
    assert.equal(list?.type,'orderedList');
    assert.equal(list.attrs?.start,4);
    assert.equal(list.content?.length,2);
    assert.equal(list.content?.[0]?.content?.[1]?.type,'bulletList');
  }
});

test('native nested tables preserve before/after text and nested cells in DOCX and ODT',async()=>{
  const p=(value:string)=>'<w:p><w:r><w:t>'+value+'</w:t></w:r></w:p>';
  const cell=(value:string)=>'<w:tc>'+value+'</w:tc>';
  const table=(value:string)=>'<w:tbl><w:tr>'+value+'</w:tr></w:tbl>';
  const source=makeDocx(p('Nested specimen')+table(cell(p('Before')+table(cell(p('A'))+cell(p('B')))+p('After'))+cell(p('Outer'))));
  const {tableCellDocument,cellNestedTable}=await import('../src/model/tableLayout.ts');
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    const outer=sections.flatMap(s=>s.blocks).map(b=>b.visual).find(v=>v?.kind==='table');
    assert.ok(outer?.kind==='table');
    assert.deepEqual(outer.cells,[['Before\nA\tB\nAfter','Outer']]);
    const doc=tableCellDocument(outer,0,0);
    assert.deepEqual(doc?.content?.map(node=>node.type),['paragraph','omiCellTable','paragraph']);
    assert.deepEqual(cellNestedTable(doc!.content![1]!)?.cells,[['A','B']]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Nested tables'}),sections:plan.sections};
  const word=buildDocxExport(manuscript);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.equal((xml.match(/<w:tbl>/g)??[]).length,2);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'nested.docx'))).sections);
  const odt=buildOdtExport(manuscript);
  assert.equal((readZipParts(odt.bytes).get('content.xml')!.toString('utf8').match(/<table:table table:name=/g)??[]).length,2);
  inspect((await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'nested.odt'))).sections);
});
