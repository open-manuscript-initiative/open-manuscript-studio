import { createHash, type Hash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import {
  getSchema,
  Node as TiptapNode,
  type JSONContent,
} from '@tiptap/core';
import { DOMSerializer as ProseMirrorDomSerializer } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from '@xmldom/xmldom';

import { applyDocxImportPlan } from '../src/app/docxImportActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../src/editor/continuousManuscriptDocument.ts';
import { OmiCitationExtension } from '../src/editor/extensions/OmiCitationExtension.ts';
import { OmiContinuousStructureExtension } from '../src/editor/extensions/OmiContinuousStructureExtension.ts';
import { OmiCrossReferenceExtension } from '../src/editor/extensions/OmiCrossReferenceExtension.ts';
import { OmiNoteExtension } from '../src/editor/extensions/OmiNoteExtension.ts';
import { OmiProofingMarksExtension } from '../src/editor/extensions/OmiProofingMarksExtension.ts';
import { OmiProofreadingExtension } from '../src/editor/extensions/OmiProofreadingExtension.ts';
import {
  OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS,
} from '../src/editor/extensions/OmiRichTextExtensions.ts';
import {
  isLargeDocx,
  isMonographComplexity,
  parseDocxForStudio,
} from '../src/services/docxImportStrategy.ts';
import type { OmiSection } from '../src/types/omi.ts';

interface CliOptions {
  input: string;
  label?: string;
  jsonOutput?: string;
  markdownOutput?: string;
  assertRoundTrip: boolean;
}

interface MemorySnapshot {
  rssMiB: number;
  heapUsedMiB: number;
  externalMiB: number;
  arrayBuffersMiB: number;
}

interface SectionMetrics {
  sections: number;
  blocks: number;
  characters: number;
  words: number;
  blockTypes: Record<string, number>;
  nodeTypes: Record<string, number>;
  markTypes: Record<string, number>;
}

interface GenericNode {
  type?: unknown;
  text?: unknown;
  marks?: unknown;
  content?: unknown;
}

const WORD_RE = /\b[\p{L}\p{N}_\u2019'-]+\b/gu;

const OmiVisualBlockSchemaStub = TiptapNode.create({
  name: 'omiVisualBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { omiVisual: { default: null } };
  },
  renderHTML() {
    return ['div', { 'data-omi-visual-block': 'true' }];
  },
});

installXmlDomGlobals();

export async function benchmarkDocxImport(options: CliOptions) {
  const path = resolve(options.input);
  const raw = new Uint8Array(await readFile(path));
  const inputDigest = createHash('sha256').update(raw).digest('hex');
  const documentXmlBytes = inspectDocumentXmlUncompressedBytes(raw);
  const file = new File([raw], 'private-benchmark.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const label = options.label?.trim() || `sha256-${inputDigest.slice(0, 12)}`;

  if (typeof globalThis.gc === 'function') globalThis.gc();
  const before = memorySnapshot();
  let importPeak = before;
  let progressEvents = 0;
  let processedParagraphs = 0;
  let totalParagraphs = 0;
  const sampler = setInterval(() => {
    importPeak = maximumMemory(importPeak, memorySnapshot());
  }, 2);
  const importCpuStart = process.cpuUsage();
  const importStarted = performance.now();
  let plan;
  try {
    plan = await parseDocxForStudio(file, {
      onProgress(progress) {
        progressEvents += 1;
        processedParagraphs = Math.max(
          processedParagraphs,
          progress.processedParagraphs ?? 0,
        );
        totalParagraphs = Math.max(totalParagraphs, progress.totalParagraphs ?? 0);
      },
    });
  } finally {
    clearInterval(sampler);
  }
  const importWallMs = performance.now() - importStarted;
  const importCpu = process.cpuUsage(importCpuStart);
  const afterImport = memorySnapshot();
  importPeak = maximumMemory(importPeak, afterImport);

  const applyStarted = performance.now();
  applyDocxImportPlan(plan, {
    importDetectedAuthors: plan.authors.length > 0,
  });
  const applyWallMs = performance.now() - applyStarted;
  const applied = useStudioStore.getState().manuscript;
  const afterApply = memorySnapshot();

  const sectionNumbers = new Map(
    applied.sections.map((section, index) => [section.id, String(index + 1)]),
  );
  const editorJsonStarted = performance.now();
  const editorDocument = buildContinuousManuscriptDocument(
    applied.sections,
    sectionNumbers,
  );
  const editorJsonWallMs = performance.now() - editorJsonStarted;
  const editorJsonBytes = Buffer.byteLength(JSON.stringify(editorDocument));
  const afterEditorJson = memorySnapshot();

  const schemaStarted = performance.now();
  const schema = getSchema([
    StarterKit.configure({ horizontalRule: false }),
    OmiVisualBlockSchemaStub,
    OmiContinuousStructureExtension,
    ...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS,
    OmiProofreadingExtension,
    OmiProofingMarksExtension,
    OmiNoteExtension,
    OmiCitationExtension,
    OmiCrossReferenceExtension,
  ]);
  const schemaWallMs = performance.now() - schemaStarted;

  const prosemirrorStarted = performance.now();
  const prosemirrorDocument = schema.nodeFromJSON(editorDocument);
  const prosemirrorWallMs = performance.now() - prosemirrorStarted;
  const afterProseMirror = memorySnapshot();

  const domStarted = performance.now();
  const dom = ProseMirrorDomSerializer
    .fromSchema(schema)
    .serializeFragment(prosemirrorDocument.content, { document: xmlDocument() });
  const domWallMs = performance.now() - domStarted;
  const domNodeCount = countDomNodes(dom);
  const afterDom = memorySnapshot();

  const projectionStarted = performance.now();
  const projectedSections = projectContinuousManuscriptDocument(
    prosemirrorDocument.toJSON() as JSONContent,
    applied.sections,
  );
  const projectionWallMs = performance.now() - projectionStarted;
  const afterProjection = memorySnapshot();

  const sourceMetrics = sectionMetrics(applied.sections);
  const projectedMetrics = sectionMetrics(projectedSections);
  const sourceDigest = semanticSectionDigest(applied.sections);
  const projectedDigest = semanticSectionDigest(projectedSections);
  const sourceBlockIds = blockIds(applied.sections);
  const projectedBlockIds = blockIds(projectedSections);
  const roundTrip = {
    ok:
      sourceDigest === projectedDigest
      && arraysEqual(sourceBlockIds, projectedBlockIds)
      && sourceMetrics.sections === projectedMetrics.sections
      && sourceMetrics.blocks === projectedMetrics.blocks,
    sourceDigest,
    projectedDigest,
    sectionDelta: projectedMetrics.sections - sourceMetrics.sections,
    blockDelta: projectedMetrics.blocks - sourceMetrics.blocks,
    characterDelta: projectedMetrics.characters - sourceMetrics.characters,
    wordDelta: projectedMetrics.words - sourceMetrics.words,
  };

  const result = {
    schemaVersion: 1,
    label,
    privacy: {
      inputNameRedacted: true,
      contentEmitted: false,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },
    input: {
      bytes: file.size,
      documentXmlBytes,
      largeDocumentMode: isLargeDocx(file),
      monographMode: isMonographComplexity({
        fileSize: file.size,
        documentXmlBytes,
      }),
      digest: `sha256:${inputDigest}`,
    },
    timing: roundedRecord({
      importWallMs,
      importCpuUserMs: importCpu.user / 1000,
      importCpuSystemMs: importCpu.system / 1000,
      applyWallMs,
      editorJsonWallMs,
      schemaWallMs,
      prosemirrorWallMs,
      domWallMs,
      projectionWallMs,
      firstEditableModelMs:
        importWallMs + applyWallMs + editorJsonWallMs + schemaWallMs + prosemirrorWallMs,
    }),
    memory: {
      before: roundedMemory(before),
      importPeak: roundedMemory(importPeak),
      afterImport: roundedMemory(afterImport),
      afterApply: roundedMemory(afterApply),
      afterEditorJson: roundedMemory(afterEditorJson),
      afterProseMirror: roundedMemory(afterProseMirror),
      afterDom: roundedMemory(afterDom),
      afterProjection: roundedMemory(afterProjection),
      maximumObservedRssMiB: round(Math.max(
        importPeak.rssMiB,
        afterApply.rssMiB,
        afterEditorJson.rssMiB,
        afterProseMirror.rssMiB,
        afterDom.rssMiB,
        afterProjection.rssMiB,
      )),
    },
    progress: {
      events: progressEvents,
      processedParagraphs,
      totalParagraphs,
    },
    import: {
      stats: plan.stats,
      warningCodes: plan.warnings.map((warning) => warning.code),
      annotations: plan.annotations.length,
      indexEntries: plan.indexEntries?.length ?? 0,
      boundIndexEntries:
        plan.indexEntries?.filter((entry) => Boolean(entry.targetBlockId)).length ?? 0,
      offsetIndexEntries:
        plan.indexEntries?.filter((entry) => entry.targetTextOffset !== undefined).length ?? 0,
    },
    editor: {
      jsonBytes: editorJsonBytes,
      prosemirrorNodeSize: prosemirrorDocument.nodeSize,
      domNodeCount,
    },
    sourceMetrics,
    projectedMetrics,
    roundTrip,
  };

  if (options.assertRoundTrip && !roundTrip.ok) {
    throw new Error(
      `Semantic editor round-trip failed: sections ${roundTrip.sectionDelta}, blocks ${roundTrip.blockDelta}, characters ${roundTrip.characterDelta}.`,
    );
  }

  return result;
}

function sectionMetrics(sections: readonly OmiSection[]): SectionMetrics {
  const metrics: SectionMetrics = {
    sections: sections.length,
    blocks: 0,
    characters: 0,
    words: 0,
    blockTypes: {},
    nodeTypes: {},
    markTypes: {},
  };

  for (const section of sections) {
    for (const block of section.blocks) {
      metrics.blocks += 1;
      metrics.blockTypes[block.type] = (metrics.blockTypes[block.type] ?? 0) + 1;
      if (!block.content) continue;
      try {
        collectJsonMetrics(JSON.parse(block.content) as unknown, metrics);
      } catch {
        metrics.characters += block.content.length;
        metrics.words += block.content.match(WORD_RE)?.length ?? 0;
      }
    }
  }
  return metrics;
}

function collectJsonMetrics(value: unknown, metrics: SectionMetrics): void {
  if (!value || typeof value !== 'object') return;
  const node = value as GenericNode;
  if (typeof node.type === 'string') {
    metrics.nodeTypes[node.type] = (metrics.nodeTypes[node.type] ?? 0) + 1;
  }
  if (typeof node.text === 'string') {
    metrics.characters += node.text.length;
    metrics.words += node.text.match(WORD_RE)?.length ?? 0;
  }
  if (Array.isArray(node.marks)) {
    for (const item of node.marks) {
      if (!item || typeof item !== 'object') continue;
      const type = (item as { type?: unknown }).type;
      if (typeof type === 'string') {
        metrics.markTypes[type] = (metrics.markTypes[type] ?? 0) + 1;
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectJsonMetrics(child, metrics);
  }
}

function semanticSectionDigest(sections: readonly OmiSection[]): string {
  const hash = createHash('sha256');
  for (const section of sections) {
    updateCanonical(hash, {
      id: section.id,
      title: section.title,
      parentSectionId: section.parentSectionId,
    });
    for (const block of section.blocks) {
      let content: unknown = block.content;
      try {
        content = JSON.parse(block.content) as unknown;
      } catch {
        // Legacy plain text remains a string in the semantic digest.
      }
      updateCanonical(hash, {
        id: block.id,
        type: block.type,
        paragraphStyleId: block.paragraphStyleId,
        content,
        visual: block.visual,
      });
    }
  }
  return `sha256:${hash.digest('hex')}`;
}

function updateCanonical(hash: Hash, value: unknown): void {
  if (value === null) {
    hash.update('null;');
    return;
  }
  if (Array.isArray(value)) {
    hash.update('[');
    for (const item of value) updateCanonical(hash, item);
    hash.update(']');
    return;
  }
  if (typeof value === 'object') {
    hash.update('{');
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      // ProseMirror materializes optional schema attributes with `null`, while
      // imported OMI JSON normally omits them. Both encodings mean "unset" and
      // must not create a false semantic round-trip failure.
      if (record[key] === undefined || record[key] === null) continue;
      hash.update(`${key.length}:${key}=`);
      updateCanonical(hash, record[key]);
    }
    hash.update('}');
    return;
  }
  const primitive = String(value);
  hash.update(`${typeof value}:${primitive.length}:${primitive};`);
}

function blockIds(sections: readonly OmiSection[]): string[] {
  return sections.flatMap((section) => section.blocks.map((block) => block.id));
}

function arraysEqual(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length
    && first.every((value, index) => value === second[index]);
}

function memorySnapshot(): MemorySnapshot {
  const memory = process.memoryUsage();
  return {
    rssMiB: memory.rss / 1024 / 1024,
    heapUsedMiB: memory.heapUsed / 1024 / 1024,
    externalMiB: memory.external / 1024 / 1024,
    arrayBuffersMiB: memory.arrayBuffers / 1024 / 1024,
  };
}

function maximumMemory(
  first: MemorySnapshot,
  second: MemorySnapshot,
): MemorySnapshot {
  return {
    rssMiB: Math.max(first.rssMiB, second.rssMiB),
    heapUsedMiB: Math.max(first.heapUsedMiB, second.heapUsedMiB),
    externalMiB: Math.max(first.externalMiB, second.externalMiB),
    arrayBuffersMiB: Math.max(first.arrayBuffersMiB, second.arrayBuffersMiB),
  };
}

function roundedMemory(memory: MemorySnapshot): MemorySnapshot {
  return {
    rssMiB: round(memory.rssMiB),
    heapUsedMiB: round(memory.heapUsedMiB),
    externalMiB: round(memory.externalMiB),
    arrayBuffersMiB: round(memory.arrayBuffersMiB),
  };
}

function roundedRecord(values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, round(value)]),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function inspectDocumentXmlUncompressedBytes(bytes: Uint8Array): number {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const minimum = Math.max(0, bytes.length - 0xffff - 22);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        eocd = offset;
        break;
      }
    }
    if (eocd < 0) return 0;
    const entries = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < entries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return 0;
      const size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const name = decoder.decode(
        bytes.slice(offset + 46, offset + 46 + nameLength),
      );
      if (name === 'word/document.xml') return size;
      offset += 46 + nameLength + extraLength + commentLength;
    }
  } catch {
    // Invalid packages are reported by the actual importer.
  }
  return 0;
}

