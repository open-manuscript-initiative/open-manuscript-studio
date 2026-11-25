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

test('Word cell footnotes and endnotes retain anchors, bodies and native roundtrips',async()=>{
  const {collectNoteAnchors}=await import('../src/model/notes.ts');
  const p=(text:string,reference='')=>'<w:p><w:r><w:t>'+text+'</w:t></w:r>'+reference+'</w:p>';
  const ref=(kind:string,id:number)=>'<w:r><w:'+kind+'Reference w:id="'+id+'"/></w:r>';
  const ns='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const source=makeDocx(p('Before',ref('footnote',1))+'<w:tbl><w:tr><w:tc>'+p('Cell',ref('footnote',2)+ref('endnote',3))+'</w:tc></w:tr></w:tbl>'+p('After',ref('footnote',4)),{
    footnotes:'<w:footnotes '+ns+'><w:footnote w:id="1">'+p('Before note')+'</w:footnote><w:footnote w:id="2">'+p('Cell footnote')+'</w:footnote><w:footnote w:id="4">'+p('After note')+'</w:footnote></w:footnotes>',
    entries:[textZipEntry('word/endnotes.xml','<w:endnotes '+ns+'><w:endnote w:id="3">'+p('Cell endnote')+'</w:endnote></w:endnotes>')]
  });
  const inspect=(plan:DocxManuscriptImportPlan)=>{
    const anchors=collectNoteAnchors({sections:plan.sections});
    assert.equal(anchors.length,4);
    const table=plan.sections.flatMap(s=>s.blocks).find(b=>b.visual?.kind==='table');
    assert.ok(table?.visual?.kind==='table');
    assert.deepEqual(table.visual.cells,[['Cell']]);
    assert.deepEqual(anchors.map(a=>plan.annotations.find(n=>n.id===a.noteId)?.body),['Before note','Cell footnote','Cell endnote','After note']);
    assert.equal(anchors[1]?.blockId,table.id);
    assert.equal(anchors[2]?.blockId,table.id);
    assert.equal(anchors[2]?.kind,'endnote');
  };
  const plan=await parseDocxManuscript(source);
  inspect(plan);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Cell notes'}),sections:plan.sections,annotations:plan.annotations};
  const word=buildDocxExport(manuscript);
  const parts=readZipParts(word.bytes);
  assert.match(parts.get('word/document.xml')!.toString('utf8'),/<w:tbl>[\s\S]*?<w:footnoteReference w:id="2"\/>[\s\S]*?<w:endnoteReference w:id="1"\/>[\s\S]*?<\/w:tbl>/);
  inspect(await parseDocxManuscript(new File([new Uint8Array(word.bytes)],'cell-notes.docx')));
  const odt=buildOdtExport(manuscript);
  assert.match(readZipParts(odt.bytes).get('content.xml')!.toString('utf8'),/<table:table[\s\S]*?text:note-class="footnote"[\s\S]*?text:note-class="endnote"[\s\S]*?<\/table:table>/);
  inspect(await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'cell-notes.odt')));
});

