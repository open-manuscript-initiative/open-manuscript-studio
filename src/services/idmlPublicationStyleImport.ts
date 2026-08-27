const PT_TO_MM = 25.4 / 72;

export type IdmlPublicationStyleKey =
  | 'body'
  | 'articleTitlePrimary'
  | 'articleSubtitlePrimary'
  | 'heading1'
  | 'heading2'
  | 'footnote'
  | 'figureCaption'
  | 'tableCaption'
  | 'bibliography';

export interface IdmlStylePatch {
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  firstLineIndent?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  fontWeight?: number;
  fontStyle?: 'italic';
}

export interface IdmlPublicationStyleImportResult {
  sourceName: string;
  page?: { width?: number; height?: number; margins?: { top?: number; bottom?: number; inner?: number; outer?: number } };
  styles: Partial<Record<IdmlPublicationStyleKey, IdmlStylePatch>>;
  mappedStyles: Array<{ source: string; target: IdmlPublicationStyleKey }>;
  unmappedStyles: string[];
}

interface ZipEntry { name: string; compressionMethod: number; compressedSize: number; localHeaderOffset: number }
interface RawParagraphStyle { id: string; name: string; basedOn?: string; patch: IdmlStylePatch }

export async function importPublicationStyleFromIdml(file: File): Promise<IdmlPublicationStyleImportResult> {
  if (!file.name.toLowerCase().endsWith('.idml')) throw new Error('The selected file is not an IDML package.');
  const buffer = await file.arrayBuffer();
  const entries = readZipDirectory(buffer);
  const xmlEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.xml'));
  if (!xmlEntries.length) throw new Error('The IDML package does not contain XML resources.');
  const xmlByName = new Map<string, string>();
  for (const entry of xmlEntries) {
    if (!shouldReadEntry(entry.name)) continue;
    const bytes = await readZipEntry(buffer, entry);
    const xml = new TextDecoder().decode(bytes);
    assertSafeIdmlXml(xml);
    xmlByName.set(entry.name, xml);
  }
  const stylesXml = findXml(xmlByName, /(^|\/)Resources\/Styles\.xml$/i)
    ?? [...xmlByName.values()].find((xml) => xml.includes('<ParagraphStyle'));
  if (!stylesXml) throw new Error('No InDesign paragraph styles were found in this IDML package.');
  const rawStyles = parseParagraphStyles(stylesXml);
  const resolvedStyles = resolveBasedOnStyles(rawStyles);
  const mappedStyles: Array<{ source: string; target: IdmlPublicationStyleKey }> = [];
  const unmappedStyles: string[] = [];
  const styles: Partial<Record<IdmlPublicationStyleKey, IdmlStylePatch>> = {};
  for (const sourceStyle of resolvedStyles) {
    const target = mapParagraphStyleName(sourceStyle.name);
    if (!target) { if (!isSystemStyle(sourceStyle.name)) unmappedStyles.push(sourceStyle.name); continue; }
    if (!styles[target]) { styles[target] = sourceStyle.patch; mappedStyles.push({ source: sourceStyle.name, target }); }
  }
  return {
    sourceName: file.name.replace(/\.idml$/i, ''),
    page: parsePageGeometry([...xmlByName.values()]), styles, mappedStyles,
    unmappedStyles: [...new Set(unmappedStyles)].sort((a, b) => a.localeCompare(b)),
  };
}

