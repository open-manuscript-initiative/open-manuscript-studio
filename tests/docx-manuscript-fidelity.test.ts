import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from '@xmldom/xmldom';

import { parseDocxManuscript } from '../src/services/docxManuscriptImport.ts';
import { parseDocxMonograph } from '../src/services/docxMonographImport.ts';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';

installXmlDomGlobals();

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