test('live publication table appearance survives OMI reopening and native publication exports',async()=>{
  const {createVersionedTestManuscript}=await import('./testManuscriptFixture.ts');
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {bindPublicationTableStyle,bindPublicationCellStyle,normalizePublicationTableStyles,derivePublicationTablePreset,replacePublicationTablePreset,resetInheritedCellAppearance,serializePublicationTableStyles,parsePublicationTableStylesTransfer,mergePublicationTableStyles}=await import('../src/model/tableAppearancePresets.ts');
  const {editTableRangeAppearance}=await import('../src/model/tableLayout.ts');
  const {stageAppliedPublicationStyle}=await import('../src/app/publicationTemplateActions.ts');
  const {stageInsertBlocks}=await import('../src/app/visualBlockActions.ts');
  const {clonePublicationStyleTemplate}=await import('../src/services/publicationStyleExport.ts');
  const {getAppliedPublicationTemplate}=await import('../src/model/publicationTemplates.ts');
  const {renderHtmlArticle}=await import('../src/services/exportHtml.ts');
  const {buildPdfPrintDocument}=await import('../src/services/exportPdf.ts');
  const initial=normalizePublicationTableStyles({items:[
    {kind:'table',name:'Base',header:{backgroundColor:'#112233'},body:{backgroundColor:'#EEEEEE',horizontalAlign:'left'},conditions:[{operator:'lt',value:'0',format:{backgroundColor:'#AA0000'}}]},
    {kind:'cell',name:'Numeric',format:{backgroundColor:'#445566',horizontalAlign:'right',verticalAlign:'middle',paddingPt:{left:4},borders:{bottom:{style:'solid',widthPt:1,color:'#123456'}}}}
  ],defaultTableStyle:'Base'})!;
  const derived=derivePublicationTablePreset(initial,'Report','Base')!;
  const previous=useStudioStore.getState();
  try{
    useStudioStore.getState().loadManuscript(createVersionedTestManuscript());
    const style={...clonePublicationStyleTemplate(),tableStyles:derived};
    stageAppliedPublicationStyle(style);
    const block=createTableBlock([['Live header','Other header'],['-15','Named value'],['Direct value','Reset value']],{headerRows:1},'live-table-export');
    assert.ok(block.visual?.kind==='table');
    const named={row:1,column:1},direct={row:2,column:0},reset={row:2,column:1};
    let table=bindPublicationTableStyle(block.visual,derived,'Report');
    table=bindPublicationCellStyle(table,derived,'Numeric',named,named);
    table=editTableRangeAppearance(table,direct,direct,{backgroundColor:'#ABCDEF'});
    table=editTableRangeAppearance(table,reset,reset,{backgroundColor:'#ABCDEF',horizontalAlign:'center'});
    table=resetInheritedCellAppearance(table,derived,reset,reset,['backgroundColor']);
    block.visual=table;
    const sectionId=useStudioStore.getState().manuscript.sections[0]!.id;
    assert.equal(stageInsertBlocks(sectionId,0,[block]),true);
    const base=derived.items.find(p=>p.name==='Base')!;assert.ok(base.kind==='table');
    const updated=replacePublicationTablePreset(derived,{...base,header:{backgroundColor:'#223344'},body:{...base.body,backgroundColor:'#DDEEFF'}})!;
    stageAppliedPublicationStyle({...style,tableStyles:updated});
    useStudioStore.getState().checkpoint('manual');
    const reopened=parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    const v=reopened.sections.flatMap(s=>s.blocks).find(b=>b.id===block.id)?.visual;
    assert.ok(v?.kind==='table');
    assert.deepEqual(v.cells,table.cells);
    assert.equal(v.publicationTableStyle,'Report');
    assert.equal(v.publicationCellStyles?.['1:1'],'Numeric');
    assert.deepEqual(v.publicationCellOverrides?.['2:0'],['backgroundColor']);
    assert.deepEqual(v.publicationCellOverrides?.['2:1'],['horizontalAlign']);
    assert.equal(v.cellFormats?.['0:0']?.backgroundColor,'#223344');
    assert.equal(v.cellFormats?.['1:0']?.backgroundColor,'#AA0000');
    assert.equal(v.cellFormats?.['1:1']?.backgroundColor,'#445566');
    assert.equal(v.cellFormats?.['2:0']?.backgroundColor,'#ABCDEF');
    assert.equal(v.cellFormats?.['2:1']?.backgroundColor,'#DDEEFF');
    assert.equal(v.cellFormats?.['2:1']?.horizontalAlign,'center');
    const portableCatalog=getAppliedPublicationTemplate(reopened)?.style.tableStyles;
    assert.ok(portableCatalog);
    const imported=mergePublicationTableStyles({items:[]},parsePublicationTableStylesTransfer(serializePublicationTableStyles(portableCatalog)),true);
    assert.deepEqual(imported.catalog,portableCatalog);
    for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
      for(const color of ['223344','AA0000','445566','ABCDEF','DDEEFF'])assert.ok(html.includes('background-color:#'+color),color);
      assert.match(html,/border-bottom:1pt solid #123456/);
      assert.match(html,/padding-left:4pt/);
      assert.match(html,/Named value/);
    }
    const word=buildDocxExport(reopened);
    const wordXml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
    for(const color of ['223344','AA0000','445566','ABCDEF','DDEEFF'])assert.ok(wordXml.includes('w:fill="'+color+'"'),color);
    assert.match(wordXml,/w:vAlign w:val="center"/);
    const odt=buildOdtExport(reopened);
    const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
    for(const color of ['223344','AA0000','445566','ABCDEF','DDEEFF'])assert.ok(odtXml.includes('fo:background-color="#'+color+'"'),color);
    assert.match(odtXml,/fo:padding-left="4pt"/);
    const idml=buildIdmlExport(reopened);
    const story=[...readZipParts(idml.bytes)].filter(([name])=>name.startsWith('Stories/')&&name.endsWith('.xml')).map(([,bytes])=>bytes.toString('utf8')).join('');
    for(const color of ['223344','AA0000','445566','ABCDEF','DDEEFF'])assert.ok(story.includes('FillColor="Color/OMI-'+color+'"'),color);
    assert.match(story,/LeftInset="4"/);
    assert.match(story,/BottomEdgeStrokeWeight="1"/);
    // Native office formats carry materialized appearance, not OMI live bindings.
    for(const sections of [(await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'live.docx'))).sections,(await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'live.odt'))).sections]){
      const exported=sections.flatMap(s=>s.blocks).find(b=>b.visual?.kind==='table'&&b.visual.cells[0]?.[0]==='Live header')?.visual;
      assert.ok(exported?.kind==='table');
      assert.deepEqual(exported.cells,v.cells);
      for(const [key,color] of Object.entries({'0:0':'#223344','1:0':'#AA0000','1:1':'#445566','2:0':'#ABCDEF','2:1':'#DDEEFF'}))assert.equal(exported.cellFormats?.[key]?.backgroundColor,color,key);
      assert.equal(exported.cellFormats?.['2:1']?.horizontalAlign,'center');
      assert.equal(exported.cellFormats?.['1:1']?.verticalAlign,'middle');
      assert.equal(exported.cellFormats?.['1:1']?.paddingPt?.left,4);
      assert.equal(exported.cellFormats?.['1:1']?.borders?.bottom?.widthPt,1);
      assert.equal(exported.publicationTableStyle,undefined);
    }
  }finally{useStudioStore.setState(previous,true);}
});

test('Word style-based numbering resolves ancestry, explicit suppression and cell list identity',async()=>{
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const styles='<w:styles xmlns:w="'+ns+'"><w:style w:type="paragraph" w:styleId="BaseList"><w:pPr><w:numPr><w:numId w:val="7"/></w:numPr></w:pPr></w:style><w:style w:type="paragraph" w:styleId="DerivedList"><w:basedOn w:val="BaseList"/></w:style><w:style w:type="paragraph" w:styleId="NestedList"><w:basedOn w:val="BaseList"/></w:style><w:style w:type="paragraph" w:styleId="NoList"><w:basedOn w:val="BaseList"/><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr></w:style></w:styles>';
  const numbering='<w:numbering xmlns:w="'+ns+'"><w:abstractNum w:abstractNumId="3"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:pStyle w:val="NestedList"/><w:lvlText w:val="%2."/><w:pPr><w:ind w:left="720" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="3"/></w:num></w:numbering>';
  const p=(value:string,style:string,direct='')=>'<w:p><w:pPr><w:pStyle w:val="'+style+'"/>'+direct+'</w:pPr><w:r><w:t>'+value+'</w:t></w:r></w:p>';
  const input=makeDocx(p('First item','DerivedList')+p('Nested item','NestedList')+p('Suppressed item','DerivedList','<w:numPr><w:numId w:val="0"/></w:numPr>')+p('Plain style','NoList')+p('Continued item','BaseList')+'<w:tbl><w:tr><w:tc>'+p('Cell item','DerivedList')+'</w:tc></w:tr></w:tbl>',{entries:[textZipEntry('word/styles.xml',styles),textZipEntry('word/numbering.xml',numbering)]});
  const plan=await parseDocxForStudio(input);
  const blocks=plan.sections.flatMap(s=>s.blocks);
  const lists=blocks.filter(b=>!b.visual).flatMap(b=>findNodes(JSON.parse(b.content) as TiptapNode,'orderedList'));
  const first=lists.find(n=>collectText(n).startsWith('First item'));
  const nested=lists.find(n=>collectText(n)==='Nested item');
  const continued=lists.find(n=>collectText(n)==='Continued item');
  assert.ok(first&&nested&&continued);
  assert.equal(first.attrs?.omiListLeft,360);
  assert.equal(nested.attrs?.omiListLevel,1);
  assert.equal(nested.attrs?.omiListLeft,720);
  assert.ok(first.attrs?.omiListId);
  assert.equal(continued.attrs?.omiListId,first.attrs?.omiListId);
  for(const label of ['Suppressed item','Plain style']){
    const block=blocks.find(b=>!b.visual&&blockText(b)===label);
    assert.ok(block);
    assert.equal(findNodes(JSON.parse(block.content) as TiptapNode,'orderedList').length,0);
  }
  const table=blocks.find(b=>b.visual?.kind==='table')?.visual;
  assert.ok(table?.kind==='table');
  const cell=findNodes(JSON.parse(table.cellContent?.['0:0']??'{}') as TiptapNode,'orderedList')[0];
  assert.equal(cell?.attrs?.omiListId,first.attrs?.omiListId);
  assert.equal(table.cells[0]?.[0],'Cell item');
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Style numbering'}),sections:plan.sections};
  const exported=buildDocxExport(manuscript);
  const xml=readZipParts(exported.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:numPr>/);
  const reopened=await parseDocxForStudio(new File([new Uint8Array(exported.bytes)],'style-numbering.docx'));
  const reopenedLists=reopened.sections.flatMap(s=>s.blocks).filter(b=>!b.visual).flatMap(b=>findNodes(JSON.parse(b.content) as TiptapNode,'orderedList'));
  assert.equal(reopenedLists.find(n=>collectText(n).startsWith('First item'))?.attrs?.omiListId,reopenedLists.find(n=>collectText(n)==='Continued item')?.attrs?.omiListId);
});

