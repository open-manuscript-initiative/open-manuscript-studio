import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStoreZip, textZipEntry, type StoreZipEntry } from '../src/services/simpleZip.ts';

export interface NativeExpectation {
  part: string;
  path: string;
  attrs: Record<string, string>;
  text?: string;
}
export interface AdvancedCase {
  id: string;
  group: string;
  feature: string;
  marker: string;
  body: string;
  checks: NativeExpectation[];
  parts: Record<string, string | { base64: string }>;
  section?: string;
  sample?: string;
  nativeSupported?: boolean;
  privateReview?: boolean;
  manual?: string;
}

export const advancedCases = (JSON.parse(readFileSync(
  new URL('./fixtures/formatting/advanced-cases.json', import.meta.url), 'utf8',
)) as { cases: AdvancedCase[] }).cases;

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS = 'xmlns:w="' + W + '" xmlns:r="' + R + '" '
  + 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
  + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
  + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
  + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
  + 'xmlns:v="urn:schemas-microsoft-com:vml" '
  + 'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
  + 'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" '
  + 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14 w15"';
const CONTENT_BASE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const RELATIONS: Record<string, { id: string; kind: string; content?: string }> = {
  'word/styles.xml': { id: 'rIdStyles', kind: 'styles', content: 'styles+xml' },
  'word/numbering.xml': { id: 'rIdNumbering', kind: 'numbering', content: 'numbering+xml' },
  'word/settings.xml': { id: 'rIdSettings', kind: 'settings', content: 'settings+xml' },
  'word/footnotes.xml': { id: 'rIdFootnotes', kind: 'footnotes', content: 'footnotes+xml' },
  'word/comments.xml': { id: 'rIdComments', kind: 'comments', content: 'comments+xml' },
  'word/commentsExtended.xml': { id: 'rIdCommentsEx', kind: 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended', content: 'application/vnd.ms-word.commentsExtended+xml' },
  'word/header1.xml': { id: 'rIdHeader1', kind: 'header', content: 'header+xml' },
  'word/header2.xml': { id: 'rIdHeader2', kind: 'header', content: 'header+xml' },
  'word/footer1.xml': { id: 'rIdFooter1', kind: 'footer', content: 'footer+xml' },
  'word/media/image.png': { id: 'rIdImage', kind: 'image' },
};

export function advancedDocxEntries(item: AdvancedCase): StoreZipEntry[] {
  const overrides = ['<Override PartName="/word/document.xml" ContentType="' + CONTENT_BASE + 'document.main+xml"/>'];
  const relations: string[] = [];
  const extras: StoreZipEntry[] = [];
  for (const [name, data] of Object.entries(item.parts)) {
    const definition = RELATIONS[name];
    if (!definition) throw new Error('Unknown fixture package part ' + name);
    const type = definition.kind.startsWith('http') ? definition.kind : R + '/' + definition.kind;
    relations.push('<Relationship Id="' + definition.id + '" Type="' + type + '" Target="' + name.slice(5) + '"/>');
    if (definition.content) {
      const content = definition.content.startsWith('application/') ? definition.content : CONTENT_BASE + definition.content;
      overrides.push('<Override PartName="/' + name + '" ContentType="' + content + '"/>');
    }
    extras.push(typeof data === 'string' ? textZipEntry(name, XML + data) : { name, bytes: Uint8Array.from(Buffer.from(data.base64, 'base64')) });
  }
  return [
    textZipEntry('[Content_Types].xml', XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' + overrides.join('') + '</Types>'),
    textZipEntry('_rels/.rels', XML + '<Relationships xmlns="' + PKG + '"><Relationship Id="rIdDocument" Type="' + R + '/officeDocument" Target="word/document.xml"/></Relationships>'),
    textZipEntry('word/document.xml', XML + '<w:document ' + NS + '><w:body>' + item.body + '<w:sectPr>' + (item.section ?? '') + '</w:sectPr></w:body></w:document>'),
    textZipEntry('word/_rels/document.xml.rels', XML + '<Relationships xmlns="' + PKG + '">' + relations.join('') + '</Relationships>'),
    ...extras,
  ];
}

export function createAdvancedDocx(item: AdvancedCase): Uint8Array {
  return createStoreZip(advancedDocxEntries(item));
}

export function writeAdvancedDocxCorpus(destination: string): void {
  for (const item of advancedCases) {
    const directory = join(destination, item.group);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, item.id + '.docx'), createAdvancedDocx(item));
  }
  writeFileSync(join(destination, 'manifest.json'), JSON.stringify(advancedCases.map(({ id, group, feature, marker, checks, manual }) => ({ id, group, feature, marker, checks, manual })), null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeAdvancedDocxCorpus(resolve(process.argv[2] ?? 'tmp/omi-advanced-formatting'));
  process.stdout.write('Generated ' + advancedCases.length + ' DOCX files.\n');
}
