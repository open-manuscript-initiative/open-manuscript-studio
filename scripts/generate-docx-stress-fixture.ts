import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createStoreZip,
  textZipEntry,
} from '../src/services/simpleZip.ts';

export interface SyntheticDocxOptions {
  targetWords: number;
  wordsPerParagraph?: number;
  headingEvery?: number;
  noteEvery?: number;
}

const WORDS = [
  'manuscript',
  'archive',
  'metadata',
  'structure',
  'edition',
  'history',
  'source',
  'annotation',
  'reference',
  'chapter',
  'document',
  'research',
] as const;

export function createSyntheticDocxBytes(
  options: SyntheticDocxOptions,
): Uint8Array {
  const targetWords = positiveInteger(options.targetWords, 'targetWords');
  const wordsPerParagraph = positiveInteger(
    options.wordsPerParagraph ?? 80,
    'wordsPerParagraph',
  );
  const headingEvery = positiveInteger(
    options.headingEvery ?? 120,
    'headingEvery',
  );
  const noteEvery = positiveInteger(options.noteEvery ?? 40, 'noteEvery');
  const paragraphCount = Math.ceil(targetWords / wordsPerParagraph);
  const body: string[] = [];
  const notes: string[] = [];
  let emittedWords = 0;
  let noteId = 1;

  for (let paragraph = 0; paragraph < paragraphCount; paragraph += 1) {
    if (paragraph % headingEvery === 0) {
      const headingNumber = Math.floor(paragraph / headingEvery) + 1;
      body.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>`
        + `<w:r><w:t>Synthetic chapter ${headingNumber}</w:t></w:r></w:p>`,
      );
    }

    const remaining = targetWords - emittedWords;
    const paragraphWords = Math.min(wordsPerParagraph, remaining);
    const text = Array.from(
      { length: paragraphWords },
      (_, word) => WORDS[(paragraph * wordsPerParagraph + word) % WORDS.length],
    ).join(' ');
    emittedWords += paragraphWords;

    const note = paragraph > 0 && paragraph % noteEvery === 0
      ? `<w:r><w:footnoteReference w:id="${noteId}"/></w:r>`
      : '';
    if (note) {
      notes.push(
        `<w:footnote w:id="${noteId}"><w:p><w:r>`
        + `<w:t>Synthetic note ${noteId} with neutral test content.</w:t>`
        + '</w:r></w:p></w:footnote>',
      );
      noteId += 1;
    }
    body.push(
      `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r>${note}</w:p>`,
    );
  }

  const documentXml = xmlDocument(
    `<w:document ${wordNamespaces()}><w:body>${body.join('')}</w:body></w:document>`,
  );
  const stylesXml = xmlDocument(
    `<w:styles ${wordNamespaces()}>`
      + '<w:style w:type="paragraph" w:styleId="Heading1">'
      + '<w:name w:val="Heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr>'
      + '</w:style></w:styles>',
  );
  const footnotesXml = xmlDocument(
    `<w:footnotes ${wordNamespaces()}>`
      + '<w:footnote w:type="separator" w:id="-1"><w:p/></w:footnote>'
      + '<w:footnote w:type="continuationSeparator" w:id="0"><w:p/></w:footnote>'
      + notes.join('')
      + '</w:footnotes>',
  );
  const relationshipsXml = xmlDocument(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" '
      + 'Target="footnotes.xml"/>'
      + '</Relationships>',
  );
  const packageRelationshipsXml = xmlDocument(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
      + 'Target="word/document.xml"/>'
      + '</Relationships>',
  );
  const contentTypesXml = xmlDocument(
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" '
      + 'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" '
      + 'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/footnotes.xml" '
      + 'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>'
      + '</Types>',
  );

  return createStoreZip([
    textZipEntry('[Content_Types].xml', contentTypesXml),
    textZipEntry('_rels/.rels', packageRelationshipsXml),
    textZipEntry('word/document.xml', documentXml),
    textZipEntry('word/styles.xml', stylesXml),
    textZipEntry('word/footnotes.xml', footnotesXml),
    textZipEntry('word/_rels/document.xml.rels', relationshipsXml),
  ]);
}

function wordNamespaces(): string {
  return 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
}

function xmlDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

interface CliOptions {
  output: string;
  targetWords: number;
  wordsPerParagraph?: number;
  headingEvery?: number;
  noteEvery?: number;
}

function readCliOptions(arguments_: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const key = arguments_[index];
    if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
    values.set(key, value);
    index += 1;
  }

  const output = values.get('--output');
  const words = Number(values.get('--words'));
  if (!output || !Number.isSafeInteger(words) || words <= 0) {
    throw new Error('Usage: --output FILE.docx --words POSITIVE_INTEGER');
  }

  const optionalInteger = (key: string): number | undefined => {
    const raw = values.get(key);
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    return positiveInteger(parsed, key.slice(2));
  };

  return {
    output,
    targetWords: words,
    wordsPerParagraph: optionalInteger('--words-per-paragraph'),
    headingEvery: optionalInteger('--heading-every'),
    noteEvery: optionalInteger('--note-every'),
  };
}

async function main(): Promise<void> {
  const options = readCliOptions(process.argv.slice(2));
  const output = resolve(options.output);
  const bytes = createSyntheticDocxBytes(options);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  process.stdout.write(`${JSON.stringify({
    output,
    bytes: bytes.length,
    targetWords: options.targetWords,
  })}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