test('named source paragraph style survives structured text, editor projection and Word reopen',async()=>{
  const {sourceStyleBundle}=await import('../src/model/sourceWordStyles.ts');
  const {buildContinuousManuscriptDocument,projectContinuousManuscriptDocument}=await import('../src/editor/continuousManuscriptDocument.ts');
  const styles='<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="SourceBase"><w:name w:val="Source base"/></w:style><w:style w:type="paragraph" w:styleId="SourceCustom"><w:name w:val="Source custom"/><w:basedOn w:val="SourceBase"/><w:next w:val="SourceBase"/></w:style></w:styles>';
  const body='<w:p><w:pPr><w:pStyle w:val="SourceCustom"/></w:pPr><w:r><w:t>Styled specimen</w:t><w:tab/><w:t>after tab</w:t></w:r></w:p>';
  const plan=await parseDocxForStudio(makeDocx(body,{entries:[textZipEntry('word/styles.xml',styles)]}));
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Source style regression'}),sections:plan.sections};
  const inspect=(sections:typeof plan.sections)=>{
    const block=sections.flatMap(s=>s.blocks).find(b=>b.content.includes('Styled specimen'));
    assert.ok(block);
    const p=findNodes(JSON.parse(block.content) as TiptapNode,'paragraph')[0];
    const bundle=sourceStyleBundle(p?.attrs?.omiWordParagraphStyle);
    assert.equal(bundle?.selected,'SourceCustom');
    const selected=bundle?.styles.find(s=>s.id===bundle.selected);
    assert.equal(selected?.name,'Source custom');
    assert.equal(selected?.basedOn,'SourceBase');
    assert.equal(selected?.next,'SourceBase');
    assert.ok(findNodes(JSON.parse(block.content) as TiptapNode,'omiTab').length);
    assert.equal(block.paragraphStyleId,undefined);
  };
  inspect(plan.sections);
  const projected={...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)};
  const reopened=parseOmiJson(serializeOmiJson(projected));
  inspect(reopened.sections);
  const word=buildDocxExport(reopened);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:pStyle w:val="SourceCustom"\/>/);
  assert.match(xml,/<w:tab\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'source-paragraph-style.docx'))).sections);
});

test('explicit mixed writing directions survive Word import, editor projection and OMI/DOCX reopen',async()=>{
  const {paragraphFormattingCss,normalizeParagraphValue}=await import('../src/model/directParagraphFormatting.ts');
  const {normalizeDirectValue}=await import('../src/model/directFormatting.ts');
  const body='<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/><w:lang w:val="he-IL"/></w:rPr><w:t>שלום עולם</w:t></w:r><w:r><w:rPr><w:rtl w:val="0"/></w:rPr><w:t> Latin 123</w:t></w:r></w:p><w:p><w:pPr><w:bidi w:val="0"/></w:pPr><w:r><w:rPr><w:lang w:val="ar-SA"/></w:rPr><w:t>مرحبا</w:t></w:r></w:p>';
  const plan=await parseDocxForStudio(makeDocx(body));
  const inspect=(sections:typeof plan.sections)=>{
    const blocks=sections.flatMap(s=>s.blocks);
    const first=blocks.find(b=>b.content.includes('Latin 123'))!;
    const second=blocks.find(b=>b.content.includes('مرحبا'))!;
    assert.ok(first&&second);
    const a=JSON.parse(first.content) as TiptapNode,b=JSON.parse(second.content) as TiptapNode;
    assert.equal(findNodes(a,'paragraph')[0]?.attrs?.omiParagraphDirection,'rtl');
    assert.equal(findNodes(b,'paragraph')[0]?.attrs?.omiParagraphDirection,'ltr');
    const direction=(n:TiptapNode)=>n.marks?.find(m=>m.type==='omiTextDirection')?.attrs?.value;
    assert.equal(direction(findNodes(a,'text').find(n=>n.text?.includes('שלום'))!),'rtl');
    assert.equal(direction(findNodes(a,'text').find(n=>n.text?.includes('Latin'))!),'ltr');
    assert.equal(direction(findNodes(b,'text')[0]!),undefined,'Language must not imply a direct direction override');
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Bidirectional text'}),sections:plan.sections};
  const projected={...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)};
  const reopened=parseOmiJson(serializeOmiJson(projected));
  inspect(reopened.sections);
  const docx=buildDocxExport(reopened);
  const word=readZipParts(docx.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(word,/<w:bidi w:val="1"\/>/);
  assert.match(word,/<w:bidi w:val="0"\/>/);
  assert.match(word,/<w:rtl w:val="1"\/>/);
  assert.match(word,/<w:rtl w:val="0"\/>/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(docx.bytes)],'mixed-direction.docx'))).sections);
  const {renderHtmlArticle}=await import('../src/services/exportHtml.ts');
  const html=renderHtmlArticle(reopened).html;
  assert.match(html,/direction:rtl;unicode-bidi:embed/);
  assert.match(html,/direction:ltr;unicode-bidi:embed/);
  const odt=buildOdtExport(reopened);
  const odtXml=readZipParts(odt.bytes).get('content.xml')!.toString('utf8');
  assert.match(odtXml,/style:writing-mode="rl-tb"/);
  assert.match(odtXml,/style:writing-mode="lr-tb"/);
  const imported=await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'mixed-direction.odt'));
  const importedBlocks=imported.sections.flatMap(s=>s.blocks);
  for(const [sample,dir] of [['Latin 123','rtl'],['مرحبا','ltr']]){
    const block=importedBlocks.find(b=>b.content.includes(sample!))!;
    assert.equal(findNodes(JSON.parse(block.content),'paragraph')[0]?.attrs?.omiParagraphDirection,dir);
  }
  assert.equal(paragraphFormattingCss({omiParagraphDirection:'rtl'},'print'),'direction:rtl');
  assert.equal(normalizeParagraphValue('omiParagraphDirection','rtl;display:none'),undefined);
  assert.equal(normalizeDirectValue('omiTextDirection','auto'),undefined);
});

