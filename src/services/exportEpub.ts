import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { renderHtmlArticle } from './exportHtml';
import { visualTextBoxText } from '../model/textBoxes';
import { publicationSemanticLossDiagnostics, semanticLossWarnings, type PublicationSemanticLoss } from '../model/publicationSemanticLoss';
import { publicPublicationManuscript } from '../model/publicationAnnotations';
import { contributorNameParts } from '../model/contributorName';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface EpubExportResult {
  blob: Blob;
  bytes: Uint8Array;
  fileName: string;
  semanticLosses: PublicationSemanticLoss[];
  warnings: string[];
}

export function buildEpubExport(manuscript: OmiManuscript): EpubExportResult {
  manuscript = publicPublicationManuscript(manuscript);
  let semanticLosses = publicationSemanticLossDiagnostics(manuscript, 'EPUB');
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const language = normalizeLanguage(context.locale);
  const identifier = `urn:uuid:${manuscript.id}`;

  const body = context.sections.map(renderSection).join('\n');
  let xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}"><head><meta charset="utf-8"/><title>${escapeXml(context.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><article><header><h1>${escapeXml(context.title)}</h1>${context.subtitle ? `<p class="subtitle">${escapeXml(context.subtitle)}</p>` : ''}${context.contributors.length ? `<p class="authors">${context.contributors.map((item) => contributorNameParts(item).map((part) => `<span class="author-${part.kind}-name">${escapeXml(part.text)}</span>`).join(' ')).join(', ')}</p>` : ''}${context.abstract ? `<section class="abstract"><h2>${label(language, 'abstract')}</h2><p>${escapeXml(context.abstract)}</p></section>` : ''}${context.keywords.length ? `<p class="keywords"><strong>${label(language, 'keywords')}:</strong> ${context.keywords.map(escapeXml).join('; ')}</p>` : ''}</header>${body}</article></body></html>`;

  // Reuse the public HTML renderer rather than reconstructing scholarly labels.
  // The original text-only adapter remains an explicit fallback for malformed
  // legacy HTML fragments. Never suppress its semantic-loss diagnostics.
  let sharedProjection = false;
  const extraEntries: ReturnType<typeof textZipEntry>[] = [];
  const extraManifest: string[] = [];
  try {
    const rendered = renderHtmlArticle(manuscript, profile, { publicationMatter: false });
    const start = rendered.html.indexOf('<article class="omi-scholarly-article"');
    const end = rendered.html.lastIndexOf('</article>');
    if (start < 0 || end < start) throw new Error('No scholarly HTML article.');
    const fragment = rendered.html.slice(start, end + '</article>'.length)
      .replace(/<(br|img|col|hr|wbr|source|input)\b([^<>]*?)\s*\/?>/gi, '<$1$2/>');
    const candidate = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' +
      escapeXml(language) + '"><head><title>' + escapeXml(context.title) +
      '</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body>' + fragment + '</body></html>';
    const document = new DOMParser({ onError: (_level, message) => { throw new Error(message); } }).parseFromString(candidate, 'application/xhtml+xml');
    // Strip active elements, non-XHTML graphics and unsafe attributes. Keep
    // semantic tables, notes and inline formatting; package only embedded
    // raster image bytes in this synchronous exporter.
    const nodes = Array.from(document.getElementsByTagName('*'));
    const visualLosses = new Set<string>();
    for (const element of nodes) {
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
          ['script', 'iframe', 'object', 'embed', 'form', 'style', 'audio', 'video', 'source', 'input'].includes(element.localName ?? '')) {
        const parent = element.parentNode;
        if (parent) {
          if (element.localName === 'svg' || element.localName === 'math') {
            const placeholder = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
            placeholder.appendChild(document.createTextNode('[Graphic]'));
            parent.replaceChild(placeholder, element);
          } else parent.removeChild(element);
        }
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const key = attribute.name.toLowerCase();
        if (key.startsWith('on') || ['srcset', 'action', 'formaction', 'xml:base', 'http-equiv'].includes(key) ||
            (key === 'style' && /(?:url\s*\(|expression\s*\(|@|\\)/i.test(attribute.value))) {
          element.removeAttribute(attribute.name);
        }
        if (key === 'href' && !/^(?:#[A-Za-z0-9_.:-]+$|styles\.css$|https?:\/\/|mailto:)/i.test(attribute.value))
          element.removeAttribute(attribute.name);
      }
      if (element.localName === 'a' && element.getAttribute('role') === 'doc-noteref') element.setAttribute('epub:type', 'noteref');
      if (element.localName === 'li' && element.getAttribute('role') === 'doc-endnote') element.setAttribute('epub:type', 'endnote');
      if (element.localName === 'img') {
        const data = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(element.getAttribute('src') ?? '');
        if (!data || data[2]!.length > 16 * 1024 * 1024) {
          const placeholder = document.createElementNS('http://www.w3.org/1999/xhtml', 'span');
          placeholder.appendChild(document.createTextNode(element.getAttribute('alt') || '[Image unavailable]'));
          element.parentNode?.replaceChild(placeholder, element);
          visualLosses.add('image');
          continue;
        }
        const bytes = Uint8Array.from(atob(data[2]!), char => char.charCodeAt(0));
        const id = 'image-' + (extraEntries.length + 1);
        const href = 'images/' + id + '.' + (data[1] === 'jpeg' ? 'jpg' : data[1]);
        extraEntries.push({ name: 'EPUB/' + href, bytes });
        extraManifest.push('<item id="' + id + '" href="' + href + '" media-type="image/' + data[1] + '"/>');
        element.setAttribute('src', href);
      } else if (element.hasAttribute('src')) element.removeAttribute('src');
    }
    xhtml = new XMLSerializer().serializeToString(document);
    sharedProjection = true;
    // Retain relationship diagnostics where the OMI semantic model itself
    // cannot be reconstructed, and visual diagnostics for unverified objects.
    semanticLosses = semanticLosses.filter(loss => loss.code !== 'note-not-preserved' ||
      !xhtml.includes('id="note-' + htmlIdentifier(loss.targetId) + '"'));
    if (visualLosses.size) semanticLosses.push({ code: 'epub-image-unavailable', severity: 'warning',
      targetId: manuscript.id, message: 'EPUB omitted an image not available as an embedded raster. Restore its asset before export.' });
  } catch {
    extraEntries.length = 0;
    extraManifest.length = 0;
    semanticLosses.push({ code: 'epub-semantic-projection-fallback', severity: 'warning',
      targetId: manuscript.id, message: 'EPUB used the legacy text-only projection because the shared HTML could not be converted to XHTML.' });
  }
  const toc = (sections: typeof context.sections): string => '<ol>' + sections.map(section => {
    const id = sharedProjection ? htmlIdentifier(section.id) : section.id;
    return '<li><a href="article.xhtml#sec-' + escapeXml(id) + '">' +
      escapeXml(section.title || 'Section') + '</a>' + (section.children.length ? toc(section.children) : '') + '</li>';
  }).join('') + '</ol>';
  const navTitle = language.startsWith('hu') ? 'Tartalom' : language.startsWith('de') ? 'Inhalt' : 'Contents';
  const nav = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' +
    escapeXml(language) + '"><head><title>' + navTitle + '</title></head><body><nav epub:type="toc"><h1>' +
    navTitle + '</h1>' + toc(context.sections) + '</nav></body></html>';

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(language)}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier><dc:title>${escapeXml(context.title)}</dc:title><dc:language>${escapeXml(language)}</dc:language><meta property="dcterms:modified">${modified}</meta>${context.contributors.map((item) => `<dc:creator>${escapeXml(item.displayName)}</dc:creator>`).join('')}</metadata><manifest><item id="article" href="article.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/>${extraManifest.join('')}</manifest><spine><itemref idref="article"/></spine></package>`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  const css = `body{font-family:serif;line-height:1.5;max-width:42em;margin:0 auto;padding:1.5em}h1,h2,h3,h4,h5,h6{line-height:1.2}.subtitle{font-size:1.15em}.authors{font-style:italic}.author-given-name,.author-family-name,.author-literal-name{font:inherit}.abstract{margin:1.5em 0}.keywords{margin-bottom:2em}section{margin-top:1.75em}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid currentColor;padding:.25em}figure{margin:1em 0}figcaption{font-size:.9em}.note-ref{font-size:.8em}`;

  const entries = [
    textZipEntry('mimetype', 'application/epub+zip'),
    textZipEntry('META-INF/container.xml', container),
    textZipEntry('EPUB/package.opf', opf),
    textZipEntry('EPUB/nav.xhtml', nav),
    textZipEntry('EPUB/article.xhtml', xhtml),
    textZipEntry('EPUB/styles.css', css),
    ...extraEntries,
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    semanticLosses,
    warnings: semanticLossWarnings(semanticLosses),
    bytes,
    blob: new Blob([copy.buffer], { type: 'application/epub+zip' }),
    fileName: `${fileStem(manuscript)}.epub`,
  };
}

function htmlIdentifier(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '') || 'object';
}
function renderSection(section: ReturnType<typeof buildPublicationRenderingContext>['sections'][number]): string {
  const level = Math.min(6, section.depth + 2);
  const heading = section.number ? `${section.number} ${section.title}` : section.title;
  return `<section id="sec-${escapeXml(section.id)}"><h${level}>${escapeXml(heading)}</h${level}>${section.blocks.map(renderBlock).join('')}${section.children.map(renderSection).join('')}</section>`;
}

function renderBlock(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    return `<p>${escapeXml(visualTextBoxText(block.visual)).replace(/\n/g, '<br/>')}</p><p class="visual-placeholder">[${escapeXml(block.visual.kind)}${caption ? `: ${escapeXml(caption)}` : ''}]</p>`;
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