function installXmlDomGlobals(): void {
  const globals = globalThis as typeof globalThis & {
    DOMParser: typeof DOMParser;
    XMLSerializer: typeof XMLSerializer;
  };
  globals.DOMParser = XmlDomParser as unknown as typeof DOMParser;
  globals.XMLSerializer = XmlSerializer as unknown as typeof XMLSerializer;

  const document = xmlDocument();
  const elementPrototype = Object.getPrototypeOf(document.documentElement) as object;
  if (!Object.getOwnPropertyDescriptor(elementPrototype, 'children')) {
    Object.defineProperty(elementPrototype, 'children', {
      configurable: true,
      get(this: { childNodes: ArrayLike<{ nodeType: number }> }) {
        return Array.from(this.childNodes).filter((node) => node.nodeType === 1);
      },
    });
  }
  const documentPrototype = Object.getPrototypeOf(document) as object;
  if (!Object.getOwnPropertyDescriptor(documentPrototype, 'querySelector')) {
    Object.defineProperty(documentPrototype, 'querySelector', {
      configurable: true,
      value(
        this: { getElementsByTagName(name: string): ArrayLike<unknown> },
        selector: string,
      ) {
        return Array.from(this.getElementsByTagName(selector))[0] ?? null;
      },
    });
  }
}