test('Word hyphenation defaults and paragraph suppression survive portable and native roundtrip',async()=>{
  const {WORD_HYPHENATION_EXTENSION,normalizeWordHyphenation,wordHyphenationSettingsXml,validateWordHyphenation}=await import('../src/model/wordHyphenation.ts');
  const {buildPdfPrintDocument}=await import('../src/services/exportPdf.ts');
  const settings='<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:autoHyphenation w:val="1"/><w:consecutiveHyphenLimit w:val="2"/><w:hyphenationZone w:val="360"/><w:doNotHyphenateCaps w:val="0"/></w:settings>';
  const body='<w:p><w:pPr><w:suppressAutoHyphens w:val="0"/></w:pPr><w:r><w:t>Hyphenation enabled specimen</w:t></w:r></w:p><w:p><w:pPr><w:suppressAutoHyphens/></w:pPr><w:r><w:t>Hyphenation disabled specimen</w:t></w:r></w:p><w:p><w:r><w:t>Inherited hyphenation specimen</w:t></w:r></w:p>';
  const plan=await parseDocxForStudio(makeDocx(body,{entries:[textZipEntry('word/settings.xml',settings)]}));
  assert.deepEqual(plan.wordHyphenation,{automatic:true,suppressCapitalized:false,zoneTwips:360,consecutiveLimit:2});
  const inspect=(sections:typeof plan.sections)=>{
    for(const [sample,expected] of [['Hyphenation enabled specimen',true],['Hyphenation disabled specimen',false],['Inherited hyphenation specimen',undefined]] as const){
      const block=sections.flatMap(s=>s.blocks).find(b=>b.content.includes(sample))!;
      assert.ok(block,sample);
      const paragraph=findNodes(JSON.parse(block.content),'paragraph')[0];
      assert.equal(paragraph?.attrs?.omiAutoHyphenation,expected,sample);
    }
  };
  inspect(plan.sections);
  const previous=useStudioStore.getState();
  try{
    applyDocxImportPlan(plan,{importDetectedAuthors:false,source:'',selfAuthoredExternal:true});
    const manuscript=useStudioStore.getState().manuscript;
    const projected={...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)};
    const reopened=parseOmiJson(serializeOmiJson(projected));
    assert.deepEqual(reopened.extensions?.[WORD_HYPHENATION_EXTENSION],plan.wordHyphenation);
    inspect(reopened.sections);
    const result=buildDocxExport(reopened);
    const parts=readZipParts(result.bytes);
    const xml=parts.get('word/settings.xml')!.toString('utf8');
    for(const element of ['<w:autoHyphenation w:val="1"/>','<w:consecutiveHyphenLimit w:val="2"/>','<w:hyphenationZone w:val="360"/>','<w:doNotHyphenateCaps w:val="0"/>'])assert.ok(xml.includes(element),element);
    const reimport=await parseDocxForStudio(new File([new Uint8Array(result.bytes)],'hyphenation.docx'));
    assert.deepEqual(reimport.wordHyphenation,plan.wordHyphenation);
    inspect(reimport.sections);
    const print=buildPdfPrintDocument(reopened);
    assert.match(print,/<p[^>]*data-omi-no-hyphenation="true"[^>]*hyphens:none[^>]*>Hyphenation disabled specimen<\/p>/);
    assert.equal(wordHyphenationSettingsXml({automatic:false,zoneTwips:-1,unknown:'"><bad/>'}),'<w:autoHyphenation w:val="0"/>');
    assert.equal(normalizeWordHyphenation({zoneTwips:'360'}),undefined);
    assert.throws(()=>validateWordHyphenation({automatic:true,zoneTwips:-1}));
  }finally{useStudioStore.setState(previous,true);}
});

test('Word note paragraphs retain pagination flags and complete multi-paragraph bodies',async()=>{
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const long='FOOTNOTE-START '+('Long footnote material for pagination. '.repeat(220))+'FOOTNOTE-END';
  const source=makeDocx('<w:p><w:r><w:t>Anchor</w:t></w:r><w:r><w:footnoteReference w:id="1"/><w:endnoteReference w:id="2"/></w:r></w:p>',{
    footnotes:'<w:footnotes xmlns:w="'+ns+'"><w:footnote w:id="1"><w:p><w:pPr><w:keepLines w:val="0"/></w:pPr><w:r><w:t>'+long+'</w:t></w:r></w:p><w:p><w:pPr><w:keepNext w:val="0"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>Second paragraph</w:t></w:r></w:p></w:footnote></w:footnotes>',
    entries:[textZipEntry('word/endnotes.xml','<w:endnotes xmlns:w="'+ns+'"><w:endnote w:id="2"><w:p><w:r><w:t>First endnote paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Second endnote paragraph</w:t></w:r></w:p></w:endnote></w:endnotes>')]
  });
  const inspect=(plan:DocxManuscriptImportPlan)=>{
    const foot=plan.annotations.find(n=>n.noteKind==='footnote')!;
    const end=plan.annotations.find(n=>n.noteKind==='endnote')!;
    assert.equal(foot.body,long+'\nSecond paragraph');
    const paragraphs=findNodes(JSON.parse(foot.bodyContent!),'paragraph');
    assert.equal(paragraphs.length,2);
    assert.equal(paragraphs[0]?.attrs?.omiKeepLines,false);
    assert.equal(paragraphs[1]?.attrs?.omiKeepNext,false);
    assert.ok(findNodes(paragraphs[1]!,'text').some(n=>n.text==='Second paragraph'&&n.marks?.some(m=>m.type==='italic')));
    assert.equal(end.body,'First endnote paragraph\nSecond endnote paragraph');
    assert.equal(findNodes(JSON.parse(end.bodyContent!),'paragraph').length,2);
  };
  const plan=await parseDocxForStudio(source);
  inspect(plan);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Footnote pagination'}),sections:plan.sections,annotations:plan.annotations};
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const result=buildDocxExport(reopened);
  const parts=readZipParts(result.bytes);
  const foot=parts.get('word/footnotes.xml')!.toString('utf8');
  assert.match(foot,/<w:keepLines w:val="0"\/>/);
  assert.match(foot,/FOOTNOTE-END<\/w:t>/);
  assert.match(foot,/<\/w:p><w:p><w:pPr><w:pStyle w:val="FootnoteText"\/>/);
  assert.equal((foot.match(/<w:footnoteRef\/>/g)??[]).length,1);
  inspect(await parseDocxForStudio(new File([new Uint8Array(result.bytes)],'note-pagination.docx')));
});

