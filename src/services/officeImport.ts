import { sanitizeMathMlForPreview } from '../model/equationRendering';
import {
  createChartBlock,
  createEquationBlock,
  createImageBlock,
  createTableBlock,
  MAX_VISUAL_IMPORT_BYTES,
  parseDelimitedTable,
} from '../model/visualBlocks';
import type {
  OmiBlock,
  OmiChartType,
  OmiImportProvenance,
} from '../types/omi';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export async function importVisualBlocksFromFile(file: File): Promise<OmiBlock[]> {
  if (file.size > MAX_VISUAL_IMPORT_BYTES) {
    throw new Error(`Import is limited to ${Math.round(MAX_VISUAL_IMPORT_BYTES / 1024 / 1024)} MB per file.`);
  }

  const lowerName = file.name.toLowerCase();
  const provenance = createProvenance(file.name, inferSourceFormat(lowerName));

  if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(lowerName)) {
    return [await imageFileToBlock(file, provenance)];
  }

  if (/\.csv$/i.test(lowerName)) {
    return [createTableBlock(parseDelimitedTable(await file.text(), ','), { provenance })];
  }

  if (/\.(tsv|txt)$/i.test(lowerName)) {
    return [createTableBlock(parseDelimitedTable(await file.text(), '\t'), { provenance })];
  }

  if (/\.tex$/i.test(lowerName)) {
    const latex = (await file.text()).trim();
    return [createEquationBlock(latex, { notation: 'latex', latex, provenance })];
  }

  if (/\.html?$/i.test(lowerName)) {
    return importVisualBlocksFromHtml(await file.text(), provenance);
  }

  if (/\.xlsx$/i.test(lowerName)) {
    return importXlsx(await file.arrayBuffer(), provenance);
  }

  if (/\.docx$/i.test(lowerName)) {
    return importDocx(await file.arrayBuffer(), provenance);
  }

  throw new Error(`Unsupported import format: ${file.name}`);
}

export async function importVisualBlocksFromClipboardData(
  data: DataTransfer,
): Promise<OmiBlock[]> {
  const blocks: OmiBlock[] = [];
  const provenance = createProvenance(undefined, 'clipboard');

  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/')) {
      blocks.push(await imageFileToBlock(file, provenance));
    }
  }

  const html = data.getData('text/html');
  if (html) {
    blocks.push(...importVisualBlocksFromHtml(html, provenance));
  }

  if (blocks.length === 0) {
    const plainText = data.getData('text/plain');
    if (looksLikeDelimitedTable(plainText)) {
      blocks.push(createTableBlock(parseDelimitedTable(plainText), { provenance }));
    }
  }

  return deduplicateImportedBlocks(blocks);
}

export function importVisualBlocksFromHtml(
  html: string,
  provenance: OmiImportProvenance = createProvenance(undefined, 'html'),
): OmiBlock[] {
  // DOMParser creates a detached, inert HTML document here. The parsed tree is
  // never attached to the live DOM: table values are read through textContent,
  // image URLs are allow-listed below, and MathML is sanitized before storage.
  // codeql[js/xss-through-dom]
  const document = new DOMParser().parseFromString(html, 'text/html');
  const blocks: OmiBlock[] = [];

  for (const table of Array.from(document.querySelectorAll('table'))) {
    const cells = Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? ''),
    );
    if (cells.length > 0) {
      blocks.push(createTableBlock(cells, { headerRows: guessHeaderRows(table), provenance }));
    }
  }

  for (const image of Array.from(document.querySelectorAll('img'))) {
    const src = sanitizeImportedImageSource(image.getAttribute('src') ?? '');
    if (!src) continue;
    blocks.push(
      createImageBlock({
        src,
        mediaType: inferMediaTypeFromSource(src),
        alt: image.getAttribute('alt') ?? '',
        width: parseOptionalDimension(image.getAttribute('width')),
        height: parseOptionalDimension(image.getAttribute('height')),
        provenance,
      }),
    );
  }

  for (const math of Array.from(document.querySelectorAll('math'))) {
    const sanitizedMathMl = sanitizeMathMlForPreview(math.outerHTML);
    blocks.push(
      createEquationBlock(sanitizedMathMl, {
        notation: 'mathml',
        provenance,
      }),
    );
  }

  return blocks;
}