function shouldReadEntry(name: string): boolean {
  return /(^|\/)(Resources\/Styles\.xml|Resources\/Preferences\.xml|MasterSpreads\/.*\.xml|Spreads\/.*\.xml|designmap\.xml)$/i.test(name);
}
function findXml(xmlByName: Map<string, string>, pattern: RegExp): string | undefined {
  for (const [name, xml] of xmlByName) if (pattern.test(name)) return xml;
  return undefined;
}
function parseParagraphStyles(xml: string): RawParagraphStyle[] {
  const styles: RawParagraphStyle[] = [];
  const pattern = /<ParagraphStyle\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ParagraphStyle>)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const attributes = parseAttributes(match[1] ?? '');
    const body = match[2] ?? '';
    const name = attributes.Name ?? attributes.Self ?? 'Unnamed style';
    const id = attributes.Self ?? name;
    const basedOn = normalizeReference(attributes.BasedOn ?? null);
    const patch: IdmlStylePatch = {};
    const fontFamily = propertyText(body, 'AppliedFont') || attributes.AppliedFont;
    if (fontFamily && !fontFamily.startsWith('$ID/')) patch.fontFamily = fontFamily;
    assignNumber(patch, 'fontSize', attributeNumber(attributes.PointSize));
    const leading = attributeNumber(attributes.Leading); if (leading !== undefined && leading > 0) patch.lineHeight = leading;
    const firstLineIndent = attributeNumber(attributes.FirstLineIndent); if (firstLineIndent !== undefined) patch.firstLineIndent = round(firstLineIndent * PT_TO_MM);
    const spaceBefore = attributeNumber(attributes.SpaceBefore); if (spaceBefore !== undefined) patch.spaceBefore = round(spaceBefore);
    const spaceAfter = attributeNumber(attributes.SpaceAfter); if (spaceAfter !== undefined) patch.spaceAfter = round(spaceAfter);
    const alignment = mapJustification(attributes.Justification ?? null); if (alignment) patch.alignment = alignment;
    const fontStyle = (attributes.FontStyle ?? propertyText(body, 'FontStyle')).toLowerCase();
    if (/italic|oblique/.test(fontStyle)) patch.fontStyle = 'italic';
    if (/bold|semibold|demibold/.test(fontStyle)) patch.fontWeight = /semi|demi/.test(fontStyle) ? 600 : 700;
    styles.push({ id, name, basedOn, patch });
  }
  return styles;
}
function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) attributes[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  return attributes;
}
function propertyText(body: string, propertyName: string): string {
  const escaped = escapeRegExp(propertyName);
  const match = body.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  if (!match) return '';
  // IDML style properties used here are scalar text values. Reject nested markup
  // instead of attempting to sanitize arbitrary XML/HTML with a regular expression.
  const value = match[1];
  if (value.includes('<') || value.includes('>')) return '';
  return decodeXmlEntities(value).trim();
}
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function resolveBasedOnStyles(styles: RawParagraphStyle[]): RawParagraphStyle[] {
  const byId = new Map(styles.map((style) => [normalizeReference(style.id) ?? style.id, style]));
  const memo = new Map<string, IdmlStylePatch>();
  function resolve(style: RawParagraphStyle, stack = new Set<string>()): IdmlStylePatch {
    if (memo.has(style.id)) return memo.get(style.id)!;
    if (stack.has(style.id)) return style.patch;
    stack.add(style.id);
    const parent = style.basedOn ? byId.get(style.basedOn) : undefined;
    const patch = { ...(parent ? resolve(parent, stack) : {}), ...style.patch };
    memo.set(style.id, patch); return patch;
  }
  return styles.map((style) => ({ ...style, patch: resolve(style) }));
}
function parsePageGeometry(xmlDocuments: string[]): IdmlPublicationStyleImportResult['page'] | undefined {
  let width: number | undefined; let height: number | undefined;
  const margins: NonNullable<NonNullable<IdmlPublicationStyleImportResult['page']>['margins']> = {};
  for (const xml of xmlDocuments) {
    if (width === undefined) width = firstAttributeNumber(xml, 'PageWidth');
    if (height === undefined) height = firstAttributeNumber(xml, 'PageHeight');
    if (margins.top === undefined) margins.top = pointsToMm(firstAttributeNumber(xml, 'Top'));
    if (margins.bottom === undefined) margins.bottom = pointsToMm(firstAttributeNumber(xml, 'Bottom'));
    if (margins.inner === undefined) margins.inner = pointsToMm(firstAttributeNumber(xml, 'Left'));
    if (margins.outer === undefined) margins.outer = pointsToMm(firstAttributeNumber(xml, 'Right'));
  }
  const pageWidth = pointsToMm(width); const pageHeight = pointsToMm(height);
  if (pageWidth === undefined && pageHeight === undefined && !Object.keys(margins).length) return undefined;
  return { width: pageWidth, height: pageHeight, margins };
}
function mapParagraphStyleName(name: string): IdmlPublicationStyleKey | undefined {
  const normalized = normalizeStyleName(name);
  const rules: Array<[RegExp, IdmlPublicationStyleKey]> = [
    [/^(body|body text|text|normal|törzsszöveg|grundtext|fließtext)$/, 'body'],
    [/(article|manuscript|paper)? ?(title|cím|titel)( 1| primary| main)?$/, 'articleTitlePrimary'],
    [/(subtitle|alcím|untertitel)/, 'articleSubtitlePrimary'],
    [/(heading|headline|címsor|überschrift|fejezet|chapter).*\b1\b|^(h1|heading 1|címsor 1|überschrift 1)$/, 'heading1'],
    [/(heading|headline|címsor|überschrift|fejezet|chapter).*\b2\b|^(h2|heading 2|címsor 2|überschrift 2)$/, 'heading2'],
    [/(footnote|lábjegyzet|fußnote)/, 'footnote'],
    [/(figure|image|ábra|kép|abbildung).*(caption|felirat|legende)|^(caption figure|figure caption)$/, 'figureCaption'],
    [/(table|táblázat|tabelle).*(caption|felirat|legende)|^(caption table|table caption)$/, 'tableCaption'],
    [/(bibliograph|reference|irodalom|hivatkoz|literatur)/, 'bibliography'],
  ];
  return rules.find(([pattern]) => pattern.test(normalized))?.[1];
}
function normalizeStyleName(name: string): string { return name.replace(/^\$ID\//, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[_/.-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase(); }
function isSystemStyle(name: string): boolean { return /^\[.*\]$/.test(name) || name.startsWith('$ID/'); }
function mapJustification(value: string | null): IdmlStylePatch['alignment'] | undefined {
  if (!value) return undefined; const normalized = value.toLowerCase();
  if (normalized.includes('center')) return 'center'; if (normalized.includes('right')) return 'right';
  if (normalized.includes('justify')) return 'justify'; if (normalized.includes('left')) return 'left'; return undefined;
}
function assertSafeIdmlXml(xml: string): void {
  const trimmed = xml.trimStart();
  if (!trimmed.startsWith('<')) throw new Error('An IDML XML resource is not valid XML.');
  if (/<!DOCTYPE/i.test(xml)) throw new Error('An IDML XML resource contains an unsupported DOCTYPE declaration.');
  if (/<!ENTITY/i.test(xml)) throw new Error('An IDML XML resource contains an unsupported entity declaration.');
  if (/<\?xml-stylesheet/i.test(xml)) throw new Error('An IDML XML resource contains an unsupported processing instruction.');
  if (/<script\b/i.test(xml)) throw new Error('An IDML XML resource contains unsupported executable markup.');
}
function normalizeReference(value: string | null): string | undefined { if (!value || value === 'n' || value === 'NothingEnum.NOTHING') return undefined; return value.replace(/^ParagraphStyle\//, ''); }
function attributeNumber(value: string | undefined): number | undefined { if (!value || value === 'Auto' || value.startsWith('$ID/')) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function firstAttributeNumber(xml: string, name: string): number | undefined { const match = xml.match(new RegExp(`\\b${name}="(-?\\d+(?:\\.\\d+)?)"`, 'i')); if (!match) return undefined; const value = Number(match[1]); return Number.isFinite(value) ? value : undefined; }
function pointsToMm(value: number | undefined): number | undefined { return value === undefined ? undefined : round(value * PT_TO_MM); }
function assignNumber(target: IdmlStylePatch, key: keyof IdmlStylePatch, value: number | undefined): void { if (value !== undefined) (target as Record<string, unknown>)[key] = round(value); }
function round(value: number): number { return Math.round(value * 1000) / 1000; }
function readZipDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer); const view = new DataView(buffer); const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error('The selected IDML package is not a valid ZIP archive.');
  const entryCount = view.getUint16(eocdOffset + 10, true); let offset = view.getUint32(eocdOffset + 16, true); const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('The IDML ZIP directory is malformed.');
    const compressionMethod = view.getUint16(offset + 10, true); const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true); const extraLength = view.getUint16(offset + 30, true); const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true); const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset }); offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function findEndOfCentralDirectory(bytes: Uint8Array): number { const minimum = Math.max(0, bytes.length - 65_557); for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset; return -1; }
async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer); const bytes = new Uint8Array(buffer); const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('An IDML ZIP entry has an invalid local header.');
  const nameLength = view.getUint16(offset + 26, true); const extraLength = view.getUint16(offset + 28, true); const start = offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize); if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod !== 8) throw new Error(`Unsupported IDML ZIP compression method: ${entry.compressionMethod}`);
  if (typeof DecompressionStream === 'undefined') throw new Error('This platform cannot decompress IDML files.');
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}