test('Word each-section note restart survives physical section import and native re-export',async()=>{
  const {buildNoteNumberMap}=await import('../src/model/notes.ts');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const props='<w:sectPr><w:footnotePr><w:numRestart w:val="eachSect"/></w:footnotePr><w:type w:val="continuous"/></w:sectPr>';
  const body='<w:p><w:r><w:t>First section specimen</w:t><w:footnoteReference w:id="1"/></w:r></w:p><w:p><w:pPr>'+props+'</w:pPr></w:p><w:p><w:r><w:t>Second section specimen</w:t><w:footnoteReference w:id="2"/></w:r></w:p>'+props;
  const file=makeDocx(body,{footnotes:'<w:footnotes xmlns:w="'+ns+'"><w:footnote w:id="1"><w:p><w:r><w:t>First note</w:t></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:t>Second note</w:t></w:r></w:p></w:footnote></w:footnotes>'});
  const plan=await parseDocxForStudio(file);
  assert.equal(plan.noteNumberingScope,'section');
  assert.equal(plan.sections.length,2);
  const previous=useStudioStore.getState();
  try{
    applyDocxImportPlan(plan,{importDetectedAuthors:false,source:'',selfAuthoredExternal:true});
    const manuscript=parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    assert.equal(manuscript.documentStructure?.noteNumberingScope,'section');
    assert.deepEqual([...buildNoteNumberMap(manuscript).values()],[1,1]);
    const word=buildDocxExport(manuscript);
    const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
    assert.match(xml,/<w:pPr><w:sectPr><w:footnotePr><w:numRestart w:val="eachSect"\/>/);
    assert.match(xml,/<w:endnotePr><w:numRestart w:val="eachSect"\/>/);
    assert.match(xml,/<w:footnoteReference w:id="1"\/>/);
    assert.match(xml,/<w:footnoteReference w:id="2"\/>/);
    const reopened=await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'section-notes.docx'));
    assert.equal(reopened.noteNumberingScope,'section');
    assert.equal(reopened.sections.length,2);
    assert.deepEqual(reopened.annotations.map(n=>n.body),['First note','Second note']);
    const continuous=buildDocxExport({...manuscript,documentStructure:{...manuscript.documentStructure!,noteNumberingScope:'continuous'}});
    assert.doesNotMatch(readZipParts(continuous.bytes).get('word/document.xml')!.toString('utf8'),/w:numRestart/);
  }finally{useStudioStore.setState(previous,true);}
});

test('native custom starred notes preserve separate label, text and automatic numbering',async()=>{
  const {buildNoteNumberMap,buildNoteLabelMap}=await import('../src/model/notes.ts');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body='<w:p><w:r><w:t>Disclosure anchor</w:t><w:footnoteReference w:id="1" w:customMarkFollows="1"/><w:t>*</w:t><w:t> after marker</w:t><w:footnoteReference w:id="2"/></w:r></w:p>';
  const footnotes='<w:footnotes xmlns:w="'+ns+'"><w:footnote w:id="1"><w:p><w:r><w:t>*</w:t></w:r><w:r><w:t>Funding disclosure</w:t></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:footnoteRef/><w:t>Ordinary note</w:t></w:r></w:p></w:footnote></w:footnotes>';
  const plan=await parseDocxForStudio(makeDocx(body,{footnotes}));
  assert.equal(plan.annotations[0]?.noteCustomMark,'*');
  assert.equal(plan.annotations[0]?.body,'Funding disclosure');
  assert.equal(plan.annotations[1]?.body,'Ordinary note');
  const manuscript=parseOmiJson(serializeOmiJson({...createBlankManuscript({kind:'study',locale:'en',title:'Star note'}),sections:plan.sections,annotations:plan.annotations}));
  assert.deepEqual([...buildNoteNumberMap(manuscript).values()],[1]);
  assert.deepEqual([...buildNoteLabelMap(manuscript).values()],['*','1']);
  const result=buildDocxExport(manuscript);
  const parts=readZipParts(result.bytes);
  assert.match(parts.get('word/document.xml')!.toString('utf8'),/<w:footnoteReference w:id="1" w:customMarkFollows="1"\/><w:t>\*<\/w:t>/);
  assert.match(parts.get('word/document.xml')!.toString('utf8'),/<w:footnoteReference w:id="2"\/>/);
  const reopened=await parseDocxForStudio(new File([new Uint8Array(result.bytes)],'star-note.docx'));
  assert.equal(reopened.annotations[0]?.noteCustomMark,'*');
  assert.equal(reopened.annotations[0]?.body,'Funding disclosure');
  assert.equal(reopened.annotations[1]?.body,'Ordinary note');
});

test('native Word physical sections preserve page geometry, columns and restart through editor projection',async()=>{
  const first='<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="11906" w:h="16838"/><w:cols w:num="2" w:space="720"/></w:sectPr>';
  const last='<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="11906" w:h="8391" w:orient="landscape"/><w:pgMar w:top="900" w:left="1000"/><w:pgNumType w:start="11"/></w:sectPr>';
  const source=makeDocx('<w:p><w:r><w:t>First physical section</w:t></w:r></w:p><w:p><w:pPr>'+first+'</w:pPr></w:p><w:p><w:r><w:t>Second physical section</w:t></w:r></w:p>'+last);
  const plan=await parseDocxForStudio(source);
  const inspect=(sections:typeof plan.sections)=>{
    assert.equal(sections.length,2);
    assert.notEqual(sections[0]?.layout?.wordSection?.groupId,sections[1]?.layout?.wordSection?.groupId);
    assert.equal(sections[0]?.layout?.columns,2);
    assert.equal(sections[0]?.layout?.columnGapMm,12.7);
    assert.equal(sections[0]?.layout?.wordSection?.pageHeightTwips,16838);
    assert.equal(sections[0]?.layout?.wordSection?.breakType,'continuous');
    assert.equal(sections[1]?.layout?.wordSection?.pageHeightTwips,8391);
    assert.equal(sections[1]?.layout?.wordSection?.orientation,'landscape');
    assert.equal(sections[1]?.layout?.wordSection?.pageNumberStart,11);
    assert.equal(sections[1]?.layout?.wordSection?.margins?.left,1000);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Section geometry'}),sections:plan.sections};
  const projected={...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)};
  inspect(projected.sections);
  const reopened=parseOmiJson(serializeOmiJson(projected));
  inspect(reopened.sections);
  const word=buildDocxExport(reopened);
  const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
  assert.match(xml,/<w:cols w:num="2" w:space="720"\/>/);
  assert.match(xml,/<w:pgSz w:w="11906" w:h="8391" w:orient="landscape"\/>/);
  assert.match(xml,/<w:pgNumType w:start="11"\/>/);
  assert.equal((xml.match(/<w:sectPr>/g)??[]).length,2);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'section-geometry.docx'))).sections);
});