async function importXlsx(
  buffer: ArrayBuffer,
  provenance: OmiImportProvenance,
): Promise<OmiBlock[]> {
  const archive = new ZipArchive(buffer);
  const blocks: OmiBlock[] = [];
  const sharedStrings = await readSharedStrings(archive);
  const worksheetNames = archive.names()
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort(naturalFileOrder);

  const firstWorksheet = worksheetNames[0];
  if (firstWorksheet) {
    const worksheetXml = await archive.text(firstWorksheet);
    const cells = parseWorksheet(worksheetXml, sharedStrings);
    if (cells.some((row) => row.some((cell) => cell.trim().length > 0))) {
      blocks.push(
        createTableBlock(cells, {
          headerRows: 1,
          provenance: { ...provenance, sourcePart: firstWorksheet },
        }),
      );
    }
  }

  const chartNames = archive.names()
    .filter((name) => /^xl\/charts\/chart\d+\.xml$/i.test(name))
    .sort(naturalFileOrder);

  for (const chartName of chartNames) {
    const chart = parseExcelChart(await archive.text(chartName));
    if (!chart) continue;
    blocks.push(
      createChartBlock(chart.cells, {
        chartType: chart.chartType,
        title: chart.title,
        provenance: { ...provenance, sourcePart: chartName },
      }),
    );
  }

  return blocks;
}

async function importDocx(
  buffer: ArrayBuffer,
  provenance: OmiImportProvenance,
): Promise<OmiBlock[]> {
  const archive = new ZipArchive(buffer);
  if (!archive.has('word/document.xml')) {
    throw new Error('The DOCX file does not contain word/document.xml.');
  }

  const documentXml = await archive.text('word/document.xml');
  const relationships = archive.has('word/_rels/document.xml.rels')
    ? parseRelationships(await archive.text('word/_rels/document.xml.rels'))
    : new Map<string, string>();
  const xml = parseXml(documentXml);
  const body = descendantsByLocalName(xml, 'body')[0];
  const blocks: OmiBlock[] = [];

  if (!body) return blocks;

  for (const child of Array.from(body.children)) {
    if (child.localName === 'tbl') {
      const cells = parseWordTable(child);
      if (cells.length > 0) {
        blocks.push(createTableBlock(cells, { headerRows: 1, provenance }));
      }
      continue;
    }

    if (child.localName !== 'p') continue;

    for (const mathNode of descendantsByLocalName(child, 'oMath')) {
      const latex = ommlToLatex(mathNode).trim();
      if (!latex) continue;
      blocks.push(
        createEquationBlock(serializeXml(mathNode), {
          notation: 'omml',
          latex,
          provenance,
        }),
      );
    }

    for (const blip of descendantsByLocalName(child, 'blip')) {
      const relationId = attributeByLocalName(blip, 'embed');
      const target = relationId ? relationships.get(relationId) : undefined;
      if (!target) continue;
      const archivePath = normalizeWordTarget(target);
      if (!archive.has(archivePath)) continue;

      const bytes = await archive.bytes(archivePath);
      const mediaType = inferMediaTypeFromFileName(archivePath);
      const docPr = nearestDrawingProperty(child);
      blocks.push(
        createImageBlock({
          src: bytesToDataUrl(bytes, mediaType),
          mediaType,
          fileName: archivePath.split('/').pop(),
          alt: docPr?.getAttribute('descr') ?? docPr?.getAttribute('name') ?? '',
          provenance: { ...provenance, sourcePart: archivePath },
        }),
      );
    }
  }

  return deduplicateImportedBlocks(blocks);
}

