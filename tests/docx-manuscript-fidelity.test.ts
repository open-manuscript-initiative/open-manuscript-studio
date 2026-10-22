import assert from 'node:assert/strict';
import { MANUSCRIPT_IMPORT_ORIGIN } from '../src/model/manuscriptImportOrigin.ts';
import { parseOmiJson, parsePortableOmiState, toPortableOmiState } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { publicPublicationManuscript } from '../src/model/publicationAnnotations.ts';
import { commitManuscriptRevision, extractManuscriptState, revertManuscriptToRevision } from '../src/model/versioning.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { inspectOmiContainer } from '../src/services/omiContainerImport.ts';
import test from 'node:test';

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

installXmlDomGlobals();

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
