import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface EpubExportResult {
  blob: Blob;
  bytes: Uint8Array;
  fileName: string;
}

export function buildEpubExport(manuscript: OmiManuscript): EpubExportResult {
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const language = normalizeLanguage(context.locale);
  const identifier = `urn:uuid:${manuscript.id}`;

  const body = context.sections.map(renderSection).join('\n');
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}"><head><meta charset="utf-8"/><title>${escapeXml(context.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><article><header><h1>${escapeXml(context.title)}</h1>${context.subtitle ? `<p class="subtitle">${escapeXml(context.subtitle)}</p>` : ''}${context.contributors.length ? `<p class="authors">${context.contributors.map((item) => escapeXml(item.displayName)).join(', ')}</p>` : ''}${context.abstract ? `<section class="abstract"><h2>${label(language, 'abstract')}</h2><p>${escapeXml(context.abstract)}</p></section>` : ''}${context.keywords.length ? `<p class="keywords"><strong>${label(language, 'keywords')}:</strong> ${context.keywords.map(escapeXml).join('; ')}</p>` : ''}</header>${body}</article></body></html>`;

  const nav = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${context.sections.map((section) => `<li><a href="article.xhtml#sec-${escapeXml(section.id)}">${escapeXml(section.title)}</a></li>`).join('')}</ol></nav></body></html>`;

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(language)}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier><dc:title>${escapeXml(context.title)}</dc:title><dc:language>${escapeXml(language)}</dc:language><meta property="dcterms:modified">${modified}</meta>${context.contributors.map((item) => `<dc:creator>${escapeXml(item.displayName)}</dc:creator>`).join('')}</metadata><manifest><item id="article" href="article.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/></manifest><spine><itemref idref="article"/></spine></package>`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const css = `body{font-family:serif;line-height:1.5;max-width:42em;margin:0 auto;padding:1.5em}h1,h2,h3,h4,h5,h6{line-height:1.2}.subtitle{font-size:1.15em}.authors{font-style:italic}.abstract{margin:1.5em 0}.keywords{margin-bottom:2em}section{margin-top:1.75em}`;

  const entries = [
    textZipEntry('mimetype', 'application/epub+zip'),
    textZipEntry('META-INF/container.xml', container),
    textZipEntry('EPUB/package.opf', opf),
    textZipEntry('EPUB/nav.xhtml', nav),
    textZipEntry('EPUB/article.xhtml', xhtml),
    textZipEntry('EPUB/styles.css', css),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    bytes,
    blob: new Blob([copy.buffer], { type: 'application/epub+zip' }),
    fileName: `${fileStem(manuscript)}.epub`,
  };
}

function renderSection(section: ReturnType<typeof buildPublicationRenderingContext>['sections'][number]): string {
  const level = Math.min(6, section.depth + 2);
  const heading = section.number ? `${section.number} ${section.title}` : section.title;
  return `<section id="sec-${escapeXml(section.id)}"><h${level}>${escapeXml(heading)}</h${level}>${section.blocks.map(renderBlock).join('')}${section.children.map(renderSection).join('')}</section>`;
}

function renderBlock(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    return `<p class="visual-placeholder">[${escapeXml(block.visual.kind)}${caption ? `: ${escapeXml(caption)}` : ''}]</p>`;
  }
  const text = plainText(block.content);
  return text ? `<p>${escapeXml(text)}</p>` : '';
}

function plainText(value: string): string {
  if (!value.trim()) return '';
  try {
    return textFromJson(JSON.parse(value) as unknown).replace(/\s+/g, ' ').trim();
  } catch {
    return value.trim();
  }
}

function textFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textFromJson).join(' ');
}

function normalizeLanguage(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase() || 'en';
}

function label(language: string, key: 'abstract' | 'keywords'): string {
  const lang = language.split('-')[0];
  if (lang === 'hu') return key === 'abstract' ? 'Absztrakt' : 'Kulcsszavak';
  if (lang === 'de') return key === 'abstract' ? 'Zusammenfassung' : 'Schlüsselwörter';
  return key === 'abstract' ? 'Abstract' : 'Keywords';
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript';
}