async function imageFileToBlock(
  file: File,
  provenance: OmiImportProvenance,
): Promise<OmiBlock> {
  const mediaType = file.type || inferMediaTypeFromFileName(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return createImageBlock({
    src: bytesToDataUrl(bytes, mediaType),
    mediaType,
    fileName: file.name,
    alt: file.name.replace(/\.[^.]+$/, ''),
    provenance,
  });
}

function createProvenance(
  fileName: string | undefined,
  sourceFormat: string,
): OmiImportProvenance {
  return {
    sourceFormat,
    fileName,
    importedAt: new Date().toISOString(),
  };
}

function inferSourceFormat(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension || 'file';
}

function looksLikeDelimitedTable(value: string): boolean {
  if (!value.trim()) return false;
  return value.includes('\t') || /\n[^\n]*[,;]/.test(value);
}

function guessHeaderRows(table: HTMLTableElement): number {
  if (table.tHead?.rows.length) return table.tHead.rows.length;
  return table.querySelector('th') ? 1 : 0;
}

function parseOptionalDimension(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function sanitizeImportedImageSource(value: string): string | undefined {
  const src = value.trim();
  if (!src || src.startsWith('blob:')) return undefined;

  const dataMatch = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(src);
  if (dataMatch?.[1]) {
    const mediaType = dataMatch[1].toLowerCase();
    return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mediaType)
      ? src
      : undefined;
  }

  try {
    const url = new URL(src);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function inferMediaTypeFromSource(src: string): string {
  const dataMatch = /^data:([^;,]+)/i.exec(src);
  if (dataMatch?.[1]) return dataMatch[1];
  return inferMediaTypeFromFileName(src);
}

function inferMediaTypeFromFileName(fileName: string): string {
  const clean = fileName.toLowerCase().split(/[?#]/)[0] ?? '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.emf')) return 'image/emf';
  if (clean.endsWith('.wmf')) return 'image/wmf';
  return 'application/octet-stream';
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}

function parseXml(xml: string): XMLDocument {
  // OOXML parts are parsed as XML in a detached document and are only traversed
  // as data. They are never interpreted as HTML or attached to the live DOM.
  // codeql[js/xss-through-dom]
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Invalid Open XML document part.');
  }
  return document;
}

function serializeXml(node: Element): string {
  return new XMLSerializer().serializeToString(node);
}

function descendantsByLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(
    (element) => element.localName === name,
  );
}

function directChildrenByLocalName(root: Element, name: string): Element[] {
  return Array.from(root.children).filter((element) => element.localName === name);
}

function firstDescendant(root: Element, name: string): Element | undefined {
  return descendantsByLocalName(root, name)[0];
}

function attributeByLocalName(element: Element, name: string): string | undefined {
  return Array.from(element.attributes).find((attribute) => attribute.localName === name)?.value;
}

async function readSharedStrings(archive: ZipArchive): Promise<string[]> {
  if (!archive.has('xl/sharedStrings.xml')) return [];
  const xml = parseXml(await archive.text('xl/sharedStrings.xml'));
  return descendantsByLocalName(xml, 'si').map((item) =>
    descendantsByLocalName(item, 't').map((text) => text.textContent ?? '').join(''),
  );
}

function parseWorksheet(xmlText: string, sharedStrings: string[]): string[][] {
  const xml = parseXml(xmlText);
  const rows = descendantsByLocalName(xml, 'row');
  const matrix: string[][] = [];
  let maxColumn = 0;

  for (const rowElement of rows) {
    const rowIndex = Math.max(0, Number(rowElement.getAttribute('r') ?? matrix.length + 1) - 1);
    const row = matrix[rowIndex] ?? [];
    for (const cell of directChildrenByLocalName(rowElement, 'c')) {
      const reference = cell.getAttribute('r') ?? '';
      const column = excelColumnIndex(reference);
      maxColumn = Math.max(maxColumn, column);
      row[column] = readExcelCell(cell, sharedStrings);
    }
    matrix[rowIndex] = row;
  }

  const width = maxColumn + 1;
  return matrix.map((row) =>
    Array.from({ length: width }, (_, index) => row[index] ?? ''),
  );
}

function readExcelCell(cell: Element, sharedStrings: string[]): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    return descendantsByLocalName(cell, 't').map((node) => node.textContent ?? '').join('');
  }
  const value = firstDescendant(cell, 'v')?.textContent ?? '';
  if (type === 's') {
    const index = Number.parseInt(value, 10);
    return sharedStrings[index] ?? '';
  }
  if (type === 'b') return value === '1' ? 'TRUE' : 'FALSE';
  return value;
}

function excelColumnIndex(reference: string): number {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase() ?? 'A';
  let index = 0;
  for (const character of letters) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return Math.max(0, index - 1);
}

function parseExcelChart(xmlText: string): {
  chartType: OmiChartType;
  cells: string[][];
  title?: string;
} | null {
  const xml = parseXml(xmlText);
  const chartTypeElement =
    descendantsByLocalName(xml, 'barChart')[0] ??
    descendantsByLocalName(xml, 'lineChart')[0] ??
    descendantsByLocalName(xml, 'pieChart')[0] ??
    descendantsByLocalName(xml, 'scatterChart')[0];
  if (!chartTypeElement) return null;

  const chartType: OmiChartType =
    chartTypeElement.localName === 'lineChart'
      ? 'line'
      : chartTypeElement.localName === 'pieChart'
        ? 'pie'
        : chartTypeElement.localName === 'scatterChart'
          ? 'scatter'
          : 'bar';
  const seriesElements = directChildrenByLocalName(chartTypeElement, 'ser');
  if (seriesElements.length === 0) return null;

  const series = seriesElements.map((item, index) => ({
    name: readSeriesName(item) || `Series ${index + 1}`,
    categories: readChartCache(item, chartType === 'scatter' ? 'xVal' : 'cat'),
    values: readChartCache(item, chartType === 'scatter' ? 'yVal' : 'val'),
  }));
  const labels = series.find((item) => item.categories.length)?.categories ?? [];
  const rowCount = Math.max(labels.length, ...series.map((item) => item.values.length));
  if (rowCount === 0) return null;

  const cells: string[][] = [
    ['Category', ...series.map((item) => item.name)],
    ...Array.from({ length: rowCount }, (_, rowIndex) => [
      labels[rowIndex] ?? String(rowIndex + 1),
      ...series.map((item) => item.values[rowIndex] ?? ''),
    ]),
  ];
  const titleNode = descendantsByLocalName(xml, 'title')[0];
  const title = titleNode
    ? descendantsByLocalName(titleNode, 't').map((node) => node.textContent ?? '').join('') ||
      descendantsByLocalName(titleNode, 'v').map((node) => node.textContent ?? '').join('')
    : undefined;

  return { chartType, cells, title: title || undefined };
}

function readSeriesName(series: Element): string {
  const tx = directChildrenByLocalName(series, 'tx')[0];
  if (!tx) return '';
  return descendantsByLocalName(tx, 'v').map((node) => node.textContent ?? '').join('') ||
    descendantsByLocalName(tx, 't').map((node) => node.textContent ?? '').join('');
}

function readChartCache(series: Element, containerName: string): string[] {
  const container = directChildrenByLocalName(series, containerName)[0];
  if (!container) return [];
  const points = descendantsByLocalName(container, 'pt')
    .map((point) => ({
      index: Number.parseInt(point.getAttribute('idx') ?? '0', 10),
      value: firstDescendant(point, 'v')?.textContent ?? '',
    }))
    .sort((first, second) => first.index - second.index);
  return points.map((point) => point.value);
}

function parseRelationships(xmlText: string): Map<string, string> {
  const xml = parseXml(xmlText);
  const map = new Map<string, string>();
  for (const relation of descendantsByLocalName(xml, 'Relationship')) {
    const id = relation.getAttribute('Id');
    const target = relation.getAttribute('Target');
    if (id && target) map.set(id, target);
  }
  return map;
}

function normalizeWordTarget(target: string): string {
  const clean = target.replace(/^\.\//, '').replace(/\\/g, '/');
  if (clean.startsWith('/')) return clean.slice(1);
  if (clean.startsWith('word/')) return clean;
  if (clean.startsWith('../')) return clean.replace(/^\.\.\//, '');
  return `word/${clean}`;
}

function parseWordTable(table: Element): string[][] {
  return directChildrenByLocalName(table, 'tr').map((row) =>
    directChildrenByLocalName(row, 'tc').map((cell) =>
      descendantsByLocalName(cell, 't').map((text) => text.textContent ?? '').join(' ').trim(),
    ),
  );
}

function nearestDrawingProperty(paragraph: Element): Element | undefined {
  return descendantsByLocalName(paragraph, 'docPr')[0];
}

export function ommlToLatex(node: Element): string {
  const local = node.localName;
  const children = Array.from(node.children);

  if (local === 't') return escapeLatexText(node.textContent ?? '');
  if (local === 'r' || local === 'oMath' || local === 'oMathPara' || local === 'e') {
    return children.map(ommlToLatex).join('');
  }
  if (local === 'f') {
    const numerator = directChildrenByLocalName(node, 'num')[0];
    const denominator = directChildrenByLocalName(node, 'den')[0];
    return `\\frac{${numerator ? childrenLatex(numerator) : ''}}{${denominator ? childrenLatex(denominator) : ''}}`;
  }
  if (local === 'sSup') {
    return `${childrenLatex(directChildrenByLocalName(node, 'e')[0])}^{${childrenLatex(directChildrenByLocalName(node, 'sup')[0])}}`;
  }
  if (local === 'sSub') {
    return `${childrenLatex(directChildrenByLocalName(node, 'e')[0])}_{${childrenLatex(directChildrenByLocalName(node, 'sub')[0])}}`;
  }
  if (local === 'sSubSup') {
    return `${childrenLatex(directChildrenByLocalName(node, 'e')[0])}_{${childrenLatex(directChildrenByLocalName(node, 'sub')[0])}}^{${childrenLatex(directChildrenByLocalName(node, 'sup')[0])}}`;
  }
  if (local === 'rad') {
    const degree = directChildrenByLocalName(node, 'deg')[0];
    const expression = directChildrenByLocalName(node, 'e')[0];
    const degreeText = degree ? childrenLatex(degree) : '';
    return degreeText
      ? `\\sqrt[${degreeText}]{${childrenLatex(expression)}}`
      : `\\sqrt{${childrenLatex(expression)}}`;
  }
  if (local === 'nary') {
    const property = directChildrenByLocalName(node, 'naryPr')[0];
    const character = property
      ? descendantsByLocalName(property, 'chr')[0]?.getAttribute('m:val') ??
        descendantsByLocalName(property, 'chr')[0]?.getAttribute('val') ?? ''
      : '';
    const operator = naryOperator(character);
    const sub = childrenLatex(directChildrenByLocalName(node, 'sub')[0]);
    const sup = childrenLatex(directChildrenByLocalName(node, 'sup')[0]);
    const expression = childrenLatex(directChildrenByLocalName(node, 'e')[0]);
    return `${operator}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}${expression ? ` ${expression}` : ''}`;
  }
  if (local === 'd') {
    const expression = directChildrenByLocalName(node, 'e')[0];
    return `\\left(${childrenLatex(expression)}\\right)`;
  }
  if (local === 'm') {
    const rows = directChildrenByLocalName(node, 'mr').map((row) =>
      directChildrenByLocalName(row, 'e').map(childrenLatex).join(' & '),
    );
    return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
  }

  return children.map(ommlToLatex).join('');
}

function childrenLatex(node: Element | undefined): string {
  return node ? Array.from(node.children).map(ommlToLatex).join('') : '';
}

function naryOperator(character: string): string {
  if (character === '∫') return '\\int';
  if (character === '∏') return '\\prod';
  return '\\sum';
}

const LATEX_TEXT_ESCAPES: Readonly<Record<string, string>> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  '$': '\\$',
  '%': '\\%',
  '&': '\\&',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

function escapeLatexText(value: string): string {
  let escaped = '';
  for (const character of value) {
    escaped += LATEX_TEXT_ESCAPES[character] ?? character;
  }
  return escaped;
}

function naturalFileOrder(first: string, second: string): number {
  return first.localeCompare(second, undefined, { numeric: true });
}

function deduplicateImportedBlocks(blocks: OmiBlock[]): OmiBlock[] {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const visual = block.visual;
    const key = visual?.kind === 'image'
      ? `image:${visual.src}`
      : `${visual?.kind ?? block.type}:${JSON.stringify(visual ?? block.content)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

class ZipArchive {
  private readonly buffer: ArrayBuffer;
  private readonly entries: Map<string, ZipEntry>;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.entries = parseZipEntries(buffer);
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  async text(name: string): Promise<string> {
    return new TextDecoder().decode(await this.bytes(name));
  }

  async bytes(name: string): Promise<Uint8Array> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`ZIP entry not found: ${name}`);
    const view = new DataView(this.buffer);
    const offset = entry.localHeaderOffset;
    if (view.getUint32(offset, true) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP header for ${name}.`);
    }
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const compressed = new Uint8Array(
      this.buffer.slice(dataOffset, dataOffset + entry.compressedSize),
    );

    if (entry.method === 0) return compressed;
    if (entry.method !== 8) {
      throw new Error(`Unsupported ZIP compression method ${entry.method} in ${name}.`);
    }

    const stream = new Blob([compressed]).stream().pipeThrough(
      new DecompressionStream('deflate-raw'),
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
}

function parseZipEntries(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const minimum = Math.max(0, bytes.length - 65_557);
  let eocd = -1;

  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) throw new Error('Invalid ZIP/Open XML file: end record not found.');

  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory.');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    entries.set(name, {
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}