function xmlDocument() {
  return new XmlDomParser().parseFromString(
    '<root><child/></root>',
    'application/xml',
  );
}

function countDomNodes(root: { childNodes: ArrayLike<unknown> }): number {
  let count = 0;
  const stack = Array.from(root.childNodes) as Array<{
    childNodes?: ArrayLike<unknown>;
  }>;
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    count += 1;
    if (node.childNodes) {
      stack.push(...Array.from(node.childNodes) as typeof stack);
    }
  }
  return count;
}

function readCliOptions(arguments_: string[]): CliOptions {
  let input = '';
  let label: string | undefined;
  let jsonOutput: string | undefined;
  let markdownOutput: string | undefined;
  let assertRoundTrip = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--assert-roundtrip') {
      assertRoundTrip = true;
      continue;
    }
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}.`);
    }
    if (argument === '--input') input = value;
    else if (argument === '--label') label = value;
    else if (argument === '--json') jsonOutput = value;
    else if (argument === '--markdown') markdownOutput = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }

  if (!input) {
    throw new Error(
      'Usage: --input FILE.docx [--label NON_SENSITIVE_LABEL] [--json FILE] [--markdown FILE] [--assert-roundtrip]',
    );
  }
  return {
    input,
    ...(label ? { label } : {}),
    ...(jsonOutput ? { jsonOutput } : {}),
    ...(markdownOutput ? { markdownOutput } : {}),
    assertRoundTrip,
  };
}

function markdownReport(result: Awaited<ReturnType<typeof benchmarkDocxImport>>): string {
  const timing = result.timing;
  return [
    `# DOCX benchmark: ${result.label}`,
    '',
    `- Runtime: ${result.runtime.node} / ${result.runtime.platform}-${result.runtime.architecture}`,
    `- Input: ${result.input.bytes} bytes; content is redacted`,
    `- Import: ${timing.importWallMs} ms`,
    `- First editable model: ${timing.firstEditableModelMs} ms`,
    `- Maximum observed RSS: ${result.memory.maximumObservedRssMiB} MiB`,
    `- Sections / blocks: ${result.sourceMetrics.sections} / ${result.sourceMetrics.blocks}`,
    `- Notes / index entries: ${result.import.annotations} / ${result.import.indexEntries}`,
    `- Semantic editor round-trip: ${result.roundTrip.ok ? 'PASS' : 'FAIL'}`,
    '',
  ].join('\n');
}

async function writeOutput(path: string, content: string): Promise<void> {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, content);
}

async function main(): Promise<void> {
  const options = readCliOptions(process.argv.slice(2));
  const result = await benchmarkDocxImport(options);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.jsonOutput) await writeOutput(options.jsonOutput, json);
  if (options.markdownOutput) {
    await writeOutput(options.markdownOutput, markdownReport(result));
  }
  process.stdout.write(json);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