test('Word running header/footer variants and page fields survive portable roundtrip',async()=>{
  const {normalizeRunningVariants}=await import('../src/model/wordRunningMatter.ts');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const header=(content:string)=>'<w:hdr xmlns:w="'+ns+'"><w:p>'+content+'</w:p></w:hdr>';
  const footer=(content:string)=>'<w:ftr xmlns:w="'+ns+'"><w:p>'+content+'</w:p></w:ftr>';
  const text=(s:string)=>'<w:r><w:t>'+s+'</w:t></w:r>';
  const field=(name:string)=>'<w:fldSimple w:instr=" '+name+' ">'+text('99')+'</w:fldSimple>';
  const complex='<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'+text('99')+'<w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const refs='<w:headerReference w:type="default" r:id="odd"/><w:headerReference w:type="even" r:id="even"/><w:headerReference w:type="first" r:id="first"/><w:footerReference w:type="default" r:id="footer"/>';
  const plan=await parseDocxForStudio(makeDocx('<w:p>'+text('Running matter specimen')+'</w:p><w:sectPr>'+refs+'<w:pgNumType w:start="11"/><w:titlePg/></w:sectPr>',{
    relationships:['odd','even','first','footer'].map(id=>'<Relationship Id="'+id+'" Type="'+rel+(id==='footer'?'footer':'header')+'" Target="'+id+'.xml"/>').join(''),
    entries:[textZipEntry('word/odd.xml',header(text('ODD &amp; HEADER'))),textZipEntry('word/even.xml',header(text('EVEN HEADER'))),textZipEntry('word/first.xml',header(text('FIRST HEADER'))),textZipEntry('word/footer.xml',footer('<w:pPr><w:jc w:val="center"/></w:pPr>'+field('PAGE')+text(' of ')+complex+text(' / ')+field('SECTIONPAGES'))),textZipEntry('word/settings.xml','<w:settings xmlns:w="'+ns+'"><w:evenAndOddHeaders/></w:settings>')]
  }));
  const inspect=(sections:typeof plan.sections)=>{
    const native=sections[0]?.layout?.wordSection;
    assert.equal(native?.evenAndOddHeaders,true);
    assert.equal(native?.differentFirstPage,true);
    assert.equal(native?.pageNumberStart,11);
    assert.deepEqual(native?.headers?.default,[{tokens:[{kind:'text',text:'ODD & HEADER'}]}]);
    assert.deepEqual(native?.headers?.even,[{tokens:[{kind:'text',text:'EVEN HEADER'}]}]);
    assert.deepEqual(native?.headers?.first,[{tokens:[{kind:'text',text:'FIRST HEADER'}]}]);
    assert.deepEqual(native?.footers?.default,[{align:'center',tokens:[{kind:'field',field:'PAGE'},{kind:'text',text:' of '},{kind:'field',field:'NUMPAGES'},{kind:'text',text:' / '},{kind:'field',field:'SECTIONPAGES'}]}]);
  };
  inspect(plan.sections);
  const manuscript={...createBlankManuscript({kind:'study',locale:'en',title:'Running matter'}),sections:plan.sections};
  const reopened=parseOmiJson(serializeOmiJson({...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)}));
  inspect(reopened.sections);
  const word=buildDocxExport(reopened);
  const parts=readZipParts(word.bytes);
  const document=parts.get('word/document.xml')!.toString('utf8');
  assert.match(document,/<w:headerReference w:type="default" r:id="rIdHeader1"\/>/);
  assert.match(document,/<w:headerReference w:type="even" r:id="rIdHeader2"\/>/);
  assert.match(document,/<w:headerReference w:type="first" r:id="rIdHeader3"\/>/);
  assert.match(document,/<w:footerReference w:type="default" r:id="rIdFooter1"\/>/);
  assert.match(document,/<w:titlePg\/>/);
  assert.match(parts.get('word/settings.xml')!.toString('utf8'),/<w:evenAndOddHeaders\/>/);
  assert.match(parts.get('word/header1.xml')!.toString('utf8'),/ODD &amp; HEADER/);
  assert.match(parts.get('word/header2.xml')!.toString('utf8'),/EVEN HEADER/);
  assert.match(parts.get('word/footer1.xml')!.toString('utf8'),/w:instr=" PAGE "[\s\S]*w:instr=" NUMPAGES "[\s\S]*w:instr=" SECTIONPAGES "/);
  assert.match(parts.get('word/_rels/document.xml.rels')!.toString('utf8'),/Id="rIdFooter1"[^>]*Target="footer1.xml"/);
  assert.match(parts.get('[Content_Types].xml')!.toString('utf8'),/PartName="\/word\/footer1.xml"/);
  inspect((await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'running-matter.docx'))).sections);
  assert.equal(normalizeRunningVariants({default:[{tokens:[{kind:'field',field:'INCLUDETEXT'}]}]}),undefined);
  assert.equal(normalizeRunningVariants({default:[{tokens:[{kind:'text',text:'a'.repeat(32001)}]}]}),undefined);
});

test('native Word bookmarks resolve forward REF and PAGEREF fields and survive OMI/DOCX reopen',async()=>{
  const {validateCrossReferences,formatCrossReferenceLabel,resolveCrossReferenceTarget}=await import('../src/model/crossReferences.ts');
  const {parseWordCrossReference,normalizeWordCrossReferenceField}=await import('../src/model/wordCrossReference.ts');
  const field=(instruction:string,cached:string)=>'<w:fldSimple w:instr="'+instruction+'"><w:r><w:t>'+cached+'</w:t></w:r></w:fldSimple>';
  const complex='<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGEREF Target </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>7</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const source=makeDocx('<w:p><w:r><w:t xml:space="preserve">Reference: </w:t></w:r>'+field(' REF Target \\h ','Target specimen')+'<w:r><w:t xml:space="preserve">, page </w:t></w:r>'+complex+'</w:p>'
    +'<w:p><w:bookmarkStart w:id="20" w:name="Target"/><w:r><w:t>Target specimen</w:t></w:r><w:bookmarkEnd w:id="20"/></w:p>'
    +'<w:p><w:r><w:t>Unresolved specimen </w:t></w:r>'+field('REF Missing','Missing cached')+'</w:p>'
    +'<w:p><w:r><w:t>Prefix </w:t></w:r><w:bookmarkStart w:id="21" w:name="Partial"/><w:r><w:t>Selected text</w:t></w:r><w:bookmarkEnd w:id="21"/></w:p>'
    +'<w:p>'+field('REF Partial','Selected text')+'</w:p>');
  const plan=await parseDocxForStudio(source);
  assert.equal(plan.namedAnchors?.length,2);
  assert.equal(plan.crossReferences?.length,2);
  const target=plan.namedAnchors!.find(a=>a.name==='Target')!;
  assert.equal(target.targetKind,'block');
  assert.ok(plan.sections.flatMap(s=>s.blocks).some(b=>b.id===target.targetId&&blockText(b)==='Target specimen'));
  assert.deepEqual(plan.crossReferences!.map(r=>r.targetId),[target.id,target.id]);
  assert.deepEqual(plan.crossReferences!.map(r=>r.wordField),[{kind:'REF',cachedLabel:'Target specimen',hyperlink:true},{kind:'PAGEREF',cachedLabel:'7'}]);
  assert.ok(plan.warnings.some(w=>w.code==='word-bookmark-range-approximated'));
  assert.ok(plan.warnings.some(w=>w.code==='word-cross-reference-flattened'));
  const previous=useStudioStore.getState();
  try{
    applyDocxImportPlan(plan,{importDetectedAuthors:false,source:'',selfAuthoredExternal:true});
    const manuscript=useStudioStore.getState().manuscript;
    const projected={...manuscript,sections:projectContinuousManuscriptDocument(buildContinuousManuscriptDocument(manuscript.sections),manuscript.sections)};
    const reopened=parseOmiJson(serializeOmiJson(projected));
    assert.equal(reopened.namedAnchors?.length,2);
    assert.deepEqual(validateCrossReferences(reopened),[]);
    const ref=reopened.crossReferences![1]!;
    assert.equal(formatCrossReferenceLabel(ref,resolveCrossReferenceTarget(reopened,ref.targetId),'en'),'7');
    const word=buildDocxExport(reopened);
    const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
    assert.match(xml,/<w:bookmarkStart w:id="1" w:name="Target"\/>[\s\S]*?Target specimen[\s\S]*?<w:bookmarkEnd w:id="1"\/>/);
    assert.ok(xml.includes('w:instr=" REF Target \\h "'));
    assert.match(xml,/w:instr=" PAGEREF Target "/);
    assert.doesNotMatch(xml,/w:instr="[^"]*REF (?:Missing|Partial)/);
    assert.match(xml,/Missing cached/);
    const roundtrip=await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'bookmark-fields.docx'));
    assert.equal(roundtrip.crossReferences?.length,2);
    assert.deepEqual(roundtrip.crossReferences!.map(r=>r.wordField),plan.crossReferences!.map(r=>r.wordField));
    assert.equal(parseWordCrossReference('REF Target \\n','1'),undefined);
    assert.equal(parseWordCrossReference('INCLUDETEXT Target','unsafe'),undefined);
    assert.equal(normalizeWordCrossReferenceField({kind:'REF',cachedLabel:'x'.repeat(4097)}),undefined);
  }finally{useStudioStore.setState(previous,true);}
});

test('Word hyperlinks retain safe external relationships, tooltips and internal bookmark targets',async()=>{
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
  const relationship=(id:string,target:string)=>'<Relationship Id="'+id+'" Type="'+rel+'" Target="'+target+'" TargetMode="External"/>';
  const link=(id:string,label:string)=>'<w:hyperlink r:id="'+id+'" w:tooltip="Source &amp; details"><w:r><w:t>'+label+'</w:t></w:r></w:hyperlink>';
  const input=makeDocx('<w:p><w:r><w:t>Links: </w:t></w:r>'+link('site','Web specimen')+link('site','Repeated link')+link('mail','Mail specimen')+link('unsafe','Unsafe specimen')+'<w:hyperlink w:anchor="Jump"><w:r><w:t>Internal specimen</w:t></w:r></w:hyperlink><w:r><w:footnoteReference w:id="1"/></w:r></w:p><w:p><w:bookmarkStart w:id="8" w:name="Jump"/><w:r><w:t>Destination specimen</w:t></w:r><w:bookmarkEnd w:id="8"/></w:p>',{
    relationships:relationship('site','https://example.org/?a=1&amp;b=2')+relationship('mail','mailto:editor@example.org')+relationship('unsafe','javascript:alert(1)'),
    footnotes:'<w:footnotes xmlns:w="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:footnote w:id="1"><w:p>'+link('note','Note link')+'</w:p></w:footnote></w:footnotes>',
    entries:[textZipEntry('word/_rels/footnotes.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+relationship('note','https://example.org/note')+'</Relationships>')]
  });
  const plan=await parseDocxForStudio(input);
  const inspect=(p:typeof plan)=>{
    const block=p.sections.flatMap(s=>s.blocks).find(b=>b.content.includes('Web specimen'))!;
    const nodes=findNodes(JSON.parse(block.content),'text');
    const mark=(label:string)=>nodes.find(n=>n.text?.includes(label))?.marks?.find(m=>m.type==='omiLink')?.attrs;
    assert.equal(mark('Web specimen')?.href,'https://example.org/?a=1&b=2');
    assert.equal(mark('Web specimen')?.title,'Source & details');
    assert.equal(mark('Mail specimen')?.href,'mailto:editor@example.org');
    assert.equal(mark('Unsafe specimen'),undefined);
    assert.equal(p.crossReferences?.[0]?.wordField?.kind,'HYPERLINK');
    assert.equal(p.crossReferences?.[0]?.wordField?.cachedLabel,'Internal specimen');
    assert.equal(p.crossReferences?.[0]?.targetId,p.namedAnchors?.[0]?.id);
  };
  inspect(plan);
  const manuscript=parseOmiJson(serializeOmiJson({...createBlankManuscript({kind:'study',locale:'en',title:'Native links'}),sections:plan.sections,annotations:plan.annotations,namedAnchors:plan.namedAnchors,crossReferences:plan.crossReferences}));
  const word=buildDocxExport(manuscript);
  const parts=readZipParts(word.bytes);
  const document=parts.get('word/document.xml')!.toString('utf8');
  const relationships=parts.get('word/_rels/document.xml.rels')!.toString('utf8');
  assert.match(document,/<w:hyperlink r:id="rIdHyperlink1" w:tooltip="Source &amp; details">/);
  assert.equal((relationships.match(/Target="https:\/\/example.org\/\?a=1&amp;b=2"/g)??[]).length,1);
  assert.match(relationships,/Target="mailto:editor@example.org" TargetMode="External"/);
  assert.doesNotMatch(relationships,/javascript:|example.org\/note/);
  assert.match(document,/<w:hyperlink w:anchor="Jump">/);
  assert.match(parts.get('word/_rels/footnotes.xml.rels')!.toString('utf8'),/Target="https:\/\/example.org\/note"/);
  assert.match(parts.get('word/footnotes.xml')!.toString('utf8'),/<w:hyperlink r:id="rIdHyperlink1"/);
  inspect(await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'native-links.docx')));
});

test('simple and complex Word TOC fields remain semantic and regenerate native instructions',async()=>{
  const {wordTocInstruction}=await import('../src/model/tableOfContents.ts');
  const simple='<w:p><w:fldSimple w:instr=" TOC \\o &quot;2-4&quot; \\h \\u \\n "><w:r><w:t>Cached row not manuscript text</w:t></w:r></w:fldSimple></w:p>';
  const body='<w:p><w:r><w:t>Body before contents</w:t></w:r></w:p>'+simple+'<w:p><w:r><w:t>Cached row not manuscript text</w:t></w:r></w:p><w:p><w:r><w:t>Body after contents</w:t></w:r></w:p>';
  const plan=await parseDocxForStudio(makeDocx(body));
  assert.equal(plan.tableOfContents?.minLevel,2);
  assert.equal(plan.tableOfContents?.maxLevel,4);
  assert.equal(plan.tableOfContents?.useOutlineLevels,true);
  assert.equal(plan.tableOfContents?.omitPageNumbers,true);
  assert.equal(plan.tableOfContents?.source?.wordHyperlinks,true);
  assert.equal(plan.sections.flatMap(s=>s.blocks).filter(b=>b.content.includes('Cached row not manuscript text')).length,1);
  const manuscript=parseOmiJson(serializeOmiJson({...createBlankManuscript({kind:'study',locale:'en',title:'Native contents'}),sections:plan.sections,tableOfContents:plan.tableOfContents}));
  const word=buildDocxExport(manuscript);
  const parts=readZipParts(word.bytes);
  const document=parts.get('word/document.xml')!.toString('utf8');
  assert.ok(document.includes('w:instr=" TOC \\o &quot;2-4&quot; \\h \\u \\n " w:dirty="true"'));
  assert.match(parts.get('word/settings.xml')!.toString('utf8'),/w:updateFields w:val="true"/);
  assert.equal((document.match(/Cached row not manuscript text/g)??[]).length,1);
  const reopened=await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'toc.docx'));
  assert.equal(reopened.tableOfContents?.minLevel,2);
  assert.equal(reopened.tableOfContents?.maxLevel,4);
  assert.equal(reopened.tableOfContents?.omitPageNumbers,true);
  const complex='<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>Cached contents</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
  const complexPlan=await parseDocxForStudio(makeDocx(complex+'<w:p><w:r><w:t>Body text</w:t></w:r></w:p>'));
  assert.equal(complexPlan.tableOfContents?.source?.wordHyperlinks,false);
  assert.equal(wordTocInstruction(complexPlan.tableOfContents!),' TOC \\o "1-3" ');
  assert.equal(wordTocInstruction({...plan.tableOfContents!,minLevel:0}),undefined);
  assert.equal(wordTocInstruction({...plan.tableOfContents!,source:{format:'docx-toc',instruction:'INCLUDETEXT unsafe',wordHyperlinks:false}}),' TOC \\o "2-4" \\u \\n ');
});

test('simple XE and INDEX fields preserve independent index types, hierarchical terms and locations',async()=>{
  const xe=(instruction:string)=>'<w:fldSimple w:instr="'+instruction.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"/>';
  const index=(instruction:string)=>'<w:p><w:fldSimple w:instr="'+instruction.replace(/"/g,'&quot;')+'"><w:r><w:t>Generated cache 999</w:t></w:r></w:fldSimple></w:p>';
  const body='<w:p><w:r><w:t>Person specimen</w:t></w:r>'+xe(' XE "Example Person" ')+'</w:p>'
    +'<w:p><w:r><w:t>Subject specimen</w:t></w:r>'+xe(' XE "History:Sources" \\f "S" ')+'</w:p>'
    +'<w:p><w:r><w:t>Literal colon specimen</w:t></w:r>'+xe(' XE "Time\\: period:Records" \\f "S" ')+'</w:p>'
    +index(' INDEX ')+index(' INDEX \\f "S" \\c "2" ');
  const inspect=(plan:DocxManuscriptImportPlan)=>{
    assert.equal(plan.indexEntries?.length,3);
    assert.equal(plan.generatedIndexes?.length,2);
    assert.equal(plan.indexDefinitions?.length,1);
    const def=plan.indexDefinitions![0]!;
    assert.equal(def.wordType,'S');
    assert.deepEqual(plan.indexEntries!.map(e=>e.terms),[['Example Person'],['History','Sources'],['Time: period','Records']]);
    assert.deepEqual(plan.indexEntries!.map(e=>e.indexId),[undefined,def.id,def.id]);
    assert.deepEqual(plan.generatedIndexes!.map(e=>e.indexId),[undefined,def.id]);
    assert.equal(plan.generatedIndexes![1]!.wordColumns,2);
    const blocks=plan.sections.flatMap(s=>s.blocks);
    for(const [i,label] of ['Person specimen','Subject specimen','Literal colon specimen'].entries()){
      assert.ok(blocks.find(b=>b.id===plan.indexEntries![i]!.targetBlockId)?.content.includes(label),label);
    }
    assert.ok(blocks.every(b=>!b.content.includes('Generated cache 999')));
  };
  const plan=await parseDocxForStudio(makeDocx(body));
  inspect(plan);
  const previous=useStudioStore.getState();
  try{
    applyDocxImportPlan(plan,{importDetectedAuthors:false,source:'',selfAuthoredExternal:true});
    const manuscript=parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
    assert.equal(manuscript.indexDefinitions?.[0]?.wordType,'S');
    assert.equal(manuscript.indexEntries?.length,3);
    const word=buildDocxExport(manuscript);
    const xml=readZipParts(word.bytes).get('word/document.xml')!.toString('utf8');
    assert.ok(xml.includes('w:instr=" XE &quot;Example Person&quot; "'));
    assert.ok(xml.includes('w:instr=" XE &quot;History:Sources&quot; \\f &quot;S&quot; "'));
    assert.ok(xml.includes('w:instr=" INDEX \\f &quot;S&quot; \\c &quot;2&quot; " w:dirty="true"'));
    assert.doesNotMatch(xml,/Generated cache 999/);
    inspect(await parseDocxForStudio(new File([new Uint8Array(word.bytes)],'separate-indexes.docx')));
  }finally{useStudioStore.setState(previous,true);}
});
